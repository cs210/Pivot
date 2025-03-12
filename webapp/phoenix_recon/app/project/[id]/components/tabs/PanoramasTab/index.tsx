import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useFolders, Folder } from "../../../hooks/useFolders";
import FolderSidebar from "./FolderSidebar";
import PanoramaGrid from "./PanoramaGrid";
import CreateFolderDialog from "../RawImagesTab/dialogs/CreateFolderDialog";
import RenameFolderDialog from "../RawImagesTab/dialogs/RenameFolderDialog";
import RenamePanoramaDialog from "./dialogs/RenamePanoramaDialog";
import MovePanoramaDialog from "./dialogs/MovePanoramaDialog";
import Generate360Dialog from "./dialogs/Generate360Dialog";

export interface Panorama {
  id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
  source_image_id?: string | null;
  folder_id?: string | null;
  is_processing?: boolean;
  annotations?: string | null;
}

export interface RawImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
  folder_id: string | null;
}

interface PanoramasTabProps {
  projectId: string;
}

export default function PanoramasTab({ projectId }: PanoramasTabProps) {
  const supabase = createClient();
  const panoramaFileInputRef = useRef<HTMLInputElement>(null);
  
  // Panorama management
  const [panoramas, setPanoramas] = useState<Panorama[]>([]);
  const [rawImages, setRawImages] = useState<RawImage[]>([]);
  const [selectedPanoramas, setSelectedPanoramas] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog states
  const [renamePanoramaDialogOpen, setRenamePanoramaDialogOpen] = useState(false);
  const [movePanoramaDialogOpen, setMovePanoramaDialogOpen] = useState(false);
  const [generate360DialogOpen, setGenerate360DialogOpen] = useState(false);
  const [panoramaToRename, setPanoramaToRename] = useState<Panorama | null>(null);
  const [newPanoramaName, setNewPanoramaName] = useState("");
  const [panoramasToMove, setPanoramasToMove] = useState<Panorama[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [imagesToConvert, setImagesToConvert] = useState<RawImage[]>([]);
  const [foldersToConvert, setFoldersToConvert] = useState<string[]>([]);
  const [folderSelectionMode, setFolderSelectionMode] = useState(false);

  // Use the folders hook
  const {
    folders,
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
    Promise.all([fetchRawImages(), fetchPanoramas()]);
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

  const fetchPanoramas = async () => {
    try {
      const { data, error } = await supabase
        .from("panorama_images")
        .select("*")
        .eq("project_id", projectId)
        .order("name", { ascending: true });

      if (error) throw error;

      // Transform the data to match our Panorama interface
      const transformedData = (data || []).map((item) => ({
        ...item,
        folder_id: item.folder_id || null,
        source_image_id: item.source_image_id || null,
        is_processing: item.is_processing || false,
        annotations: item.annotations || null,
      }));

      setPanoramas(transformedData);
    } catch (error) {
      console.error("Error fetching panoramas:", error);
      setPanoramas([]);
    }
  };

  const handleRenamePanorama = async () => {
    if (!newPanoramaName.trim() || !panoramaToRename) {
      alert("Please enter a panorama name");
      return;
    }

    try {
      const { error } = await supabase
        .from("panorama_images")
        .update({ name: newPanoramaName.trim() })
        .eq("id", panoramaToRename.id);

      if (error) throw error;

      setPanoramas(
        panoramas.map((pano) =>
          pano.id === panoramaToRename.id
            ? { ...pano, name: newPanoramaName.trim() }
            : pano
        )
      );

      setRenamePanoramaDialogOpen(false);
      setPanoramaToRename(null);
      setNewPanoramaName("");
      alert("360 image renamed successfully");
    } catch (error) {
      console.error("Error renaming panorama:", error);
      alert("Failed to rename 360 image");
    }
  };

  const handleDeletePanorama = async (panoramaId: string, showAlert = true) => {
    try {
      // First get the panorama to get the file path
      const panoramaToDelete = panoramas.find((pano) => pano.id === panoramaId);

      if (!panoramaToDelete) return;

      // Delete from storage (assuming the URL contains the path)
      // Skip storage deletion if it's an API-generated panorama
      if (!panoramaToDelete.url.includes('/api/panoramas/')) {
        try {
          const url = new URL(panoramaToDelete.url);
          const storagePath = url.pathname.split("/").slice(2).join("/");
          
          if (storagePath) {
            await supabase.storage
              .from("panoramas")
              .remove([storagePath]);
          }
        } catch (storageError) {
          console.warn("Could not delete from storage:", storageError);
          // Continue anyway, as the file might not exist in storage
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("panorama_images")
        .delete()
        .eq("id", panoramaId);

      if (dbError) throw dbError;

      // Update local state
      setPanoramas(panoramas.filter((pano) => pano.id !== panoramaId));
      setSelectedPanoramas(selectedPanoramas.filter((id) => id !== panoramaId));

      if (showAlert) {
        alert("360 image deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting panorama:", error);
      if (showAlert) {
        alert("Failed to delete 360 image");
      }
    }
  };

  const handleMovePanoramas = async () => {
    if (panoramasToMove.length === 0) return;

    try {
      // Update each panorama's folder_id
      for (const panorama of panoramasToMove) {
        const { error } = await supabase
          .from("panorama_images")
          .update({ folder_id: targetFolderId })
          .eq("id", panorama.id);

        if (error) throw error;
      }

      // Update local state
      setPanoramas(
        panoramas.map((pano) =>
          panoramasToMove.some((movePano) => movePano.id === pano.id)
            ? { ...pano, folder_id: targetFolderId }
            : pano
        )
      );

      setMovePanoramaDialogOpen(false);
      setPanoramasToMove([]);
      setTargetFolderId(null);
      alert(`${panoramasToMove.length} 360 image(s) moved successfully`);
    } catch (error) {
      console.error("Error moving 360 images:", error);
      alert("Failed to move 360 images");
    }
  };

  const handlePanoramaUpload = async (
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

        console.log(`Uploading panorama: ${fileName} to path: ${filePath}`);

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("panoramas")
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

        console.log("Panorama uploaded successfully:", uploadData?.path);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("panoramas")
          .getPublicUrl(uploadData.path);

        if (!urlData || !urlData.publicUrl) {
          console.error(
            "Failed to get public URL for panorama:",
            uploadData?.path
          );
          throw new Error("Failed to get public URL");
        }

        console.log("Public URL generated for panorama:", urlData.publicUrl);

        // Save to database
        const { data, error } = await supabase
          .from("panorama_images")
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

        console.log("Panorama record created in database:", data);

        // Add to local state
        if (data && data.length > 0) {
          setPanoramas((prev) => [...prev, ...data]);
        }
      }

      alert("360 images uploaded successfully");
    } catch (error) {
      console.error("Error uploading 360 images:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        name: error.name,
        stack: error.stack,
        fullError: JSON.stringify(error, null, 2),
      });
      alert(`Failed to upload 360 images: ${error.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      // Reset the file input
      if (panoramaFileInputRef.current) {
        panoramaFileInputRef.current.value = "";
      }
    }
  };

  const handleGenerate360Images = async () => {
    if (imagesToConvert.length === 0) {
      alert("Please select at least one image to convert to 360");
      return;
    }
  
    setProcessing(true);
  
    try {
      // Create a folder name based on timestamp to group these images
      const panoramaName = `panorama_${Date.now()}`;
      
      // Create placeholder panorama record
      const { data: panoramaData, error: panoramaError } = await supabase
        .from("panorama_images")
        .insert([
          {
            name: `${panoramaName}.jpg`,
            project_id: projectId,
            url: imagesToConvert[0].url, // Temporary URL until processing is complete
            folder_id: imagesToConvert[0].folder_id,
            annotations: JSON.stringify({
              status: 'processing',
              source_images: imagesToConvert.map(img => img.id),
            }),
            is_processing: true,
          },
        ])
        .select();
  
      if (panoramaError) {
        console.error("Error creating panorama record:", panoramaError);
        throw panoramaError;
      }
  
      // Get the ID of the created panorama
      const panoramaId = panoramaData?.[0]?.id;
      
      if (!panoramaId) {
        throw new Error("Failed to create panorama record");
      }
  
      // Update local state to show processing item
      if (panoramaData && panoramaData.length > 0) {
        setPanoramas((prev) => [...prev, ...panoramaData]);
      }
      
      try {
        // Download the selected images for processing
        const imageBlobs = await Promise.all(
          imagesToConvert.map(async (image) => {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name, { type: blob.type });
          })
        );
        
        // Prepare FormData to send to API
        const formData = new FormData();
        
        // Add each image file to FormData
        imageBlobs.forEach(file => {
          formData.append('files', file);
        });
        
        // Add metadata
        formData.append('userId', projectId);
        formData.append('panoramaName', panoramaName);
        
        // Send to API for processing
        const stitchResponse = await fetch('/api/stitch-panorama', {
          method: 'POST',
          body: formData,
        });
        
        const stitchResult = await stitchResponse.json();
        
        if (!stitchResponse.ok) {
          // Update the record to show failure
          await supabase
            .from("panorama_images")
            .update({
              is_processing: false,
              annotations: JSON.stringify({
                status: 'failed',
                error: stitchResult.error || 'Failed to generate panorama',
                detail: stitchResult.detail || '',
                source_images: imagesToConvert.map(img => img.id),
              }),
            })
            .eq("id", panoramaId);
              
          throw new Error(stitchResult.error || 'Failed to generate panorama');
        }
        
        // Update database record with the generated panorama URL
        const { error: updateError } = await supabase
          .from("panorama_images")
          .update({
            url: `${window.location.origin}${stitchResult.panoramaUrl}`,
            is_processing: false,
            annotations: JSON.stringify({
              status: 'completed',
              source_images: imagesToConvert.map(img => img.id),
              jobId: stitchResult.jobId,
            }),
          })
          .eq("id", panoramaId);
      
        if (updateError) {
          console.error("Error updating panorama record:", updateError);
          throw updateError;
        }
      } catch (processingError) {
        console.error("Processing error:", processingError);
        
        // Update the database to mark the panorama as failed
        await supabase
          .from("panorama_images")
          .update({
            is_processing: false,
            annotations: JSON.stringify({
              status: 'failed',
              error: processingError.message || "Failed to process panorama",
              source_images: imagesToConvert.map(img => img.id),
            })
          })
          .eq("id", panoramaId);
          
        throw processingError;
      }
  
      // Refresh panoramas
      await fetchPanoramas();
      alert("360° image generation completed successfully");
      
    } catch (error) {
      console.error("Error generating 360 images:", error);
      alert(`Failed to generate 360 image: ${error.message}`);
    } finally {
      setProcessing(false);
      setGenerate360DialogOpen(false);
      setImagesToConvert([]);
    }
  };

  const handleGenerate360ImagesFromFolders = async () => {
    if (foldersToConvert.length === 0) {
      alert("Please select at least one folder of images to convert to 360");
      return;
    }
  
    setProcessing(true);
  
    try {
      // Process each folder separately to create individual panoramas
      for (const folderId of foldersToConvert) {
        const folderImages = getImagesInFolder(folderId);
        
        if (folderImages.length === 0) continue;
        
        // Get folder name for the panorama name
        const folder = folders.find(f => f.id === folderId);
        const panoramaName = folder ? `${folder.name}_360` : `folder_${folderId.substring(0, 8)}_360`;
        
        // Create a placeholder panorama record
        const { data: panoramaData, error: panoramaError } = await supabase
          .from("panorama_images")
          .insert([
            {
              name: `${panoramaName}.jpg`,
              project_id: projectId,
              url: folderImages[0].url, // Temporary URL until processing is complete
              folder_id: folderId,
              is_processing: true,
              annotations: JSON.stringify({
                status: 'processing',
                source_images: folderImages.map(img => img.id),
                source_folder: folderId,
              }),
            },
          ])
          .select();
  
        if (panoramaError) {
          console.error("Error creating panorama record:", panoramaError);
          throw panoramaError;
        }
        
        // Get the ID of the created panorama
        const panoramaId = panoramaData?.[0]?.id;
        
        if (!panoramaId) {
          throw new Error("Failed to create panorama record");
        }
        
        // Update local state to show processing item
        if (panoramaData && panoramaData.length > 0) {
          setPanoramas((prev) => [...prev, ...panoramaData]);
        }
        
        try {
          // Download the folder images for processing
          const imageBlobs = await Promise.all(
            folderImages.map(async (image) => {
              const response = await fetch(image.url);
              const blob = await response.blob();
              return new File([blob], image.name, { type: blob.type });
            })
          );
          
          // Prepare FormData to send to API
          const formData = new FormData();
          
          // Add each image file to FormData
          imageBlobs.forEach(file => {
            formData.append('files', file);
          });
          
          // Add metadata
          formData.append('userId', projectId);
          formData.append('panoramaName', panoramaName);
          
          // Send to API for processing
          const stitchResponse = await fetch('/api/stitch-panorama', {
            method: 'POST',
            body: formData,
          });
          
          const stitchResult = await stitchResponse.json();
          
          if (!stitchResponse.ok) {
            // Update the record to show failure
            await supabase
              .from("panorama_images")
              .update({
                is_processing: false,
                annotations: JSON.stringify({
                  status: 'failed',
                  error: stitchResult.error || 'Failed to generate panorama',
                  detail: stitchResult.detail || '',
                  source_images: folderImages.map(img => img.id),
                  source_folder: folderId,
                }),
              })
              .eq("id", panoramaId);
              
            console.error(`Failed to process folder ${panoramaName}: ${stitchResult.error}`);
            continue; // Continue with next folder instead of aborting the whole process
          }
          
          // Update database record with the generated panorama URL
          const { error: updateError } = await supabase
            .from("panorama_images")
            .update({
              url: `${window.location.origin}${stitchResult.panoramaUrl}`,
              is_processing: false,
              annotations: JSON.stringify({
                status: 'completed',
                source_images: folderImages.map(img => img.id),
                source_folder: folderId,
                jobId: stitchResult.jobId,
              }),
            })
            .eq("id", panoramaId);
      
          if (updateError) {
            console.error("Error updating panorama record:", updateError);
            // Continue with next folder instead of aborting
          }
        } catch (processingError) {
          console.error("Processing error:", processingError);
          
          // Update the database to mark the panorama as failed
          await supabase
            .from("panorama_images")
            .update({
              is_processing: false,
              annotations: JSON.stringify({
                status: 'failed',
                error: processingError.message || "Failed to process panorama",
                source_images: folderImages.map(img => img.id),
                source_folder: folderId,
              })
            })
            .eq("id", panoramaId);
            
          // Continue with the next folder
          continue;
        }
      }
  
      // Refresh panoramas
      await fetchPanoramas();
      alert(`Successfully generated panoramas from ${foldersToConvert.length} folders`);
      
    } catch (error) {
      console.error("Error generating 360 images from folders:", error);
      alert(`Failed to generate 360 images: ${error.message}`);
    } finally {
      setProcessing(false);
      setGenerate360DialogOpen(false);
      setFoldersToConvert([]);
      setFolderSelectionMode(false);
    }
  };

  // Helper function to toggle panorama selection
  const togglePanoramaSelection = (panoramaId: string) => {
    setSelectedPanoramas((prev) =>
      prev.includes(panoramaId)
        ? prev.filter((id) => id !== panoramaId)
        : [...prev, panoramaId]
    );
  };

  // Toggle folder selection for 360 conversion
  const toggleFolderSelection = (folderId: string) => {
    setFoldersToConvert((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  // Get current folder images
  const getImagesInFolder = (folderId: string) => {
    return rawImages.filter((img) => img.folder_id === folderId);
  };

  // Get current folder panoramas
  const getCurrentFolderPanoramas = () => {
    return panoramas.filter((pano) => pano.folder_id === currentFolder?.id);
  };

  // Get root level panoramas (no folder)
  const getRootPanoramas = () => {
    return panoramas.filter((pano) => pano.folder_id === null);
  };

  // Count panoramas in a folder for the delete confirmation
  const getPanoramasInFolder = (folderId: string) => {
    return panoramas.filter((pano) => pano.folder_id === folderId);
  };

  // Custom delete handler for folders that counts and deletes panoramas inside
  const handleDeleteFolderWithPanoramas = async (folderId: string) => {
    const folderPanoramas = getPanoramasInFolder(folderId);
    
    await handleDeleteFolder(
      folderId, 
      0, // No raw images in this context
      folderPanoramas.length,
      () => {}, // Empty function for raw images
      handleDeletePanorama
    );
    
    // Delete the panoramas if folder deletion was successful
    for (const panorama of folderPanoramas) {
      await handleDeletePanorama(panorama.id, false);
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
        handleDeleteFolder={handleDeleteFolderWithPanoramas}
      />

      {/* Panoramas content area */}
      <PanoramaGrid
        panoramas={panoramas}
        currentFolder={currentFolder}
        selectedPanoramas={selectedPanoramas}
        viewMode={viewMode}
        setViewMode={setViewMode}
        uploading={uploading}
        processing={processing}
        panoramaFileInputRef={panoramaFileInputRef}
        togglePanoramaSelection={togglePanoramaSelection}
        handlePanoramaUpload={handlePanoramaUpload}
        handleDeletePanorama={handleDeletePanorama}
        setPanoramaToRename={setPanoramaToRename}
        setNewPanoramaName={setNewPanoramaName}
        setRenamePanoramaDialogOpen={setRenamePanoramaDialogOpen}
        setPanoramasToMove={setPanoramasToMove}
        setMovePanoramaDialogOpen={setMovePanoramaDialogOpen}
        setGenerate360DialogOpen={setGenerate360DialogOpen}
        getCurrentFolderPanoramas={getCurrentFolderPanoramas}
        getRootPanoramas={getRootPanoramas}
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

      <RenamePanoramaDialog
        open={renamePanoramaDialogOpen}
        setOpen={setRenamePanoramaDialogOpen}
        newPanoramaName={newPanoramaName}
        setNewPanoramaName={setNewPanoramaName}
        handleRenamePanorama={handleRenamePanorama}
      />

      <MovePanoramaDialog
        open={movePanoramaDialogOpen}
        setOpen={setMovePanoramaDialogOpen}
        folders={folders}
        targetFolderId={targetFolderId}
        setTargetFolderId={setTargetFolderId}
        panoramasToMove={panoramasToMove}
        handleMovePanoramas={handleMovePanoramas}
      />

      <Generate360Dialog
        open={generate360DialogOpen}
        setOpen={setGenerate360DialogOpen}
        folderSelectionMode={folderSelectionMode}
        setFolderSelectionMode={setFolderSelectionMode}
        folders={folders}
        rawImages={rawImages}
        getImagesInFolder={getImagesInFolder}
        foldersToConvert={foldersToConvert}
        toggleFolderSelection={toggleFolderSelection}
        imagesToConvert={imagesToConvert}
        setImagesToConvert={setImagesToConvert}
        processing={processing}
        handleGenerate360Images={handleGenerate360Images}
        handleGenerate360ImagesFromFolders={handleGenerate360ImagesFromFolders}
      />
    </div>
  );
}