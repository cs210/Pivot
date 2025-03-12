// 1. First, let's fix the API route - replace app/api/stitch-panorama/route.js with this

// app/api/stitch-panorama/route.js
import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { exec } from 'child_process';

// Convert exec to Promise-based
const execPromise = promisify(exec);

// Get environment variables
const AWS_HOST = process.env.AWS_HOST;
const AWS_USER = process.env.AWS_USER;
const SSH_KEY_PATH = process.env.SSH_KEY_PATH;

// Debug logging helper
const debugLog = [];
function log(message) {
  console.log(`[Panorama Stitcher] ${message}`);
  debugLog.push(`[${new Date().toISOString()}] ${message}`);
}

export async function POST(request) {
  try {
    log('Received panorama stitching request');
    
    // Check if SSH key path is set
    if (!SSH_KEY_PATH) {
      log('Error: SSH_KEY_PATH environment variable not set');
      return NextResponse.json(
        { error: 'Server configuration error: SSH key not configured', debug: debugLog },
        { status: 500 }
      );
    }
    
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
    
    // Parse the form data from the request
    const formData = await request.formData();
    const userId = formData.get('userId');
    const panoramaName = formData.get('panoramaName') || `panorama_${jobId}`;
    
    // Get all files from the form data
    const files = formData.getAll('files');
    log(`Received ${files.length} files for processing`);
    
    if (files.length === 0) {
      log('No files received');
      return NextResponse.json(
        { error: 'No files were provided for stitching', debug: debugLog },
        { status: 400 }
      );
    }
    
    // Validate files (make sure they're images)
    for (const file of files) {
      if (!(file instanceof Blob)) {
        continue;
      }
      
      const type = file.type;
      if (!type.startsWith('image/')) {
        log(`Rejecting non-image file: ${type}`);
        return NextResponse.json(
          { error: 'All files must be images', debug: debugLog },
          { status: 400 }
        );
      }
    }
    
    // Save files to the job directory
    const savedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!(file instanceof Blob)) {
        log(`Skipping non-file entry at index ${i}`);
        continue;
      }
      
      const fileName = file.name || `image_${i}.jpg`;
      const filePath = path.join(jobDir, fileName);
      
      // Convert blob to buffer and write to file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(filePath, buffer);
      
      savedFiles.push(filePath);
      log(`Saved file: ${filePath}`);
    }
    
    log(`Successfully saved ${savedFiles.length} files`);
    
    // Check if SSH key exists
    if (!existsSync(SSH_KEY_PATH)) {
      log(`Error: SSH key not found at ${SSH_KEY_PATH}`);
      return NextResponse.json(
        { error: `SSH key not found at ${SSH_KEY_PATH}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Test SSH connection
    try {
      log('Testing SSH connection...');
      const { stdout, stderr } = await execPromise(
        `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${AWS_USER}@${AWS_HOST} "echo SSH connection successful"`
      );
      log(`SSH test result: ${stdout.trim()} ${stderr ? '(stderr: ' + stderr.trim() + ')' : ''}`);
    } catch (error) {
      log(`SSH connection test failed: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to connect to AWS server: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Create remote directory on AWS server
    const remoteDir = `/home/${AWS_USER}/panorama_jobs/${jobId}`;
    
    try {
      log(`Creating remote directory: ${remoteDir}`);
      await execPromise(`ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} "mkdir -p ${remoteDir}"`);
    } catch (error) {
      log(`Failed to create remote directory: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to create directory on server: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Copy files to AWS server
    log(`Copying files to AWS server using SCP`);
    try {
      const { stdout, stderr } = await execPromise(`scp -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no "${jobDir}"/* ${AWS_USER}@${AWS_HOST}:${remoteDir}/`);
      log(`SCP file transfer: ${stdout || 'Success'} ${stderr ? '(stderr: ' + stderr.trim() + ')' : ''}`);
    } catch (error) {
      log(`Failed to copy files to server: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to copy files to server: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Create PTGui project and stitch panorama on AWS
    const projectName = `${panoramaName.replace(/[^a-zA-Z0-9]/g, '_')}_${jobId}`;
    
    log(`Creating and stitching panorama project: ${projectName}`);
    
    // First create the project
    try {
      const createCommand = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} "cd ${remoteDir} && ~/ptgui_trial_13.0/PTGui -createproject ${remoteDir}/*.jpg -output ${remoteDir}/${projectName}.pts"`;
      log(`Executing create project command: ${createCommand}`);
      
      const { stdout, stderr } = await execPromise(createCommand);
      log(`Project creation result: \n${stdout.trim()}\n${stderr ? 'stderr: ' + stderr.trim() : ''}`);
    } catch (error) {
      log(`Failed to create panorama project: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to create panorama project: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Then stitch the panorama
    try {
      const stitchCommand = `ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} "cd ${remoteDir} && ~/ptgui_trial_13.0/PTGui -stitchnogui ${remoteDir}/${projectName}.pts"`;
      log(`Executing stitch command: ${stitchCommand}`);
      
      const { stdout, stderr } = await execPromise(stitchCommand);
      log(`Stitching result: \n${stdout.trim()}\n${stderr ? 'stderr: ' + stderr.trim() : ''}`);
      
      // Check if stitching failed due to control points
      if (stdout.includes("Could not find control points for all images") || 
          stdout.includes("not stitching the panorama")) {
        log(`Stitching failed: Not enough control points between images`);
        return NextResponse.json(
          { 
            error: "Could not stitch panorama. The images may not have enough overlap or shared features.", 
            detail: "Try using images with more overlap or that show the same scene from different angles.",
            debug: debugLog 
          },
          { status: 422 }
        );
      }
    } catch (error) {
      log(`Failed to stitch panorama: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to stitch panorama: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Get the output file name (PTGui might create a file with a different name)
    let outputFileName;
    let largestSize = 0;
    
    try {
      log(`Listing remote directory to find output file`);
      const { stdout: lsOutput } = await execPromise(`ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} "ls -la ${remoteDir}/"`);
      log(`Remote directory listing: \n${lsOutput.trim()}`);
      
      // Parse the ls output to find jpg files
      const lines = lsOutput.split('\n');
      const jpgFiles = lines.filter(line => line.toLowerCase().includes('.jpg'));
      
      jpgFiles.forEach(file => {
        // Extract size and filename from ls output
        const matches = file.match(/\S+\s+\S+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\S+\s+\S+\s+(.+)/);
        if (matches && matches[1] && matches[2]) {
          const size = parseInt(matches[1]);
          const name = matches[2].trim();
          
          // Check if this file contains the job ID or project name (most likely our panorama)
          if (name.includes(jobId) || name.includes(projectName)) {
            outputFileName = name;
            log(`Found panorama by ID/name match: ${outputFileName} (${size} bytes)`);
            return; // Break the loop once we find a match
          }
          
          // Otherwise track the largest file as a fallback
          if (size > largestSize) {
            largestSize = size;
            outputFileName = name;
            log(`Found larger file: ${outputFileName} (${size} bytes)`);
          }
        }
      });
      
      if (!outputFileName) {
        log(`Could not find output panorama file in remote directory`);
        return NextResponse.json(
          { error: "No panorama output file was found after stitching", debug: debugLog },
          { status: 500 }
        );
      }
    } catch (error) {
      log(`Failed to list remote directory: ${error.message}`);
      // Continue anyway, we'll try to copy using the expected path
      outputFileName = `${projectName}.jpg`;
    }
    
    // Copy the panorama file back to our server
    const remoteResultPath = `${remoteDir}/${outputFileName}`;
    const localResultPath = path.join(jobDir, outputFileName);
    
    try {
      log(`Copying panorama from AWS to local path: ${localResultPath}`);
      await execPromise(`scp -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST}:${remoteResultPath} "${localResultPath}"`);
      log(`Successfully copied panorama to local path`);
    } catch (error) {
      log(`Failed to copy panorama from AWS: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to copy panorama from server: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Verify the file exists locally
    try {
      log(`Verifying local panorama file: ${localResultPath}`);
      
      const localFiles = await readdir(jobDir);
      log(`Local directory contents: ${localFiles.join(', ')}`);
      
      if (!localFiles.includes(outputFileName)) {
        log(`Error: Panorama file not found in local directory`);
        return NextResponse.json(
          { error: "Panorama file not found after copy", debug: debugLog },
          { status: 500 }
        );
      }
    } catch (error) {
      log(`Failed to verify local panorama file: ${error.message}`);
      // Continue anyway
    }
    
    // Return a temporary URL to the panorama
    const panoramaUrl = `/api/panoramas/${jobId}/${encodeURIComponent(path.basename(localResultPath))}`;
    log(`Successfully created panorama. URL: ${panoramaUrl}`);
    
    return NextResponse.json({ 
      panoramaUrl,
      jobId,
      message: "Panorama created successfully",
      debug: debugLog
    });
    
  } catch (error) {
    log(`Unhandled error in API route: ${error.message}`);
    console.error('Error processing panorama:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to process panorama', debug: debugLog },
      { status: 500 }
    );
  }
}