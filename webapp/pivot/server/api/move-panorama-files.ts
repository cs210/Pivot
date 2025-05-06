// server/api/move-panorama-files.ts
// This would be a server-side API route in Next.js

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a server-side Supabase client with admin privileges
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const { projectId } = await req.json();
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    // Create a client to verify the user's identity
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: {
            getItem(key: string) {
              return Promise.resolve(req.cookies.get(key)?.value || null);
            },
            setItem() {
              return Promise.resolve(); // No-op for server-side
            },
            removeItem() {
              return Promise.resolve(); // No-op for server-side
            },
          },
        },
      }
    );
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify project ownership
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this project' },
        { status: 403 }
      );
    }
    
    // Determine the new public status
    const newPublicState = !project.is_public;
    
    // 1. Get all panoramas for this project
    const { data: panoramas, error: panoError } = await supabaseAdmin
      .from('panoramas')
      .select('id, storage_path, content_type')
      .eq('project_id', projectId);
      
    if (panoError) {
      return NextResponse.json(
        { error: `Error fetching panoramas: ${panoError.message}` },
        { status: 500 }
      );
    }
    
    // Filter out panoramas without storage_path
    const panoramasWithFiles = panoramas?.filter(p => p.storage_path) || [];
    
    if (panoramasWithFiles.length === 0) {
      // No files to move, just update the project status
      const { error: updateError } = await supabaseAdmin
        .from('projects')
        .update({ is_public: newPublicState })
        .eq('id', projectId);
        
      if (updateError) {
        return NextResponse.json(
          { error: `Error updating project: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Project visibility updated. No panorama files to move.'
      });
    }
    
    // 2. Determine source and destination buckets
    const sourceBucket = newPublicState ? 'panoramas-private' : 'panoramas-public';
    const destBucket = newPublicState ? 'panoramas-public' : 'panoramas-private';
    
    // 3. Move each panorama file
    const moveResults = await Promise.all(
      panoramasWithFiles.map(async (panorama) => {
        try {
          const filePath = panorama.storage_path;
          
          // Download file from source bucket
          const { data: fileData, error: downloadError } = await supabaseAdmin
            .storage
            .from(sourceBucket)
            .download(filePath);
            
          if (downloadError || !fileData) {
            console.error(`Error downloading ${filePath}:`, downloadError);
            return {
              success: false,
              path: filePath,
              error: downloadError?.message || 'Download failed'
            };
          }
          
          // Upload to destination bucket
          const { error: uploadError } = await supabaseAdmin
            .storage
            .from(destBucket)
            .upload(filePath, fileData, {
              contentType: panorama.content_type || 'image/jpeg',
              upsert: true
            });
            
          if (uploadError) {
            console.error(`Error uploading ${filePath}:`, uploadError);
            return {
              success: false,
              path: filePath,
              error: uploadError.message
            };
          }
          
          // Delete from source bucket
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from(sourceBucket)
            .remove([filePath]);
            
          if (deleteError) {
            console.warn(`Warning: Failed to delete ${filePath}:`, deleteError);
            return {
              success: true,
              path: filePath,
              warning: `File copied but original not deleted: ${deleteError.message}`
            };
          }
          
          return {
            success: true,
            path: filePath
          };
        } catch (error: any) {
          console.error(`Error moving file:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      })
    );
    
    // Check for failures
    const failures = moveResults.filter(result => !result.success);
    
    if (failures.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Failed to move ${failures.length} out of ${panoramasWithFiles.length} files`,
        details: failures
      }, { status: 500 });
    }
    
    // Update project visibility status
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ is_public: newPublicState })
      .eq('id', projectId);
      
    if (updateError) {
      return NextResponse.json({
        success: false,
        error: `Files moved successfully, but failed to update project: ${updateError.message}`
      }, { status: 500 });
    }
    
    // Update panoramas public status
    const { error: panoUpdateError } = await supabaseAdmin
      .from('panoramas')
      .update({ is_public: newPublicState })
      .eq('project_id', projectId);
      
    if (panoUpdateError) {
      console.warn('Warning: Failed to update panorama status:', panoUpdateError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully moved ${panoramasWithFiles.length} files`,
      isNowPublic: newPublicState
    });
    
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}