// app/api/stitch-panorama/route.js
import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execPromise = promisify(exec);

// Set the AWS instance details
const AWS_HOST = 'ec2-44-200-180-134.compute-1.amazonaws.com';
const AWS_USER = 'ubuntu';
const SSH_KEY_PATH = process.env.SSH_KEY_PATH || '/Users/majdnasra/cs210.pem';
const TEMP_DIR = path.join(process.cwd(), 'tmp');

// Helper to log debug info
const debugLog = [];
function log(message) {
  console.log(`[API] ${message}`);
  debugLog.push(`${new Date().toISOString()}: ${message}`);
}

export async function POST(request) {
  try {
    log('Starting panorama processing request');
    
    // Reset debug log for new request
    debugLog.length = 0;
    
    const formData = await request.formData();
    const files = formData.getAll('files');
    const userId = formData.get('userId');
    const panoramaName = formData.get('panoramaName');
    
    log(`Received request: userId=${userId}, panoramaName=${panoramaName}, files=${files.length}`);
    
    if (!files || files.length === 0) {
      log('Error: No files uploaded');
      return NextResponse.json(
        { error: 'No files uploaded', debug: debugLog },
        { status: 400 }
      );
    }

    // Create a unique job ID and directory for this request
    const jobId = uuidv4();
    const jobDir = path.join(TEMP_DIR, jobId);
    const remoteDir = `/home/${AWS_USER}/panorama-jobs/${jobId}`;
    
    log(`Created job: id=${jobId}, localDir=${jobDir}, remoteDir=${remoteDir}`);
    
    // Create local temp directory
    log(`Creating local temp directory: ${jobDir}`);
    await mkdir(jobDir, { recursive: true });
    
    // Save uploaded files to temp directory
    const fileNames = [];
    for (const file of files) {
      if (!(file instanceof File)) {
        log(`Warning: Skipping non-file object: ${typeof file}`);
        continue;
      }
      
      const fileName = file.name;
      const filePath = path.join(jobDir, fileName);
      const buffer = Buffer.from(await file.arrayBuffer());
      
      log(`Writing file: ${fileName} (${Math.round(buffer.length/1024)}KB) to ${filePath}`);
      await writeFile(filePath, buffer);
      fileNames.push(fileName);
    }
    
    if (fileNames.length === 0) {
      log('Error: No valid image files found');
      return NextResponse.json(
        { error: 'No valid image files found', debug: debugLog },
        { status: 400 }
      );
    }
    
    log(`Successfully saved ${fileNames.length} files. Checking SSH key path: ${SSH_KEY_PATH}`);
    
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
      const { stdout, stderr } = await execPromise(`ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${AWS_USER}@${AWS_HOST} "echo SSH connection successful"`);
      log(`SSH test result: ${stdout.trim()} ${stderr ? '(stderr: ' + stderr.trim() + ')' : ''}`);
    } catch (error) {
      log(`SSH connection test failed: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to connect to SSH server: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Create the remote directory on AWS server
    log(`Creating remote directory: ${remoteDir}`);
    try {
      const { stdout, stderr } = await execPromise(`ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} "mkdir -p ${remoteDir}"`);
      log(`Remote directory creation: ${stdout || 'Success'} ${stderr ? '(stderr: ' + stderr.trim() + ')' : ''}`);
    } catch (error) {
      log(`Failed to create remote directory: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to create remote directory: ${error.message}`, debug: debugLog },
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
    
    // Check if files were transferred correctly
    try {
      log(`Verifying files on remote server`);
      const { stdout, stderr } = await execPromise(`ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} "ls -la ${remoteDir}/"`);
      log(`Remote directory contents: \n${stdout.trim()}`);
    } catch (error) {
      log(`Failed to verify remote files: ${error.message}`);
      // Continue anyway, this is just a verification step
    }
    
    // Create PTGui project and stitch panorama on AWS
    const projectName = `${panoramaName.replace(/[^a-zA-Z0-9]/g, '_')}_${jobId}`;
    const expectedOutputPath = `${remoteDir}/${projectName}.jpg`;
    
    log(`Creating and stitching panorama project: ${projectName}`);
    log(`Expected output path: ${expectedOutputPath}`);
    
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
        log(`Stitching failed: Could not find control points for all images`);
        return NextResponse.json(
          { 
            error: "Could not create panorama: insufficient overlap between images", 
            detail: "The images don't have enough overlap to create a 360° panorama. Try using images with more overlap.", 
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
    
    // List remote directory to find the output file
    let outputFileName;
    try {
      log(`Checking remote directory for output file`);
      const { stdout } = await execPromise(`ssh -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} "ls -la ${remoteDir}/"`);
      log(`Remote directory after stitching: \n${stdout.trim()}`);
      
      // Try to identify the panorama output file
      const lines = stdout.split('\n');
      const jpgFiles = lines.filter(line => line.toLowerCase().includes('.jpg'));
      
      // Look for the largest JPG file or one containing the job ID
      let largestSize = 0;
      
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
    
    // Use the identified output file path
    const remotePanoramaPath = `${remoteDir}/${outputFileName}`;
    log(`Using remote panorama path: ${remotePanoramaPath}`);
    
    // Copy the result back to our server - handle filenames with spaces properly
    const localResultPath = path.join(jobDir, outputFileName || `${projectName}.jpg`);
    log(`Copying result back to local server: ${localResultPath}`);
    
    try {
      // Use quotes around the paths to handle spaces in filenames
      const { stdout, stderr } = await execPromise(`scp -i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no "${AWS_USER}@${AWS_HOST}:${remotePanoramaPath}" "${localResultPath}"`);
      log(`SCP result copy: ${stdout || 'Success'} ${stderr ? '(stderr: ' + stderr.trim() + ')' : ''}`);
    } catch (error) {
      log(`Failed to copy result: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to copy panorama from server: ${error.message}`, debug: debugLog },
        { status: 500 }
      );
    }
    
    // Verify the file exists locally
    try {
      log(`Verifying local panorama file`);
      const files = await readdir(jobDir);
      log(`Local directory contents: ${files.join(', ')}`);
      
      const expectedFilename = path.basename(localResultPath);
      if (!files.includes(expectedFilename)) {
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