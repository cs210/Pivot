import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Folder } from "./useFolders";

export interface RawImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
  folder_id: string | null;
}

export function useRawImages(projectId: string) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
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
        .order("name", { ascending: true });

      if (error) throw error;
      setRawImages(data || []);
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
      const url = new URL(imageToDelete.url);
      const storagePath = url.pathname.split("/").slice(2).join("/");

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("raw_images")
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

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    currentFolder: Folder | null
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const filePath = `${projectId}/${fileName}`;

        console.log(`Uploading file: ${fileName} to path: ${filePath}`);

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("raw_images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          console.error("Storage upload error:", {
            message: uploadError.message,
            name: uploadError.name,
            code: uploadError.code,
            details: uploadError.details,
            hint: uploadError.hint,
            fullError: JSON.stringify(uploadError, null, 2),
          });
          throw uploadError;
        }

        console.log("File uploaded successfully:", uploadData?.path);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("raw_images")
          .getPublicUrl(uploadData.path);

        if (!urlData || !urlData.publicUrl) {
          console.error("Failed to get public URL for:", uploadData?.path);
          throw new Error("Failed to get public URL");
        }

        console.log("Public URL generated:", urlData.publicUrl);

        // Save to database
        const { data, error } = await supabase
          .from("raw_images")
          .insert([
            {
              name: fileName,
              project_id: projectId,
              url: urlData.publicUrl,
              folder_id: currentFolder?.id || null,
            },
          ])
          .select();

        if (error) {
          console.error("Database insert error:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: JSON.stringify(error, null, 2),
          });
          throw error;
        }

        console.log("Image record created in database:", data);

        // Add to local state
        if (data && data.length > 0) {
          setRawImages((prev) => [...prev, ...data]);
        }
      }

      alert("Images uploaded successfully");
    } catch (error) {
      console.error("Error uploading images:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        name: error.name,
        stack: error.stack,
        fullError: JSON.stringify(error, null, 2),
      });
      alert(`Failed to upload images: ${error.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFolderUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setFolders: (updateFn: (prev: Folder[]) => Folder[]) => void
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      // Group files by directory
      const filesByDirectory: Record<string, File[]> = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Get the path relative to the selected folder
        const relativePath = file.webkitRelativePath;
        const pathParts = relativePath.split("/");

        // Skip files deeper than 2 levels (main folder > subfolder > file)
        if (pathParts.length > 3) {
          console.warn(`Skipping file ${relativePath} - too deep in hierarchy`);
          continue;
        }

        const topLevelDir = pathParts[0];
        const secondLevelDir = pathParts.length > 2 ? pathParts[1] : null;

        // Determine which directory this file belongs to
        const dirKey = secondLevelDir
          ? `${topLevelDir}/${secondLevelDir}`
          : topLevelDir;

        if (!filesByDirectory[dirKey]) {
          filesByDirectory[dirKey] = [];
        }

        filesByDirectory[dirKey].push(file);
      }

      console.log("Files grouped by directory:", Object.keys(filesByDirectory));

      // Process each directory
      for (const [dirPath, dirFiles] of Object.entries(filesByDirectory)) {
        const pathParts = dirPath.split("/");
        const folderName = pathParts[pathParts.length - 1];

        console.log(
          `Processing folder: ${folderName} with ${dirFiles.length} files`
        );

        // Create folder if it doesn't exist
        const { data: folderData, error: folderError } = await supabase
          .from("folders")
          .insert([
            {
              name: folderName,
              project_id: projectId,
              parent_id: null, // Root level folder
            },
          ])
          .select();

        if (folderError) {
          console.error("Folder creation error:", {
            message: folderError.message,
            code: folderError.code,
            details: folderError.details,
            hint: folderError.hint,
            fullError: JSON.stringify(folderError, null, 2),
          });
          throw folderError;
        }

        if (!folderData || folderData.length === 0) {
          console.error("No folder data returned after insert");
          continue;
        }

        const folderId = folderData[0].id;
        console.log(`Created folder with ID: ${folderId}`);

        // Add folder to state
        setFolders((prev) => [...prev, ...folderData]);

        // Upload files for this folder
        for (const file of dirFiles) {
          const fileName = file.name;
          const filePath = `${projectId}/${folderId}/${fileName}`;

          console.log(`Uploading file: ${fileName} to path: ${filePath}`);

          // Upload to storage
          const { data: uploadData, error: uploadError } =
            await supabase.storage.from("raw_images").upload(filePath, file, {
              cacheControl: "3600",
              upsert: true,
            });

          if (uploadError) {
            console.error("Storage upload error:", {
              message: uploadError.message,
              name: uploadError.name,
              code: uploadError.code,
              details: uploadError.details,
              hint: uploadError.hint,
              fullError: JSON.stringify(uploadError, null, 2),
            });
            throw uploadError;
          }

          console.log("File uploaded successfully:", uploadData?.path);

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("raw_images")
            .getPublicUrl(uploadData.path);

          // Save to database
          const { data, error } = await supabase
            .from("raw_images")
            .insert([
              {
                name: fileName,
                project_id: projectId,
                url: urlData.publicUrl,
                folder_id: folderId,
              },
            ])
            .select();

          if (error) {
            console.error("Database insert error:", {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              fullError: JSON.stringify(error, null, 2),
            });
            throw error;
          }

          // Add to local state
          if (data && data.length > 0) {
            setRawImages((prev) => [...prev, ...data]);
          }
        }
      }

      alert("Folders and images uploaded successfully");
    } catch (error) {
      console.error("Error uploading folders:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        name: error.name,
        stack: error.stack,
        fullError: JSON.stringify(error, null, 2),
      });
      alert(`Failed to upload folders: ${error.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      // Reset the folder input
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
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
    rawImages,
    setRawImages,
    selectedImages,
    setSelectedImages,
    viewMode,
    setViewMode,
    uploading,
    setUploading,
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
    fileInputRef,
    folderInputRef,
    fetchRawImages,
    handleRenameImage,
    handleDeleteImage,
    handleMoveImages,
    handleFileUpload,
    handleFolderUpload,
    toggleImageSelection,
    getCurrentFolderImages,
    getRootImages,
    getImagesInFolder
  };
}