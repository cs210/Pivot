import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const { jobId, filename } = params;
  
  // Check that the requested path only contains the jobId and filename
  // This prevents directory traversal attacks
  if (jobId.includes('..') || filename.includes('..') || jobId.includes('/') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  
  const panoramaPath = path.join(process.cwd(), 'tmp', jobId, filename);
  
  // Check if file exists
  if (!existsSync(panoramaPath)) {
    return NextResponse.json({ error: 'Panorama not found' }, { status: 404 });
  }
  
  try {
    // Read the file
    const data = await readFile(panoramaPath);
    
    // Determine MIME type
    let mimeType = 'application/octet-stream';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (filename.endsWith('.png')) {
      mimeType = 'image/png';
    }
    
    // Return the file with appropriate headers
    return new NextResponse(data, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000', // 1 year caching
      },
    });
  } catch (error) {
    console.error('Error reading panorama file:', error);
    return NextResponse.json(
      { error: 'Error reading panorama file' },
      { status: 500 }
    );
  }
}