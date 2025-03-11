// app/api/panoramas/[jobId]/[filename]/route.js
import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  // Fix: Don't destructure params directly to avoid Next.js warning
  const jobId = params.jobId;
  const filename = params.filename;
  
  console.log(`[Panorama API] Received request for panorama: ${jobId}/${filename}`);
  
  try {
    if (!jobId || !filename) {
      console.error('[Panorama API] Missing parameters');
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }
    
    // Decode the filename (important for filenames with spaces)
    const decodedFilename = decodeURIComponent(filename);
    console.log(`[Panorama API] Decoded filename: ${decodedFilename}`);
    
    // Construct the path to the panorama file
    const TEMP_DIR = path.join(process.cwd(), 'tmp');
    const filePath = path.join(TEMP_DIR, jobId, decodedFilename);
    
    console.log(`[Panorama API] Looking for file at: ${filePath}`);
    
    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`[Panorama API] File not found: ${filePath}`);
      
      try {
        // List directory contents for debugging
        const { readdirSync } = require('fs');
        const dirPath = path.join(TEMP_DIR, jobId);
        if (existsSync(dirPath)) {
          const files = readdirSync(dirPath);
          console.log(`[Panorama API] Directory contents of ${dirPath}:`, files);
        } else {
          console.log(`[Panorama API] Directory does not exist: ${dirPath}`);
        }
      } catch (listError) {
        console.error(`[Panorama API] Error listing directory:`, listError);
      }
      
      return NextResponse.json(
        { error: 'Panorama file not found' },
        { status: 404 }
      );
    }
    
    // Get file stats
    const fileStats = await stat(filePath);
    console.log(`[Panorama API] File stats:`, {
      size: fileStats.size,
      created: fileStats.birthtime,
      modified: fileStats.mtime
    });
    
    // Read the file
    console.log(`[Panorama API] Reading file content`);
    const fileBuffer = await readFile(filePath);
    console.log(`[Panorama API] Successfully read file: ${Math.round(fileBuffer.length/1024)}KB`);
    
    // Determine the content type
    let contentType = 'application/octet-stream';
    if (decodedFilename.toLowerCase().endsWith('.jpg') || decodedFilename.toLowerCase().endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (decodedFilename.toLowerCase().endsWith('.png')) {
      contentType = 'image/png';
    }
    
    console.log(`[Panorama API] Sending response with content-type: ${contentType}`);
    
    // Return the file as a response
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
  } catch (error) {
    console.error('[Panorama API] Error serving panorama file:', error);
    
    return NextResponse.json(
      { error: `Failed to retrieve panorama file: ${error.message}` },
      { status: 500 }
    );
  }
}