import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Folder } from "./useFolders";
import {
  getCachedRawImages,
  cacheRawImages,
  addRawImageToCache,
  removeRawImageFromCache,
  updateRawImageInCache,
} from "./cache-service";
import { generateThumbnail } from "@/utils/generate-thumbnail";

export interface RawImage {
  id: string;
  name: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  metadata: Record<string, any>;
  project_id: string;
  folder_id: string | null;
  panorama_id: string | null;
  user_id: string;
  uploaded_at: string;
  updated_at: string;
  url?: string; // URL for displaying the image in the UI (to thumbnail)
}

export function useRawImages(projectId: string) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for raw images
  const [rawImages, setRawImages] = useState<RawImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [renameImageDialogOpen, setRenameImageDialogOpen] = useState(false);
  const [moveImageDialogOpen, setMoveImageDialogOpen] = useState(false);
  const [imageToRename, setImageToRename] = useState<RawImage | null>(null);
  const [newImageName, setNewImageName] = useState("");
  const [imagesToMove, setImagesToMove] = useState<RawImage[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  useEffect(() => {
    fetchRawImages();
  }, [projectId]);

  const fetchRawImages = async (forceRefresh = false) => {
    setLoading(true);

    try {
      // Check if we have cached images
      const cachedData = getCachedRawImages(projectId);

      if (cachedData && !forceRefresh) {
        console.log("Using cached raw images");
        setRawImages(cachedData);
        setLoading(false);
        return;
      }

      // If no cache or force refresh, fetch from database
      const { data, error } = await supabase
        .from("raw_images")
        .select("*")
        .eq("project_id", projectId)
        .order("name", { ascending: true });

      if (error) throw error;

      // Use Promise.all to handle multiple async operations in parallel
      const imagesWithUrls = await Promise.all(
        (data || []).map(async (img) => {
          // Get a URL for the image from storage. Signed URL for private bucket.
          const { data: urlData } = await supabase.storage
            .from("thumbnails-private")
            .createSignedUrl(img.storage_path, 3600); // 1 hour expiration

          return {
            ...img,
            url: urlData?.signedUrl,
          };
        })
      );

      // Update cache
      cacheRawImages(projectId, imagesWithUrls);

      // Update state
      setRawImages(imagesWithUrls);
    } catch (error) {
      console.error("Error fetching raw images:", error);
      setRawImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameImage = async () => {
    if (!newImageName.trim() || !imageToRename) {
      alert("Please enter an image name");
      return;
    }

    try {
      const { error } = await supabase
        .from("raw_images")
        .update({ name: newImageName.trim() })
        .eq("id", imageToRename.id);

      if (error) throw error;

      const updatedImages = rawImages.map((img) =>
        img.id === imageToRename.id
          ? { ...img, name: newImageName.trim() }
          : img
      );

      // Update state
      setRawImages(updatedImages);

      // Update cache
      updateRawImageInCache(projectId, imageToRename.id, {
        name: newImageName.trim(),
      });

      setRenameImageDialogOpen(false);
      setImageToRename(null);
      setNewImageName("");
      // USED TO BE ALERT()
      console.log("Image renamed successfully");
    } catch (error) {
      console.error("Error renaming image:", error);
      alert("Failed to rename image");
    }
  };

  const handleDeleteImage = async (imageId: string, showAlert = true) => {
    try {
      // First get the image to get the storage path
      const imageToDelete = rawImages.find((img) => img.id === imageId);

      if (!imageToDelete) {
        console.error(`Image with ID ${imageId} not found`);
        return;
      }

      // Delete from storage using the storage_path directly
      if (imageToDelete.storage_path) {
        // Delete original from raw_images bucket
        const { error: storageError } = await supabase.storage
          .from("raw-images")
          .remove([imageToDelete.storage_path]);

        if (storageError) {
          console.error(
            "Error removing from raw_images storage:",
            storageError
          );
          // Continue with deletion process even if storage removal fails
        }

        // Delete thumbnail from thumbnails-private bucket
        const { error: thumbnailError } = await supabase.storage
          .from("thumbnails-private")
          .remove([imageToDelete.storage_path]);

        if (thumbnailError) {
          console.error(
            "Error removing from thumbnails-private storage:",
            thumbnailError
          );
          // Continue with deletion process even if thumbnail removal fails
        }
      } else {
        console.warn(`No storage path found for image ${imageId}`);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("raw_images")
        .delete()
        .eq("id", imageId);

      if (dbError) {
        throw dbError;
      }

      // Update local state
      setRawImages(rawImages.filter((img) => img.id !== imageId));
      setSelectedImages(selectedImages.filter((id) => id !== imageId));

      // Update cache
      removeRawImageFromCache(projectId, imageId);

      if (showAlert) {
        // USED TO BE ALERT()
        console.log("Image deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      if (showAlert) {
        alert("Failed to delete image");
      }
    }
  };

  const handleMoveImages = async () => {
    if (imagesToMove.length === 0) return;

    try {
      // Update each image's folder_id
      for (const image of imagesToMove) {
        const { error } = await supabase
          .from("raw_images")
          .update({ folder_id: targetFolderId })
          .eq("id", image.id);

        if (error) throw error;

        // Update cache for each image
        updateRawImageInCache(projectId, image.id, {
          folder_id: targetFolderId,
        });
      }

      // Update local state
      setRawImages(
        rawImages.map((img) =>
          imagesToMove.some((moveImg) => moveImg.id === img.id)
            ? { ...img, folder_id: targetFolderId }
            : img
        )
      );

      setMoveImageDialogOpen(false);
      setImagesToMove([]);
      setTargetFolderId(null);
      // USED TO BE ALERT()
      console.log(`${imagesToMove.length} image(s) moved successfully`);
    } catch (error) {
      console.error("Error moving images:", error);
      alert("Failed to move images");
    }
  };

  // Enhanced function to handle image upload with optional folder ID
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    folder_id: string | null = null
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check if file is a JPG image
        if (file.type !== "image/jpeg" && file.type !== "image/jpg") {
          console.log(`Skipping non-JPG file: ${file.name}`);
          alert(`Only JPG images are supported. Skipping file: ${file.name}`);
          continue;
        }

        // First, create database entry to get the ID
        const { data: dbData, error: dbError } = await supabase
          .from("raw_images")
          .insert([
            {
              name: file.name,
              project_id: projectId,
              storage_path: null, // Will update this after storage upload
              content_type: file.type,
              size_bytes: file.size,
              metadata: {},
              folder_id: folder_id, // Use the passed folder ID
              panorama_id: null,
              user_id: (await supabase.auth.getUser()).data.user?.id,
            },
          ])
          .select();

        if (dbError) {
          console.error("Database insert error:", dbError);
          throw dbError;
        }

        if (!dbData || dbData.length === 0) {
          throw new Error("Failed to create database entry");
        }

        // Extract the unique ID from the database entry
        const imageId = dbData[0].id;

        // Use the unique ID in the filepath and add .jpg extension
        const filePath = `${projectId}/${imageId}.jpg`;

        console.log(
          `Uploading image: ${
            file.name
          } with ID: ${imageId} to path: ${filePath}${
            folder_id ? ` in folder: ${folder_id}` : ""
          }`
        );

        // Upload to storage with ID-based path
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("raw-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: "image/jpeg", // Explicitly set content type to image/jpeg
          });

        if (uploadError) {
          console.error("Raw image upload error:", uploadError);
          throw uploadError;
        }

        // Create and upload actual thumbnail
        console.log(`Creating thumbnail for: ${file.name}`);

        try {
          // Generate a proper thumbnail using the utility
          const thumbnailFile = await generateThumbnail(file, {
            maxDimension: 200,
            quality: 0.7,
            format: "image/jpeg",
            filename: `thumb_${file.name}`,
          });

          // Validate thumbnail
          if (!(thumbnailFile instanceof File)) {
            console.error(
              "Thumbnail generation failed: Not a valid File object"
            );
            throw new Error("Thumbnail generation failed");
          }

          // Upload the thumbnail with the same path as the main image
          const { data: thumbnailData, error: thumbnailError } =
            await supabase.storage
              .from("thumbnails-private")
              .upload(filePath, thumbnailFile, {
                cacheControl: "3600",
                upsert: true,
                contentType: "image/jpeg",
              });

          if (thumbnailError) {
            console.error("Thumbnail upload error:", thumbnailError);
            // Continue without thumbnail if there's an error
          }
        } catch (thumbError) {
          console.error("Error generating thumbnail:", thumbError);
          // Continue without thumbnail, we'll use the original instead
        }

        // Update the database entry with the storage path
        const { error: updateError } = await supabase
          .from("raw_images")
          .update({ storage_path: uploadData.path })
          .eq("id", imageId);

        if (updateError) {
          console.error("Failed to update storage path:", updateError);
          // Continue anyway since we have the file uploaded
        }

        // Get signed URL for thumbnail
        const { data: thumbUrlData } = await supabase.storage
          .from("thumbnails-private")
          .createSignedUrl(filePath, 3600);

        const thumbnailUrl = thumbUrlData?.signedUrl;

        // Create the final image object with URL
        const newImage = {
          ...dbData[0],
          url: thumbnailUrl || null,
          storage_path: uploadData.path,
        };

        // Update state - prevent duplicates by checking if image already exists
        setRawImages((prev) => {
          // Check if image already exists in array
          if (prev.some((img) => img.id === newImage.id)) {
            // Replace the existing image instead of adding a new one
            return prev.map((img) => (img.id === newImage.id ? newImage : img));
          } else {
            // Add as new image
            return [...prev, newImage];
          }
        });

        // Update cache
        addRawImageToCache(projectId, newImage);
      }
      // USED TO BE ALERT()
      console.log("Images uploaded successfully");
    } catch (error) {
      console.error("Error uploading images:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to upload images: ${errorMessage}`);
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }

    return true;
  };

  // Helper function to toggle image selection
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages((prev) =>
      prev.includes(imageId)
        ? prev.filter((id) => id !== imageId)
        : [...prev, imageId]
    );
  };

  // Get current folder images
  const getCurrentFolderImages = (currentFolder: Folder | null) => {
    return rawImages.filter((img) => img.folder_id === currentFolder?.id);
  };

  // Get root level images (no folder)
  const getRootImages = () => {
    return rawImages.filter((img) => img.folder_id === null);
  };

  // Get ALL images for the project regardless of folder
  const getAllImages = () => {
    return rawImages;
  };

  // Get images in a folder by folderId
  const getImagesInFolder = (folderId: string) => {
    return rawImages.filter((img) => img.folder_id === folderId);
  };

  return {
    // State variables
    rawImages,
    setRawImages,
    selectedImages,
    setSelectedImages,
    viewMode,
    setViewMode,
    uploading,
    setUploading,
    loading,

    // Dialog related states
    renameImageDialogOpen,
    setRenameImageDialogOpen,
    moveImageDialogOpen,
    setMoveImageDialogOpen,
    imageToRename,
    setImageToRename,
    newImageName,
    setNewImageName,
    imagesToMove,
    setImagesToMove,
    targetFolderId,
    setTargetFolderId,

    // Refs
    fileInputRef,

    // Main functions
    fetchRawImages,
    handleRenameImage,
    handleDeleteImage,
    handleMoveImages,
    handleImageUpload,

    // Helper functions
    toggleImageSelection,
    getCurrentFolderImages,
    getRootImages,
    getAllImages,
    getImagesInFolder,
  };
}
