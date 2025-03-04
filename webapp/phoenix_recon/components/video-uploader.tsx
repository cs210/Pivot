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
        setError("File size exceeds 100MB limit");
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

      // Create a unique file path
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      // Upload the file to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from("videos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
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
        size: file.size,
        type: file.type,
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
        <CardTitle className="cyber-glow">Upload Video</CardTitle>
        <CardDescription className="text-muted-foreground">
          Upload your video files to your personal library
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
            Video File
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
              <Upload className="mr-2 h-4 w-4" /> Upload Video
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
