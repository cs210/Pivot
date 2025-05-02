import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Folder } from "./useFolders";
import {
  getCachedRawImages,
  cacheRawImages,
  addRawImageToCache,
  removeRawImageFromCache,
  updateRawImageInCache
} from "./cache-service";

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
        .order("filename", { ascending: true });

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
        .update({ filename: newImageName.trim() })
        .eq("id", imageToRename.id);

      if (error) throw error;

      const updatedImages = rawImages.map((img) =>
        img.id === imageToRename.id
          ? { ...img, filename: newImageName.trim() }
          : img
      );
      
      // Update state
      setRawImages(updatedImages);
      
      // Update cache
      updateRawImageInCache(projectId, imageToRename.id, { filename: newImageName.trim() });

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
      
      // Update cache
      removeRawImageFromCache(projectId, imageId);

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
        
        // Update cache for each image
        updateRawImageInCache(projectId, image.id, { folder_id: targetFolderId });
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

  // Function to handle image upload
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const filePath = `${projectId}/${fileName}`;

        console.log(`Uploading image: ${fileName} to path: ${filePath}`);

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("raw_images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }

        // Create thumbnail and upload
        const { data: thumbnailData, error: thumbnailError } = await supabase.storage
          .from("thumbnails")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            // You might want to add transformation options for actual thumbnails
          });

        if (thumbnailError) {
          console.error("Thumbnail upload error:", thumbnailError);
          // Continue without thumbnail if there's an error
        }

        // Get signed URL for raw image
        const { data: urlData } = await supabase.storage
          .from("raw_images")
          .createSignedUrl(uploadData.path, 3600); // 1 hour expiration

        // Get signed URL for thumbnail if available
        let thumbnailUrl = null;
        if (thumbnailData) {
          const { data: thumbUrlData } = await supabase.storage
            .from("thumbnails")
            .createSignedUrl(thumbnailData.path, 3600);
          
          thumbnailUrl = thumbUrlData?.signedUrl || null;
        }

        // Save to database
        const { data, error } = await supabase
          .from("raw_images")
          .insert([
            {
              filename: fileName,
              project_id: projectId,
              storage_path: uploadData.path,
              content_type: file.type,
              size_bytes: file.size,
              metadata: {},
              folder_id: null, // Can be updated later when moving
              panorama_id: null,
              user_id: (await supabase.auth.getUser()).data.user?.id,
            },
          ])
          .select();

        if (error) {
          console.error("Database insert error:", error);
          throw error;
        }

        // Add to local state with URL
        if (data && data.length > 0) {
          const newImage = {
            ...data[0],
            url: urlData?.signedUrl,
            thumbnail_url: thumbnailUrl
          };
          
          // Update state
          setRawImages((prev) => [...prev, newImage]);
          
          // Update cache
          addRawImageToCache(projectId, newImage);
        }
      }

      alert("Images uploaded successfully");
    } catch (error) {
      console.error("Error uploading images:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to upload images: ${errorMessage}`);
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    getImagesInFolder
  };
}