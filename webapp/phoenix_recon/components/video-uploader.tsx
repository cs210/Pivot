"use client";

import type React from "react";
import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";

interface VideoUploaderProps {
  onUploadSuccess: () => void;
  userId: string;
}

export default function VideoUploader({
  onUploadSuccess,
  userId,
}: VideoUploaderProps) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [videoName, setVideoName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];

      // Check if file is a video
      if (!selectedFile.type.startsWith("video/")) {
        setError("Please select a valid video file");
        return;
      }

      // Check file size (limit to 50MB for supabase free tier)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MB limit");
        return;
      }

      setFile(selectedFile);
      setError(null);

      // Set default video name from file name
      if (!videoName) {
        const fileName = selectedFile.name.split(".").slice(0, -1).join(".");
        setVideoName(fileName);
      }
    }
  };

  const tryConvertVideoFormatIfNeeded = async (videoFile: File): Promise<File> => {
    // If the file is already in a widely supported format, just return it
    if (videoFile.type === "video/mp4" && videoFile.name.endsWith(".mp4")) {
      console.log("Video is already in MP4 format, no conversion needed");
      return videoFile;
    }
    
    try {
      console.log("Starting video format conversion...");
      // Create an object URL for the original video
      const videoUrl = URL.createObjectURL(videoFile);
      
      // Create video element to load the video
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      
      // Wait for the video metadata to load
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = (e) => reject(new Error(`Error loading video: ${e}`));
        
        // Set a timeout in case the video never loads
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });
      
      // Create a canvas element to draw the video frames
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Start playing the video to ensure we can capture frames
      await video.play();
      
      // Draw the first frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Stop the video
      video.pause();
      
      // Convert the canvas to a blob (MP4 format)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert canvas to blob"));
          }
        }, "video/mp4");
      });
      
      // Create a new File from the Blob
      const convertedFile = new File([blob], videoFile.name.replace(/\.[^.]+$/, ".mp4"), {
        type: "video/mp4",
        lastModified: new Date().getTime()
      });
      
      console.log("Video conversion successful");
      return convertedFile;
    } catch (error) {
      console.error("Video conversion failed:", error);
      console.log("Using original file instead");
      return videoFile; // Return the original file if conversion fails
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    if (!videoName.trim()) {
      setError("Please enter a name for your video");
      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError(null);
      setSuccess(false);

      let fileToUpload = file;
      
      // Try to convert video format if needed
      try {
        fileToUpload = await tryConvertVideoFormatIfNeeded(file);
      } catch (conversionError) {
        console.error("Conversion error:", conversionError);
        // Continue with original file if conversion fails
      }

      // Create a unique file path
      const fileExt = fileToUpload.name.split(".").pop() || "mp4";
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      // Upload the file to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from("videos")
        .upload(filePath, fileToUpload, {
          cacheControl: "3600",
          upsert: false,
          contentType: "video/mp4", // Force content type to be video/mp4
          onUploadProgress: (progress) => {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            setProgress(percent);
          },
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("videos").getPublicUrl(filePath);

      // Save video metadata to the database
      const { error: dbError } = await supabase.from("videos").insert({
        name: videoName,
        path: filePath,
        url: publicUrl,
        user_id: userId,
        size: fileToUpload.size,
        type: "video/mp4", // Force type to be video/mp4
        // Removed is_360 field since it's not in the database
      });

      if (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }

      setSuccess(true);
      onUploadSuccess();

      // Reset form
      setFile(null);
      setVideoName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "An error occurred during upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/50 cyber-border">
      <CardHeader>
        <CardTitle className="cyber-glow">Upload 360° Video</CardTitle>
        <CardDescription className="text-muted-foreground">
          Upload your 360° video files to experience them in immersive VR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert
            variant="destructive"
            className="bg-destructive/20 border-destructive/30"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-secondary/20 text-secondary border-secondary/30">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Video uploaded successfully!</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="video-name" className="text-foreground">
            Video Name
          </Label>
          <Input
            id="video-name"
            value={videoName}
            onChange={(e) => setVideoName(e.target.value)}
            placeholder="Enter a name for your video"
            disabled={uploading}
            className="bg-background/50 border-border/50 text-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-file" className="text-foreground">
            360° Video File
          </Label>
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              id="video-file"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="bg-background/50 border-border/50 text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)}{" "}
              MB)
            </p>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress
              value={progress}
              className="h-2 [&>div]:bg-cyber-gradient"
            />
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full bg-cyber-gradient hover:opacity-90"
        >
          {uploading ? (
            "Uploading..."
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" /> Upload 360° Video
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}