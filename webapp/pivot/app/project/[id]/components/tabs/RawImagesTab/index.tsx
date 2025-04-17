import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useFolders } from "../../../hooks/useFolders";
import FolderSidebar from "./FolderSidebar";
import ImageGrid from "./ImageGrid";
import CreateFolderDialog from "./dialogs/CreateFolderDialog";
import RenameFolderDialog from "./dialogs/RenameFolderDialog";
import RenameImageDialog from "./dialogs/RenameImageDialog";
import MoveImageDialog from "./dialogs/MoveImageDialog";

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
}

interface RawImagesTabProps {
  projectId: string;
}

export default function RawImagesTab({ projectId }: RawImagesTabProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Image management
  const [rawImages, setRawImages] = useState<RawImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog states
  const [renameImageDialogOpen, setRenameImageDialogOpen] = useState(false);
  const [moveImageDialogOpen, setMoveImageDialogOpen] = useState(false);
  const [imageToRename, setImageToRename] = useState<RawImage | null>(null);
  const [newImageName, setNewImageName] = useState("");
  const [imagesToMove, setImagesToMove] = useState<RawImage[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Use the folders hook
  const {
    folders,
    setFolders,
    currentFolder,
    setCurrentFolder,
    newFolderName,
    setNewFolderName,
    createFolderDialogOpen,
    setCreateFolderDialogOpen,
    renameFolderDialogOpen,
    setRenameFolderDialogOpen,
    folderToRename,
    setFolderToRename,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder
  } = useFolders(projectId);

  useEffect(() => {
    fetchRawImages();
  }, [projectId]);

  const fetchRawImages = async () => {
    try {
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
          .from("raw-images")
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

  // Rename in database; not in storage
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

      setRawImages(
        rawImages.map((img) =>
          img.id === imageToRename.id
            ? { ...img, filename: newImageName.trim() }
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

      // Delete from storage
      if (imageToDelete.storage_path) {
        const { error: storageError } = await supabase.storage
          .from("raw-images")
          .remove([imageToDelete.storage_path]);

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

        console.log(`Uploading file: ${fileName} to path: ${filePath}`);

        // Make sure you're using the correct bucket name
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("raw-images") // Must match exactly the bucket name in your Supabase dashboard
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

        // Get URL (note: raw-images bucket is private according to policies)
        const { data: urlData } = await supabase.storage
          .from("raw-images")
          .createSignedUrl(uploadData.path, 3600); // 1 hour expiration

        // Save to database
        const { data, error } = await supabase
          .from("raw_images")
          .insert([
            {
              filename: fileName,
              storage_path: uploadData.path,
              project_id: projectId,
              folder_id: currentFolder?.id || null,
              user_id: (await supabase.auth.getUser()).data.user?.id, // Required field
              content_type: file.type, // Required field
              size_bytes: file.size, // Required field
              metadata: {} // Required field but can be empty
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

        // Add to local state with proper mapping
        if (data && data.length > 0) {
          const formattedData = data.map(img => ({
            ...img,
            name: img.filename, // Add name for component compatibility
            url: img.storage_path // Add url for component compatibility
          }));
          
          setRawImages((prev) => [...prev, ...formattedData]);
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
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      // Group files by directory
      const filesByDirectory: Record<string, File[]> = {};

      // First pass: analyze the structure to determine if it's a flat folder or has subfolders
      let hasSubfolders = false;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath;
        const pathParts = relativePath.split("/");
        
        if (pathParts.length > 2) {
          hasSubfolders = true;
          break;
        }
      }

      // Second pass: organize files based on the structure
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Skip .DS_Store and non-image files
        const isJpegImage = /\.(jpg|jpeg|jpe|jfif)$/i.test(file.name);
        if (file.name === '.DS_Store' || !isJpegImage) {
          console.log(`Skipping file ${file.name} - not a JPEG image`);
          continue;
        }
        
        // Get the path relative to the selected folder
        const relativePath = file.webkitRelativePath;
        const pathParts = relativePath.split("/");
        
        // Skip files deeper than 3 levels (main folder > subfolder > file)
        if (pathParts.length > 3) {
          console.log(`Skipping file ${file.name} - too deep in hierarchy`);
          continue;
        }

        let folderKey;
        
        if (hasSubfolders) {
          // If we have subfolders, use the subfolder name as the key
          // and skip the parent folder
          if (pathParts.length <= 2) {
            // This is a file directly in the parent folder, skip it
            console.log(`Skipping file ${file.name} - in parent folder when uploading subfolders`);
            continue;
          }
          folderKey = pathParts[1]; // Use the subfolder name
        } else {
          // If it's just a flat folder with images, use the top folder name
          folderKey = pathParts[0];
        }
        
        if (!filesByDirectory[folderKey]) {
          filesByDirectory[folderKey] = [];
        }

        filesByDirectory[folderKey].push(file);
      }

      console.log("Folders to create:", Object.keys(filesByDirectory));

      // Process each folder
      for (const [folderName, folderFiles] of Object.entries(filesByDirectory)) {
        // Check if this folder already exists under the current folder
        const { data: existingFolders } = await supabase
          .from("folders")
          .select("id")
          .eq("name", folderName)
          .eq("project_id", projectId)
          .eq("parent_id", currentFolder?.id || null);
        
        let folderId;
        
        if (existingFolders && existingFolders.length > 0) {
          // Folder exists, use its ID
          folderId = existingFolders[0].id;
        } else {
          // Create the folder directly under current folder
          const { data: newFolder, error: folderError } = await supabase
            .from("folders")
            .insert([
              {
                name: folderName,
                project_id: projectId,
                parent_id: currentFolder?.id || null, // Directly under current folder
              },
            ])
            .select();
          
          if (folderError) {
            console.error("Folder creation error:", folderError);
            throw folderError;
          }
          
          if (!newFolder || newFolder.length === 0) {
            console.error("No folder data returned after insert");
            continue;
          }
          
          folderId = newFolder[0].id;
          
          // Add folder to state
          setFolders((prev) => [...prev, ...newFolder]);
        }
        
        // Upload files for this folder
        for (const file of folderFiles) {
          const fileName = file.name;
          const filePath = `${projectId}/folders/${folderId}/${fileName}`;

          console.log(`Uploading file: ${fileName} to path: ${filePath}`);

          // Upload to storage
          const { data: uploadData, error: uploadError } =
            await supabase.storage.from("raw-images").upload(filePath, file, {
              cacheControl: "3600",
              upsert: true,
            });

          if (uploadError) {
            console.error("Storage upload error:", uploadError);
            throw uploadError;
          }

          console.log("File uploaded successfully:", uploadData?.path);

          // Get URL
          const { data: urlData } = await supabase.storage
            .from("raw-images")
            .createSignedUrl(uploadData.path, 3600); // 1 hour expiration

          // Save to database
          const { data, error } = await supabase
            .from("raw_images")
            .insert([
              {
                filename: fileName,
                storage_path: uploadData.path,
                project_id: projectId,
                folder_id: folderId,
                user_id: (await supabase.auth.getUser()).data.user?.id,
                content_type: file.type,
                size_bytes: file.size,
                metadata: {}
              },
            ])
            .select();

          if (error) {
            console.error("Database insert error:", error);
            throw error;
          }

          // Add to local state
          if (data && data.length > 0) {
            const imagesWithUrls = data.map(img => ({
              ...img,
              url: urlData?.signedUrl // Add the signed URL for display
            }));
            setRawImages((prev) => [...prev, ...imagesWithUrls]);
          }
        }
      }

      alert("Folders and images uploaded successfully");
    } catch (error) {
      console.error("Error uploading folders:", error);
      alert(`Failed to upload folders: ${error.message || "Unknown error"}`);
    } finally {
      setUploading(false);
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
  const getCurrentFolderImages = () => {
    return rawImages.filter((img) => img.folder_id === currentFolder?.id);
  };

  // Get root level images (no folder)
  const getRootImages = () => {
    return rawImages.filter((img) => img.folder_id === null);
  };

  // Count images in a folder for the delete confirmation
  const getImagesInFolder = (folderId: string) => {
    return rawImages.filter((img) => img.folder_id === folderId);
  };

  // Custom delete handler for folders that counts and deletes images inside
  const handleDeleteFolderWithImages = async (folderId: string) => {
    const folderImages = getImagesInFolder(folderId);
    
    await handleDeleteFolder(
      folderId, 
      folderImages.length, 
      0, // No panoramas in this context 
      handleDeleteImage,
      () => {} // Empty function for panoramas
    );
    
    // Delete the images if folder deletion was successful
    for (const image of folderImages) {
      await handleDeleteImage(image.id, false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Folders sidebar */}
      <FolderSidebar
        folders={folders}
        currentFolder={currentFolder}
        setCurrentFolder={setCurrentFolder}
        setFolderToRename={setFolderToRename}
        setNewFolderName={setNewFolderName}
        setRenameFolderDialogOpen={setRenameFolderDialogOpen}
        setCreateFolderDialogOpen={setCreateFolderDialogOpen}
        handleDeleteFolder={handleDeleteFolderWithImages}
      />

      {/* Images content area */}
      <ImageGrid
        rawImages={rawImages}
        currentFolder={currentFolder}
        selectedImages={selectedImages}
        viewMode={viewMode}
        setViewMode={setViewMode}
        uploading={uploading}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        toggleImageSelection={toggleImageSelection}
        handleFileUpload={handleFileUpload}
        handleFolderUpload={handleFolderUpload}
        handleDeleteImage={handleDeleteImage}
        setImageToRename={setImageToRename}
        setNewImageName={setNewImageName}
        setRenameImageDialogOpen={setRenameImageDialogOpen}
        setImagesToMove={setImagesToMove}
        setMoveImageDialogOpen={setMoveImageDialogOpen}
        getCurrentFolderImages={getCurrentFolderImages}
        getRootImages={getRootImages}
      />

      {/* Dialogs */}
      <CreateFolderDialog
        open={createFolderDialogOpen}
        setOpen={setCreateFolderDialogOpen}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleCreateFolder={handleCreateFolder}
      />

      <RenameFolderDialog
        open={renameFolderDialogOpen}
        setOpen={setRenameFolderDialogOpen}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleRenameFolder={handleRenameFolder}
      />

      <RenameImageDialog
        open={renameImageDialogOpen}
        setOpen={setRenameImageDialogOpen}
        newImageName={newImageName}
        setNewImageName={setNewImageName}
        handleRenameImage={handleRenameImage}
      />

      <MoveImageDialog
        open={moveImageDialogOpen}
        setOpen={setMoveImageDialogOpen}
        folders={folders}
        targetFolderId={targetFolderId}
        setTargetFolderId={setTargetFolderId}
        imagesToMove={imagesToMove}
        handleMoveImages={handleMoveImages}
      />
    </div>
  );
}