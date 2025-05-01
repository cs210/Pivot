import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Folder } from "./useFolders";

export interface RawImage {
  id: string;
  filename: string;
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
  url?: string; // URL for displaying the image in the UI
  thumbnail_url?: string; // URL for displaying the thumbnail
}

export function useRawImages(projectId: string) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for raw images
  const [rawImages, setRawImages] = useState<RawImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploading, setUploading] = useState(false);
  
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

  const fetchRawImages = async () => {
    try {
      const { data, error } = await supabase
        .from("raw_images")
        .select("*")
        .eq("project_id", projectId)
        .order("filename", { ascending: true }); // Note: Changed from "name" to "filename" to match your component

      if (error) throw error;
      
      // Use Promise.all to handle multiple async operations in parallel
      const imagesWithUrls = await Promise.all((data || []).map(async (img) => {
        // Get a URL for the image from storage. Signed URL for private bucket.
        const { data: urlData } = await supabase.storage
          .from("thumbnails")
          .createSignedUrl(img.storage_path, 3600); // 1 hour expiration

        return {
          ...img,
          url: urlData?.signedUrl
        };
      }));
      
      setRawImages(imagesWithUrls);
    } catch (error) {
      console.error("Error fetching raw images:", error);
      setRawImages([]);
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

      setRawImages(
        rawImages.map((img) =>
          img.id === imageToRename.id
            ? { ...img, name: newImageName.trim() }
            : img
        )
      );

      setRenameImageDialogOpen(false);
      setImageToRename(null);
      setNewImageName("");
      alert("Image renamed successfully");
    } catch (error) {
      console.error("Error renaming image:", error);
      alert("Failed to rename image");
    }
  };

  const handleDeleteImage = async (imageId: string, showAlert = true) => {
    try {
      // First get the image to get the file path
      const imageToDelete = rawImages.find((img) => img.id === imageId);

      if (!imageToDelete) return;

      // Delete from storage (assuming the URL contains the path)
      if (!imageToDelete.url) {
        throw new Error("Image URL is undefined");
      }
      
      // if (!imageToDelete.thumbnail_url) {
      //   throw new Error("Thumbnail URL is undefined");
      // }

      const url = new URL(imageToDelete.url);
      const storagePath = url.pathname.split("/").slice(2).join("/");

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("raw_images")
          .remove([storagePath]);

        if (storageError) throw storageError;
      }
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("thumbnails")
          .remove([storagePath]);

        if (storageError) throw storageError;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("raw_images")
        .delete()
        .eq("id", imageId);

      if (dbError) throw dbError;

      // Update local state
      setRawImages(rawImages.filter((img) => img.id !== imageId));
      setSelectedImages(selectedImages.filter((id) => id !== imageId));

      if (showAlert) {
        alert("Image deleted successfully");
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
      alert(`${imagesToMove.length} image(s) moved successfully`);
    } catch (error) {
      console.error("Error moving images:", error);
      alert("Failed to move images");
    }
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
    
    // Helper functions
    toggleImageSelection,
    getCurrentFolderImages,
    getRootImages,
    getImagesInFolder
  };
}