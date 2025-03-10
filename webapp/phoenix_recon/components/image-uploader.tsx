"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Upload,
  X,
  Check,
  Image,
  FolderPlus,
  MapPin,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  // Single file states
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageName, setImageName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Multiple files states
  const [files, setFiles] = useState<File[]>([]);
  const [locationName, setLocationName] = useState("");
  const [createLocation, setCreateLocation] = useState(true);
  const [uploadingMultiple, setUploadingMultiple] = useState(false);
  const [multipleUploadProgress, setMultipleUploadProgress] = useState(0);
  const [multipleUploadError, setMultipleUploadError] = useState<string | null>(
    null
  );
  const [multipleUploadSuccess, setMultipleUploadSuccess] = useState(false);

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

  const handleMultipleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Check file sizes and convert to array
    const fileArray: File[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.size > 10 * 1024 * 1024) {
        setMultipleUploadError(`File "${file.name}" exceeds 10MB size limit`);
        return;
      }
      fileArray.push(file);
    }

    setFiles(fileArray);
    setMultipleUploadError(null);
  };

  const clearFile = () => {
    setFile(null);
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const handleUpload = async () => {
    if (!file || !userId) return;

    try {
      // ...existing code for single file upload...
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

  const handleMultipleUpload = async () => {
    if (!files.length || !userId) return;

    try {
      setMultipleUploadError(null);
      setUploadingMultiple(true);
      setMultipleUploadProgress(0);

      let locationId: string | null = null;

      // Create a new location if requested
      if (createLocation && locationName) {
        setMultipleUploadProgress(10);
        const { data, error } = await supabase
          .from("locations")
          .insert({
            name: locationName,
            description: `Created with ${files.length} images`,
            user_id: userId,
          })
          .select();

        if (error) {
          throw new Error(`Failed to create location: ${error.message}`);
        }

        locationId = data?.[0]?.id || null;
      }

      setMultipleUploadProgress(20);

      // Upload all files and collect their IDs
      const uploadedImageIds: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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

        if (uploadError)
          throw new Error(
            `Upload failed for ${file.name}: ${uploadError.message}`
          );

        // Get the URL
        const { data: publicUrlData } = supabase.storage
          .from("images")
          .getPublicUrl(filePath);

        if (!publicUrlData || !publicUrlData.publicUrl) {
          throw new Error("Failed to get public URL");
        }

        // Save to database
        const { data, error: dbError } = await supabase
          .from("images")
          .insert({
            name: file.name.split(".")[0],
            user_id: userId,
            url: publicUrlData.publicUrl,
            path: filePath,
            content_type: file.type,
            size: file.size,
          })
          .select();

        if (dbError)
          throw new Error(
            `Database error for ${file.name}: ${dbError.message}`
          );

        if (data && data[0]) {
          uploadedImageIds.push(data[0].id);
        }

        // Update progress
        setMultipleUploadProgress(
          20 + Math.floor(((i + 1) / files.length) * 60)
        );
      }

      // If we have a location ID, associate all images with it
      if (locationId && uploadedImageIds.length > 0) {
        setMultipleUploadProgress(80);

        // Create location_images records for each uploaded image
        const locationImagesData = uploadedImageIds.map((imageId) => ({
          location_id: locationId,
          image_id: imageId,
        }));

        const { error } = await supabase
          .from("location_images")
          .insert(locationImagesData);

        if (error)
          throw new Error(
            `Failed to associate images with location: ${error.message}`
          );
      }

      setMultipleUploadProgress(100);
      setMultipleUploadSuccess(true);
      onUploadSuccess();

      // Reset form after 2 seconds
      setTimeout(() => {
        setFiles([]);
        setLocationName("");
        setMultipleUploadSuccess(false);
        setMultipleUploadProgress(0);
      }, 2000);
    } catch (error: any) {
      console.error("Error uploading multiple images:", error);
      setMultipleUploadError(error.message || "Failed to upload images");
    } finally {
      setUploadingMultiple(false);
    }
  };

  return (
    <div className={embedded ? "w-full" : "max-w-3xl mx-auto"}>
      {!embedded ? (
        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6">
            <Tabs defaultValue="single">
              <TabsList className="mb-4">
                <TabsTrigger value="single">Single Image</TabsTrigger>
                <TabsTrigger value="multiple">Multiple Images</TabsTrigger>
              </TabsList>
              <TabsContent value="single" className="space-y-6">
                <SingleImageUploadForm />
              </TabsContent>
              <TabsContent value="multiple" className="space-y-6">
                <MultipleImagesUploadForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        // When embedded, don't use the Tabs but provide both options
        <div className="w-full py-2">
          <Tabs defaultValue="single">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="single" className="flex-1">
                Single Image
              </TabsTrigger>
              <TabsTrigger value="multiple" className="flex-1">
                Multiple Images
              </TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="space-y-6">
              <SingleImageUploadForm />
            </TabsContent>
            <TabsContent value="multiple" className="space-y-6">
              <MultipleImagesUploadForm />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );

  // Single image upload form
  function SingleImageUploadForm() {
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

  // Multiple images upload form
  function MultipleImagesUploadForm() {
    return (
      <div className="space-y-6">
        <div>
          <Label htmlFor="location-name">Create Location (Optional)</Label>
          <div className="flex items-center space-x-2 mt-2">
            <Checkbox
              id="create-location"
              checked={createLocation}
              onCheckedChange={(checked) => setCreateLocation(!!checked)}
              disabled={uploadingMultiple || multipleUploadSuccess}
            />
            <Label htmlFor="create-location" className="text-sm font-normal">
              Create a new location for these images
            </Label>
          </div>
          {createLocation && (
            <Input
              id="location-name"
              placeholder="Enter a name for your location"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              disabled={uploadingMultiple || multipleUploadSuccess}
              className="mt-2"
            />
          )}
        </div>

        <div>
          <Label htmlFor="multiple-image-files">Image Files</Label>
          {files.length === 0 ? (
            <div className="mt-1">
              <div
                className={`border-2 border-dashed border-border/50 rounded-lg p-6 flex flex-col items-center justify-center bg-background/30 ${
                  embedded ? "h-[200px]" : ""
                }`}
              >
                <Image className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-4">
                  Multiple PNG, JPG or WEBP files (max. 10MB each)
                </p>
                <Input
                  id="multiple-image-files"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleMultipleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("multiple-image-files")?.click()
                  }
                  className="cyber-border"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Select Images
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 border border-border rounded-lg p-4 bg-background/50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{files.length} files selected</p>
                  <p className="text-sm text-muted-foreground">
                    Total size:{" "}
                    {(
                      files.reduce((acc, file) => acc + file.size, 0) /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </div>
                {!uploadingMultiple && !multipleUploadSuccess && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearFiles}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="mt-3 max-h-36 overflow-y-auto border border-border/30 rounded p-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center text-sm py-1 border-b border-border/20 last:border-b-0"
                  >
                    <Image className="h-3 w-3 mr-2" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {multipleUploadError && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
            {multipleUploadError}
          </div>
        )}

        {uploadingMultiple && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading {files.length} files...</span>
              <span>{multipleUploadProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: `${multipleUploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div>
          <Button
            onClick={handleMultipleUpload}
            disabled={
              files.length === 0 ||
              uploadingMultiple ||
              multipleUploadSuccess ||
              (createLocation && !locationName.trim())
            }
            className={`w-full ${
              multipleUploadSuccess ? "bg-green-600" : "bg-cyber-gradient"
            }`}
          >
            {uploadingMultiple ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : multipleUploadSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Uploaded Successfully!
              </>
            ) : (
              <>
                {createLocation ? (
                  <FolderPlus className="mr-2 h-4 w-4" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {createLocation
                  ? `Upload to ${locationName || "New Location"}`
                  : `Upload ${files.length} Images`}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }
}
