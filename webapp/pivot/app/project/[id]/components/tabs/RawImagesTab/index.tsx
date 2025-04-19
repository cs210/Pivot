import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useFolders } from "../../../hooks/useFolders";
import { useRawImages } from "../../../hooks/useRawImages";
import FolderSidebar from "./FolderSidebar";
import ImageGrid from "./ImageGrid";
import CreateFolderDialog from "./dialogs/CreateFolderDialog";
import RenameFolderDialog from "./dialogs/RenameFolderDialog";
import RenameImageDialog from "./dialogs/RenameImageDialog";
import MoveImageDialog from "./dialogs/MoveImageDialog";

interface RawImagesTabProps {
  projectId: string;
}

export default function RawImagesTab({ projectId }: RawImagesTabProps) {
  const supabase = createClient();

  // Use the raw images hook
  const {
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
    fetchRawImages,
    handleRenameImage,
    handleDeleteImage,
    handleMoveImages,
    toggleImageSelection,
    getCurrentFolderImages,
    getRootImages,
    getImagesInFolder
  } = useRawImages(projectId);

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
    deleteFolderDialogOpen,
    setDeleteFolderDialogOpen,
    folderToRename,
    setFolderToRename,
    folderToDelete,
    setFolderToDelete,
    folderInputRef,
    fetchFolders,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder
  } = useFolders(projectId);

  useEffect(() => {
    fetchRawImages();
  }, [projectId]);

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
            // code: uploadError.code, // Removed as 'code' does not exist on 'StorageError'
            // details: uploadError.details, // Removed as 'details' does not exist on 'StorageError'
            // hint: uploadError.hint, // Removed as 'hint' does not exist on 'StorageError'
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
            message: error instanceof Error ? error.message : "Unknown error",
            code: error instanceof Error ? (error as any).code : "Unknown code",
            details: error instanceof Error && 'details' in error ? (error as any).details : undefined,
            hint: error instanceof Error && 'hint' in error ? (error as any).hint : undefined,
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
        message: error instanceof Error ? error.message : "Unknown error",
        code: error instanceof Error ? (error as any).code : "Unknown code",
        details: error instanceof Error && 'details' in error ? (error as any).details : undefined,
        hint: error instanceof Error && 'hint' in error ? (error as any).hint : undefined,
        name: error instanceof Error ? error.name : "Unknown name",
        stack: error instanceof Error ? error.stack : undefined,
        fullError: JSON.stringify(error, null, 2),
      });
      if (error instanceof Error) {
        alert(`Failed to upload images: ${error.message}`);
      } else {
        alert("Failed to upload images: Unknown error");
      }
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
              message: error instanceof Error ? error.message : "Unknown error",
              code: error instanceof Error && 'code' in error ? (error as any).code : "Unknown code",
              details: error instanceof Error && 'details' in error ? (error as any).details : undefined,
              hint: error instanceof Error && 'hint' in error ? (error as any).hint : undefined,
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
        message: error instanceof Error ? error.message : "Unknown error",
        code: error instanceof Error && 'code' in error ? (error as any).code : "Unknown code",
        details: error instanceof Error && 'details' in error ? (error as any).details : undefined,
        hint: typeof error === "object" && error !== null && "hint" in error ? (error as any).hint : undefined,
        name: error instanceof Error ? error.name : "Unknown name",
        stack: error instanceof Error ? error.stack : undefined,
        fullError: JSON.stringify(error, null, 2),
      });
      if (error instanceof Error) {
        alert(`Failed to upload folders: ${error.message}`);
      } else {
        alert("Failed to upload folders: Unknown error");
      }
    } finally {
      setUploading(false);
      // Reset the folder input
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    }
  };

  // Custom delete handler for folders that counts and deletes images inside
  const handleDeleteFolderWithImages = async (folderId: string) => {
    const folderImages = getImagesInFolder(folderId);

    // Check if folder has images
    if (folderImages.length > 0) {
      const confirmDelete = window.confirm(
        `This folder contains ${folderImages.length} images. Deleting it will also delete all contents inside. Continue?`
      );

      if (!confirmDelete) return;
    }
    
    await handleDeleteFolder(folderId);
    
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
        getCurrentFolderImages={() => getCurrentFolderImages(currentFolder)}
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