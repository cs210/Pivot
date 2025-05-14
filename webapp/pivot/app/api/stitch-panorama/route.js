// app/api/stitch-panorama/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// Debug logging helper
const debugLog = [];
function log(message) {
  console.log(`[Panorama Stitcher] ${message}`);
  debugLog.push(`[${new Date().toISOString()}] ${message}`);
}

export async function POST(request) {
  try {
    // Initialize Supabase client
    const supabase = createClient();
    
    log('Received panorama stitching request');
    
    // Parse the request body
    const { panoramaId, sourceImages, sourceFolder, projectId, isPublic } = await request.json();
    
    log(`Processing request for panorama ${panoramaId} with ${sourceImages?.length || 0} source images`);
    
    // Generate a unique job ID
    const jobId = uuidv4();
    log(`Generated job ID: ${jobId}`);
    
    // Download images from Supabase and prepare them for upload
    const imageBuffers = [];
    
    if (!sourceImages || sourceImages.length === 0) {
      log('No source images provided');
      return NextResponse.json(
        { error: 'No source images were provided for stitching', debug: debugLog },
        { status: 400 }
      );
    }
    
    log(`Downloading ${sourceImages.length} images from Supabase`);
    
    for (let i = 0; i < sourceImages.length; i++) {
      const imageId = sourceImages[i];
      
      // Get image data from database
      const { data: imageData, error: dbError } = await supabase
        .from("raw_images")
        .select("*")
        .eq("id", imageId)
        .single();
        
      if (dbError || !imageData) {
        log(`Error fetching image ${imageId} from database: ${dbError?.message || 'Image not found'}`);
        continue;
      }
      
      // Download file from Supabase storage
      const { data: fileData, error: storageError } = await supabase.storage
        .from("raw-images")
        .download(imageData.storage_path);
        
      if (storageError || !fileData) {
        log(`Error downloading image ${imageId} from storage: ${storageError?.message || 'File not found'}`);
        continue;
      }
      
      // Convert blob to buffer
      const buffer = Buffer.from(await fileData.arrayBuffer());
      imageBuffers.push(buffer);
      log(`Downloaded image ${i + 1} of ${sourceImages.length}`);
    }
    
    log(`Successfully downloaded ${imageBuffers.length} images from Supabase`);

    // Get the EC2 API endpoint from environment variables
    const EC2_API_ENDPOINT = process.env.EC2_API_ENDPOINT;
    if (!EC2_API_ENDPOINT) {
      log('Error: EC2_API_ENDPOINT environment variable not set');
      return NextResponse.json(
        { error: 'EC2_API_ENDPOINT environment variable not set', debug: debugLog },
        { status: 500 }
      );
    }

    // Prepare the files for upload to EC2
    const formData = new FormData();
    imageBuffers.forEach((buffer, index) => {
      formData.append('images', new Blob([buffer], { type: 'image/jpeg' }), `image_${index}.jpg`);
    });
    formData.append('jobId', jobId);
    formData.append('panoramaId', panoramaId);

    // Send files to EC2 API for processing
    log(`Sending files to EC2 API for processing`);
    log(`EC2 API Endpoint: ${EC2_API_ENDPOINT}/stitch`);
    
    try {
      const response = await fetch(`${EC2_API_ENDPOINT}/stitch`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        log(`EC2 API error: ${JSON.stringify(errorData)}`);
        return NextResponse.json(
          { error: `Failed to process panorama on EC2: ${errorData.error || response.statusText}`, debug: debugLog },
          { status: response.status }
        );
      }

      // Get the processed panorama from EC2
      const panoramaResponse = await fetch(`${EC2_API_ENDPOINT}/download/${jobId}`);
      if (!panoramaResponse.ok) {
        log(`Failed to download panorama from EC2: ${panoramaResponse.statusText}`);
        return NextResponse.json(
          { error: `Failed to download panorama from EC2: ${panoramaResponse.statusText}`, debug: debugLog },
          { status: panoramaResponse.status }
        );
      }

      const panoramaBuffer = await panoramaResponse.arrayBuffer();

      // Generate thumbnail using sharp
      try {
        log(`Generating thumbnail for panorama`);
        const thumbnailBuffer = await sharp(Buffer.from(panoramaBuffer))
          .resize(800, 800, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 95 })
          .toBuffer();
        
        log(`Successfully generated thumbnail`);
        
        // Upload the panorama to Supabase
        log(`Uploading panorama to Supabase storage`);
        
        // Generate a storage path
        const storagePath = `${projectId}/${panoramaId}_${Date.now()}.jpg`;
        const storageBucket = isPublic ? 'panoramas-public' : 'panoramas-private';

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(storagePath, Buffer.from(panoramaBuffer), {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          log(`Error uploading panorama to Supabase (public=${isPublic}): ${uploadError.message}`);
          throw uploadError;
        }
        
        log(`Successfully uploaded panorama to Supabase: ${uploadData.path}`);

        // Upload thumbnail to Supabase storage
        const { data: thumbnailData, error: thumbnailError } = await supabase.storage
          .from("thumbnails-private")
          .upload(storagePath, thumbnailBuffer, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });

        if (thumbnailError) {
          log(`Error uploading thumbnail to Supabase: ${thumbnailError.message}`);
          throw thumbnailError;
        }

        log(`Successfully uploaded thumbnail to Supabase: ${thumbnailData.path}`);
        
        // Update the panorama record in the database
        const { error: updateError } = await supabase
          .from("panoramas")
          .update({
            storage_path: uploadData.path,
            size_bytes: panoramaBuffer.byteLength,
            metadata: {
              status: 'completed',
              source_images: sourceImages,
              source_folder: sourceFolder,
              jobId: jobId
            }
          })
          .eq("id", panoramaId);
          
        if (updateError) {
          log(`Error updating panorama record: ${updateError.message}`);
          throw updateError;
        }
        
        log(`Successfully updated panorama database record`);
        
        // Return success with updated info
        return NextResponse.json({ 
          success: true,
          panoramaId,
          storagePath: uploadData.path,
          jobId,
          message: "Panorama created and uploaded successfully",
          debug: debugLog
        });
      } catch (error) {
        log(`Failed to process panorama: ${error.message}`);
        
        // Update the database to mark the panorama as failed
        try {
          await supabase
            .from("panoramas")
            .update({
              metadata: {
                status: 'failed',
                error: error.message || "Failed to process panorama",
                source_images: sourceImages,
                source_folder: sourceFolder,
              }
            })
            .eq("id", panoramaId);
            
          log(`Updated panorama record with failed status`);
        } catch (dbError) {
          log(`Failed to update panorama status: ${dbError.message}`);
        }
        
        return NextResponse.json(
          { error: `Failed to process panorama: ${error.message}`, debug: debugLog },
          { status: 500 }
        );
      }
    } catch (error) {
      log(`Failed to connect to EC2 API: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to connect to EC2 API: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
  } catch (error) {
    log(`Unhandled error in API route: ${error.message}`);
    console.error('Error processing panorama:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to process panorama', debug: debugLog },
      { status: 500 }
    );
  }
}