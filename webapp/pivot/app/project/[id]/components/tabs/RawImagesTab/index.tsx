import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useFolders } from "../../../../../../hooks/useFolders";
import { useRawImages } from "../../../../../../hooks/useRawImages";
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
    viewMode,
    setViewMode,
    uploading,
    setUploading,
    renameImageDialogOpen,
    setRenameImageDialogOpen,
    moveImageDialogOpen,
    setMoveImageDialogOpen,
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
    getAllImages,
    getImagesInFolder,
    handleImageUpload
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
    setFolderToRename,
    folderInputRef,
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
    await handleImageUpload(event, currentFolder?.id || null);
  };

  const handleFolderUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      // First, analyze the file structure to understand the hierarchy
      const filesByPath: Record<string, File[]> = {};
      const directoryStructure: Record<string, Set<string>> = {}; // Parent directory -> child directories
      
      // Track directories that contain images directly
      const directoriesWithImages = new Set<string>();
      // Track directories that only contain other directories
      const emptyDirectories = new Set<string>();
      
      // Analyze the file structure
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath;
        
        if (!relativePath) {
          console.warn("No relative path found, skipping file", file.name);
          continue;
        }
        
        // Check if file is an image
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
          console.log(`Skipping non-image file: ${file.name}`);
          continue;
        }

        const pathParts = relativePath.split("/");
        
        // We only support up to 3 levels: root/subfolder/file.jpg
        if (pathParts.length > 3) {
          console.warn(`Skipping file ${relativePath} - too deep in hierarchy (max 3 levels)`);
          continue;
        }
        
        // Get directories in the path
        const rootDir = pathParts[0];
        const parentPath = pathParts.slice(0, -1).join('/');
        
        // Add file to its containing directory
        if (!filesByPath[parentPath]) {
          filesByPath[parentPath] = [];
        }
        filesByPath[parentPath].push(file);
        
        // Mark directory as containing images
        directoriesWithImages.add(parentPath);
        
        // Build directory structure
        if (pathParts.length > 2) {
          // This is a file in a subdirectory
          const subDir = pathParts[1];
          if (!directoryStructure[rootDir]) {
            directoryStructure[rootDir] = new Set();
          }
          directoryStructure[rootDir].add(subDir);
        }
      }
      
      // Identify directories that don't directly contain images
      for (const parentDir in directoryStructure) {
        if (!filesByPath[parentDir] || filesByPath[parentDir].length === 0) {
          emptyDirectories.add(parentDir);
        }
      }
      
      console.log("Directory analysis:", {
        directoriesWithImages: Array.from(directoriesWithImages),
        emptyDirectories: Array.from(emptyDirectories),
        filesByPath: Object.keys(filesByPath).map(path => `${path}: ${filesByPath[path].length} files`)
      });

      // Process directories with images, skipping empty root directories
      for (const dirPath of Array.from(directoriesWithImages)) {
        const pathParts = dirPath.split("/");
        
        // Skip the empty root directory if it only contains other directories
        if (pathParts.length === 1 && emptyDirectories.has(dirPath)) {
          console.log(`Skipping empty root directory: ${dirPath}`);
          continue;
        }
        
        // Get folder name from path
        const folderName = pathParts[pathParts.length - 1];
        
        // Determine parent folder ID
        let parentFolderId = null;
        
        if (pathParts.length > 1) {
          // This is a subdirectory, so we need to find or create its parent
          const parentFolderName = pathParts[pathParts.length - 2];
          
          // Create or get parent folder ID
          parentFolderId = await ensureFolderExists(parentFolderName);
        }

        // Create or get current folder ID
        const folderId = await ensureFolderExists(folderName, parentFolderId);

        // Upload files for this folder
        const filesToUpload = filesByPath[dirPath] || [];
        
        // Create a mock event for handleImageUpload
        for (const file of filesToUpload) {
          // Create a FileList-like object
          const mockFileList = {
            0: file,
            length: 1,
            item: (index: number) => index === 0 ? file : null
          } as unknown as FileList;
          
          // Create a mock event
          const mockEvent = {
            target: {
              files: mockFileList
            }
          } as React.ChangeEvent<HTMLInputElement>;
          
          // Call handleImageUpload with the folder ID
          await handleImageUpload(mockEvent, folderId);
        }
      }

      alert("Folders and images uploaded successfully");
    } catch (error) {
      console.error("Error uploading folders:", error);
      
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

  // Helper functions for folder uploads
  
  // Create or find a folder by name
  const ensureFolderExists = async (
    folderName: string, 
    parentFolderId: string | null = null
  ): Promise<string> => {
    // Check if folder already exists
    let { data: existingFolders } = await supabase
      .from("folders")
      .select("id")
      .eq("name", folderName)
      .eq("project_id", projectId)
      .eq("parent_id", parentFolderId);
      
    if (existingFolders && existingFolders.length > 0) {
      // Use existing folder
      console.log(`Using existing folder with ID: ${existingFolders[0].id}`);
      return existingFolders[0].id;
    }
    
    // Create new folder
    const { data: folderData, error: folderError } = await supabase
      .from("folders")
      .insert([
        {
          name: folderName,
          project_id: projectId,
          parent_id: parentFolderId,
        },
      ])
      .select();

    if (folderError) {
      console.error("Folder creation error:", folderError);
      throw folderError;
    }

    if (!folderData || folderData.length === 0) {
      console.error("No folder data returned after insert");
      throw new Error("Failed to create folder");
    }

    console.log(`Created folder with ID: ${folderData[0].id}`);

    // Add folder to state
    setFolders((prev) => [...prev, ...folderData]);
    
    return folderData[0].id;
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
        getAllImages={getAllImages}
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