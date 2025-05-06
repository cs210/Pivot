// app/api/stitch-panorama/route.js
import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createClient } from '@/utils/supabase/server';

// Convert exec to Promise-based
const execPromise = promisify(exec);

// Debug logging helper
const debugLog = [];
function log(message) {
  console.log(`[Panorama Stitcher] ${message}`);
  debugLog.push(`[${new Date().toISOString()}] ${message}`);
}

export async function POST(req) {
  log("Received request to toggle project visibility");
  const supabase = createClient();
  const { projectId, panoramasToMove, isNowPublic } = await req.json();

  // Generate a unique job ID
  const jobId = uuidv4();
  log(`Generated job ID: ${jobId}`);

  // Create temporary directory for this job
  const TEMP_DIR = path.join(process.cwd(), 'tmp');
  const jobDir = path.join(TEMP_DIR, jobId);
    
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }

  await mkdir(jobDir, { recursive: true });
  log(`Created job directory: ${jobDir}`);
      
  // Download images from Supabase and save them locally
  const savedFiles = [];

  if (!panoramasToMove || panoramasToMove.length === 0) {
    log('The project has no panoramas to move');
    return NextResponse.json({
      success: true,
      isNowPublic: isNowPublic,
    });
  }

  const sourceBucket = isNowPublic ? "panoramas-private" : "panoramas-public";
  const targetBucket = isNowPublic ? "panoramas-public" : "panoramas-private";

  // Step 2: Fetch panoramas
  const { data: panoramas, error: panoError } = await supabase
    .from("panoramas")
    .select("id, storage_path")
    .eq("project_id", projectId);

  if (panoError || !panoramas) {
    return NextResponse.json(
      { success: false, error: panoError?.message || "Could not fetch panoramas" },
      { status: 500 }
    );
  }

  for (const pano of panoramas) {
    const filePath = pano.storage_path;
  
    // Step 1: Download file from source bucket
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(sourceBucket)
      .download(filePath);
  
    if (downloadError || !fileData) {
      return NextResponse.json({
        success: false,
        error: `Failed to download ${filePath}: ${downloadError?.message}`,
      }, { status: 500 });
    }
  
    // Step 2: Upload to target bucket
    const { error: uploadError } = await supabase
      .storage
      .from(targetBucket)
      .upload(filePath, fileData, {
        upsert: true, // allows overwrite
        contentType: "image/jpeg", // or detect based on filePath if needed
      });
  
    if (uploadError) {
      return NextResponse.json({
        success: false,
        error: `Failed to upload ${filePath} to ${targetBucket}: ${uploadError.message}`,
      }, { status: 500 });
    }
  
    // Step 3: Delete from source bucket
    const { error: deleteError } = await supabase
      .storage
      .from(sourceBucket)
      .remove([filePath]);
  
    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: `Failed to delete ${filePath} from ${sourceBucket}: ${deleteError.message}`,
      }, { status: 500 });
    }
  }
  log("All panoramas processed successfully");      

  // Step 4: Update visibility
  const { data: updatedProject, error: updateError } = await supabase
    .from("projects")
    .update({ is_public: newIsPublic })
    .eq("id", projectId)
    .select()
    .maybeSingle();

  if (updateError || !updatedProject) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Failed to update project" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    isNowPublic: newIsPublic,
    project: updatedProject,
  });
}
