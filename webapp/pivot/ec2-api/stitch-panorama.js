const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const execPromise = promisify(exec);
const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const jobId = req.body.jobId;
    const jobDir = path.join('/tmp', jobId);
    await fs.mkdir(jobDir, { recursive: true });
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Endpoint to handle panorama stitching
app.post('/stitch', upload.array('images'), async (req, res) => {
  try {
    const { jobId, panoramaId } = req.body;
    const jobDir = path.join('/tmp', jobId);
    
    // Create PTGui project
    const projectName = `${panoramaId.replace(/[^a-zA-Z0-9]/g, '_')}_${jobId}`;
    
    // Create the project
    const createCommand = `cd ${jobDir} && ~/ptgui_trial_13.0/PTGui -createproject ${jobDir}/*.jpg -output ${jobDir}/${projectName}.pts`;
    const { stdout: createStdout, stderr: createStderr } = await execPromise(createCommand);
    
    if (createStderr) {
      console.error('Project creation error:', createStderr);
      return res.status(500).json({ error: 'Failed to create panorama project' });
    }
    
    // Stitch the panorama
    const stitchCommand = `cd ${jobDir} && ~/ptgui_trial_13.0/PTGui -stitchnogui ${jobDir}/${projectName}.pts`;
    const { stdout: stitchStdout, stderr: stitchStderr } = await execPromise(stitchCommand);
    
    if (stitchStderr) {
      console.error('Stitching error:', stitchStderr);
      return res.status(500).json({ error: 'Failed to stitch panorama' });
    }
    
    // Check for stitching errors
    if (stitchStdout.includes("Could not find control points for all images") || 
        stitchStdout.includes("not stitching the panorama")) {
      return res.status(422).json({ 
        error: "Could not stitch panorama. The images may not have enough overlap or shared features.",
        detail: "Try using images with more overlap or that show the same scene from different angles."
      });
    }
    
    res.json({ success: true, message: 'Panorama stitched successfully' });
  } catch (error) {
    console.error('Error processing panorama:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to download the stitched panorama
app.get('/download/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobDir = path.join('/tmp', jobId);
    
    // Find the largest jpg file in the directory (excluding input files)
    const files = await fs.readdir(jobDir);
    const jpgFiles = files.filter(file => 
      file.endsWith('.jpg') && !file.startsWith('image_')
    );
    
    if (jpgFiles.length === 0) {
      return res.status(404).json({ error: 'No panorama file found' });
    }
    
    // Get file stats to find the largest file
    const fileStats = await Promise.all(
      jpgFiles.map(async file => {
        const stats = await fs.stat(path.join(jobDir, file));
        return { file, size: stats.size };
      })
    );
    
    const largestFile = fileStats.reduce((a, b) => a.size > b.size ? a : b).file;
    const filePath = path.join(jobDir, largestFile);
    
    // Send the file
    res.sendFile(filePath);
    
    // Clean up the job directory after sending the file
    setTimeout(async () => {
      try {
        await fs.rm(jobDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Error cleaning up job directory:', error);
      }
    }, 5000); // Wait 5 seconds before cleanup
  } catch (error) {
    console.error('Error downloading panorama:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`EC2 Panorama API listening on port ${port}`);
}); 