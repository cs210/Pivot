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
import { generateThumbnail } from "@/utils/generate-thumbnail";

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
        const { data: uploadDataRaw, error: uploadErrorRaw } = await supabase.storage
          .from("raw-images") // Must match exactly the bucket name in your Supabase dashboard
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadErrorRaw) {
          console.error("Storage upload error for raw image:", {
            message: uploadErrorRaw.message,
            name: uploadErrorRaw.name,
            fullError: JSON.stringify(uploadErrorRaw, null, 2),
          });
          throw uploadErrorRaw;
        }

        console.log(`Creating thumbnail for file: ${fileName}`);
          
        // Turn file into thumbnail
        // Use downsampling to make it a lot smaller
        const thumbnailFile = await generateThumbnail(file, {
          maxDimension: 200,
          quality: 0.7,
          format: 'image/jpeg',
          filename: `thumb_${fileName}`
        });

        // Confirm that thumbnailFile is a valid File object
        if (!(thumbnailFile instanceof File)) {
          console.error("Thumbnail generation failed: Not a valid File object");
          throw new Error("Thumbnail generation failed: Not a valid File object");
        }

        const { data: uploadDataThumb, error: uploadErrorThumb } = await supabase.storage
          .from("thumbnails") // Must match exactly the bucket name in your Supabase dashboard
          .upload(filePath, thumbnailFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadErrorThumb) {
          console.error("Storage upload error:", {
            message: uploadErrorThumb.message,
            name: uploadErrorThumb.name,
            fullError: JSON.stringify(uploadErrorThumb, null, 2),
          });
          throw uploadErrorThumb;
        }

        console.log("File uploaded successfully:", uploadDataRaw?.path);

        // Get URL (note: raw-images bucket is private according to policies)
        const { data: urlDataRaw } = await supabase.storage
          .from("raw-images")
          .createSignedUrl(uploadDataRaw.path, 3600); // 1 hour expiration

        const { data: urlDataThumb } = await supabase.storage
          .from("thumbnails")
          .createSignedUrl(uploadDataThumb.path, 3600); // 1 hour expiration

        // Save to database
        const { data, error } = await supabase
          .from("raw_images")
          .insert([
            {
              filename: fileName,
              storage_path: uploadDataRaw.path,
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
            url: urlDataThumb?.signedUrl, // Add url for component compatibility
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
      // First, analyze the file structure to understand the hierarchy
      const filesByPath: Record<string, File[]> = {};
      const directoryStructure: Record<string, Set<string>> = {}; // Parent directory -> child directories
      
      // Track directories that contain images directly
      const directoriesWithImages = new Set<string>();
      // Track directories that only contain other directories
      const emptyDirectories = new Set<string>();
      
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
          
          // Check if parent folder exists
          let { data: existingParentFolders } = await supabase
            .from("folders")
            .select("id")
            .eq("name", parentFolderName)
            .eq("project_id", projectId)
            .eq("parent_id", currentFolder?.id || null);
            
          if (existingParentFolders && existingParentFolders.length > 0) {
            parentFolderId = existingParentFolders[0].id;
          } else {
            // Create parent folder if it doesn't exist and isn't an empty directory
            if (!emptyDirectories.has(parentFolderName)) {
              const { data: parentFolderData, error: parentFolderError } = await supabase
                .from("folders")
                .insert([
                  {
                    name: parentFolderName,
                    project_id: projectId,
                    parent_id: currentFolder?.id || null,
                  },
                ])
                .select();

              if (parentFolderError) {
                console.error("Parent folder creation error:", parentFolderError);
                throw parentFolderError;
              }

              if (parentFolderData && parentFolderData.length > 0) {
                parentFolderId = parentFolderData[0].id;
                // Add new parent folder to state
                setFolders(prev => [...prev, ...parentFolderData]);
              }
            }
          }
        }

        // Check if current folder exists
        let { data: existingFolders } = await supabase
          .from("folders")
          .select("id")
          .eq("name", folderName)
          .eq("project_id", projectId)
          .eq("parent_id", parentFolderId);
          
        let folderId;
          
        if (existingFolders && existingFolders.length > 0) {
          // Use existing folder
          folderId = existingFolders[0].id;
          console.log(`Using existing folder with ID: ${folderId}`);
        } else {
          // Create folder if it doesn't exist
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
            continue;
          }

          folderId = folderData[0].id;
          console.log(`Created folder with ID: ${folderId}`);

          // Add folder to state
          setFolders(prev => [...prev, ...folderData]);
        }

        // Upload files for this folder
        const filesToUpload = filesByPath[dirPath] || [];
        
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = files[i];
          const fileName = file.name;
          const filePath = `${projectId}/${fileName}`;

          console.log(`Uploading file: ${fileName} to path: ${filePath}`);

        // Make sure you're using the correct bucket name
        const { data: uploadDataRaw, error: uploadErrorRaw } = await supabase.storage
          .from("raw-images") // Must match exactly the bucket name in your Supabase dashboard
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        console.log(`Creating thumbnail for file: ${fileName}`);
          
        // Turn file into thumbnail
        // Use downsampling to make it a lot smaller
        const thumbnailFile = await generateThumbnail(file, {
          maxDimension: 200,
          quality: 0.7,
          format: 'image/jpeg',
          filename: `thumb_${fileName}`
        });

        // Confirm that thumbnailFile is a valid File object
        if (!(thumbnailFile instanceof File)) {
          console.error("Thumbnail generation failed: Not a valid File object");
          throw new Error("Thumbnail generation failed: Not a valid File object");
        }

        const { data: uploadDataThumb, error: uploadErrorThumb } = await supabase.storage
          .from("thumbnails") // Must match exactly the bucket name in your Supabase dashboard
          .upload(filePath, thumbnailFile, {
            cacheControl: "3600",
            upsert: true,
          });

          if (uploadErrorRaw) {
            console.error("Storage upload error:", {
              message: uploadErrorRaw.message,
              name: uploadErrorRaw.name,
              fullError: JSON.stringify(uploadErrorRaw, null, 2),
            });
            throw uploadErrorRaw;
          }
  
          if (uploadErrorThumb) {
            console.error("Storage upload error:", {
              message: uploadErrorThumb.message,
              name: uploadErrorThumb.name,
              fullError: JSON.stringify(uploadErrorThumb, null, 2),
            });
            throw uploadErrorThumb;
          }

          console.log("File uploaded successfully:", uploadDataRaw?.path);

          // Get URL (note: raw-images bucket is private according to policies)
          const { data: urlDataRaw } = await supabase.storage
          .from("raw-images")
          .createSignedUrl(uploadDataRaw.path, 3600); // 1 hour expiration

        const { data: urlDataThumb } = await supabase.storage
          .from("thumbnails")
          .createSignedUrl(uploadDataThumb.path, 3600); // 1 hour expiration

          // Save to database
          const { data, error } = await supabase
            .from("raw_images")
            .insert([
              {
                filename: fileName,
                storage_path: uploadDataRaw.path,
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

          // Add to local state with URL
          if (data && data.length > 0) {
            const imageWithUrl = {
              ...data[0],
              url: urlDataThumb?.signedUrl
            };
            setRawImages(prev => [...prev, imageWithUrl]);
          }
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