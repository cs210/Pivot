import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useFolders } from "../../../../../../hooks/useFolders";
import { useRawImages } from "../../../../../../hooks/useRawImages";
import { usePanoramas } from "../../../../../../hooks/usePanoramas";
import PanoramaGrid from "./PanoramaGrid";
import RenamePanoramaDialog from "./dialogs/RenamePanoramaDialog";
import Generate360Dialog from "./dialogs/Generate360Dialog";

interface PanoramasTabProps {
  projectId: string;
}

export default function PanoramasTab({ projectId }: PanoramasTabProps) {
  const supabase = createClient();

  // Use the raw images hook
  const {
    rawImages,
    fetchRawImages,
    getImagesInFolder
  } = useRawImages(projectId);

  // Use the panoramas hook
  const {
    panoramas,
    setPanoramas,
    selectedPanoramas,
    setSelectedPanoramas,
    viewMode,
    setViewMode,
    uploading,
    processing,
    setProcessing,
    renamePanoramaDialogOpen,
    setRenamePanoramaDialogOpen,
    generate360DialogOpen,
    setGenerate360DialogOpen,
    setPanoramaToRename,
    newPanoramaName,
    setNewPanoramaName,
    imagesToConvert,
    setImagesToConvert,
    foldersToConvert,
    setFoldersToConvert,
    folderSelectionMode,
    setFolderSelectionMode,
    panoramaFileInputRef,
    fetchPanoramas,
    handleRenamePanorama,
    handleDeletePanorama,
    handlePanoramaUpload,
    getProjectPanoramas
  } = usePanoramas(projectId);

  // Use the folders hook
  const {
    folders
  } = useFolders(projectId);

  useEffect(() => {
    Promise.all([fetchRawImages(), fetchPanoramas()]);
  }, [projectId]);


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
        .from("panoramas")
        .insert([
          {
            name: `${panoramaName}.jpg`,
            project_id: projectId,
            storage_path: "",
            content_type: "image/jpeg",
            size_bytes: 0,
            metadata: {
              status: 'processing',
              source_images: imagesToConvert.map(img => img.id),
            },
            user_id: (await supabase.auth.getUser()).data.user?.id,
          },
        ])
        .select();

      if (panoramaError) {
        console.error("Error creating panorama record:", panoramaError);
        throw panoramaError;
      }

      // Get the ID of the created panorama
      const panoramaId = panoramaData?.[0]?.id;
      const isPublic = panoramaData?.[0]?.is_public;
      
      if (!panoramaId) {
        throw new Error("Failed to create panorama record");
      }

      // Update local state to show processing item
      if (panoramaData && panoramaData.length > 0) {
        setPanoramas((prev) => [...prev, ...panoramaData]);
      }
      
      try {
        // Call the stitching API
        const response = await fetch('/api/stitch-panorama', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            panoramaId: panoramaId,
            sourceImages: imagesToConvert.map(img => img.id),
            sourceFolder: null,
            projectId: projectId,
            isPublic: isPublic,
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error("Stitching failed:", result);
          throw new Error(result.error || 'Failed to stitch panorama');
        }
        
        // The API already updated the database record with the correct storage path
        
      } catch (processingError) {
        console.error("Processing error:", processingError);
        
        // API has already updated the database to mark the panorama as failed
        throw processingError;
      }

      // Refresh panoramas
      await fetchPanoramas();
      alert("360° image generation completed successfully");
      
    } catch (error) {
      console.error("Error generating 360 images:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to generate 360 image: ${errorMessage}`);
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
          .from("panoramas")
          .insert([
            {
              name: `${panoramaName}.jpg`,
              project_id: projectId,
              storage_path: "",
              content_type: "image/jpeg",
              size_bytes: 0,
              metadata: {
                status: 'processing',
                source_images: folderImages.map(img => img.id),
                source_folder: folderId,
              },
              user_id: (await supabase.auth.getUser()).data.user?.id,
            },
          ])
          .select();

        if (panoramaError) {
          console.error("Error creating panorama record:", panoramaError);
          throw panoramaError;
        }
        
        // Get the ID of the created panorama
        const panoramaId = panoramaData?.[0]?.id;
        const isPublic = panoramaData?.[0]?.is_public;
        
        if (!panoramaId) {
          throw new Error("Failed to create panorama record");
        }
        
        // Update local state to show processing item
        if (panoramaData && panoramaData.length > 0) {
          setPanoramas((prev) => [...prev, ...panoramaData]);
        }
        
        try {
          // Call the API with the correct source image IDs
          const response = await fetch('/api/stitch-panorama', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              panoramaId: panoramaData[0].id,
              sourceImages: folderImages.map(img => img.id),
              sourceFolder: folderId,
              projectId: projectId,
              isPublic: isPublic,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            console.error('Panorama stitching failed:', result);
            throw new Error(result.error || 'Failed to stitch panorama');
          }
          
          // The API has already updated the database record,
          // so there's no need to download and re-upload the panorama
          
        } catch (processingError) {
          console.error("Processing error:", processingError);
          
          // API has already updated the database to mark the panorama as failed,
          // but we'll still check here just in case
          if (processingError instanceof Error && processingError.message !== "Failed to upload panorama") {
            await supabase
              .from("panoramas")
              .update({
                metadata: {
                  status: 'failed',
                  error: processingError.message || "Failed to process panorama",
                  source_images: folderImages.map(img => img.id),
                  source_folder: folderId,
                }
              })
              .eq("id", panoramaId);
          }
            
          // Continue with the next folder
          continue;
        }
      }

      // Refresh panoramas
      await fetchPanoramas();
      alert(`Successfully generated panoramas from ${foldersToConvert.length} folders`);
      
    } catch (error) {
      console.error("Error generating 360 images from folders:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to generate 360 images: ${errorMessage}`);
    } finally {
      setProcessing(false);
      setGenerate360DialogOpen(false);
      setFoldersToConvert([]);
      setFolderSelectionMode(false);
    }
  };

  // Toggle folder selection for 360 conversion
  const toggleFolderSelection = (folderId: string) => {
    setFoldersToConvert((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  // Helper function to toggle panorama selection
  const togglePanoramaSelection = (panoramaId: string) => {
    setSelectedPanoramas((prev) =>
      prev.includes(panoramaId)
        ? prev.filter((id) => id !== panoramaId)
        : [...prev, panoramaId]
    );
  };

  return (
    <div className="w-full">
      {/* Panoramas content area */}
      <PanoramaGrid
        panoramas={panoramas}
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
        setGenerate360DialogOpen={setGenerate360DialogOpen}
        getProjectPanoramas={getProjectPanoramas}
      />

      {/* Dialogs */}
      <RenamePanoramaDialog
        open={renamePanoramaDialogOpen}
        setOpen={setRenamePanoramaDialogOpen}
        newPanoramaName={newPanoramaName}
        setNewPanoramaName={setNewPanoramaName}
        handleRenamePanorama={handleRenamePanorama}
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