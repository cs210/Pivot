"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Upload, X, Check, Image } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface ImageUploaderProps {
  onUploadSuccess: () => void;
  userId: string | undefined;
  embedded?: boolean; // Add a prop to indicate if the component is embedded in a dialog
}

export default function ImageUploader({
  onUploadSuccess,
  userId,
  embedded = false,
}: ImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageName, setImageName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setUploadError("File size should not exceed 10MB");
        return;
      }
      setFile(selectedFile);
      if (!imageName) {
        setImageName(selectedFile.name.split(".")[0]);
      }
      setUploadError(null);
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file || !userId) return;

    try {
      setUploadError(null);
      setUploading(true);
      setUploadProgress(0);

      const fileExt = file.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Simulate upload progress
      setUploadProgress(50);

      // Get the URL
      const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error("Failed to get public URL for the uploaded file");
      }

      setUploadProgress(75);

      // Save to database
      const { error: dbError } = await supabase.from("images").insert({
        name: imageName || file.name,
        user_id: userId,
        url: publicUrlData.publicUrl,
        path: filePath,
        content_type: file.type,
        size: file.size,
      });

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      setUploadProgress(100);
      setUploadSuccess(true);
      onUploadSuccess();

      // Reset form after 2 seconds
      setTimeout(() => {
        setFile(null);
        setImageName("");
        setUploadSuccess(false);
        setUploadProgress(0);
      }, 2000);
    } catch (error: any) {
      console.error("Error uploading image:", error);
      setUploadError(
        error.message || "Failed to upload image. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={embedded ? "w-full" : "max-w-3xl mx-auto"}>
      {!embedded ? (
        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6">
            {/* Render form content */}
            <ImageUploadForm />
          </CardContent>
        </Card>
      ) : (
        // When embedded, don't use the Card wrapper to save space
        <div className="w-full py-2">
          <ImageUploadForm />
        </div>
      )}
    </div>
  );

  // Extract the form content to a separate function component to avoid duplication
  function ImageUploadForm() {
    return (
      <div className="space-y-6">
        <div>
          <Label htmlFor="image-name">Image Name</Label>
          <Input
            id="image-name"
            placeholder="Enter a name for your image"
            value={imageName}
            onChange={(e) => setImageName(e.target.value)}
            disabled={uploading || uploadSuccess}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="image-file">Image File</Label>
          {!file ? (
            <div className="mt-1">
              <div
                className={`border-2 border-dashed border-border/50 rounded-lg p-6 flex flex-col items-center justify-center bg-background/30 ${
                  embedded ? "h-[200px]" : ""
                }`}
              >
                <Image className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-4">
                  PNG, JPG or WEBP (max. 10MB)
                </p>
                <Input
                  id="image-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("image-file")?.click()}
                  className="cyber-border"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Select Image
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 border border-border rounded-lg p-4 bg-background/50">
              <div
                className={`flex ${
                  embedded ? "flex-col md:flex-row" : "items-start"
                } justify-between`}
              >
                <div
                  className={`flex ${
                    embedded ? "flex-col md:flex-row" : ""
                  } items-center space-x-3`}
                >
                  <div
                    className={`${
                      embedded ? "w-full h-36 md:w-36 md:h-36" : "w-10 h-10"
                    } rounded bg-primary/10 flex items-center justify-center overflow-hidden`}
                  >
                    {file && URL.createObjectURL(file) ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Image className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="ml-3 mt-2 md:mt-0">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!uploading && !uploadSuccess && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearFile}
                    className="shrink-0 mt-2 md:mt-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
            {uploadError}
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading || uploadSuccess || !imageName}
            className={`w-full ${
              uploadSuccess ? "bg-green-600" : "bg-cyber-gradient"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : uploadSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Uploaded Successfully!
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }
}
