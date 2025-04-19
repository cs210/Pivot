import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useFolders, Folder } from "../../../hooks/useFolders";
import { useRawImages } from "../../../hooks/useRawImages";
import PanoramaGrid from "./PanoramaGrid";
import RenamePanoramaDialog from "./dialogs/RenamePanoramaDialog";
import Generate360Dialog from "./dialogs/Generate360Dialog";

// Updated to match panoramas table schema
export interface Panorama {
  id: string;
  name: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  metadata: Record<string, any>;
  project_id: string;
  is_public: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  url?: string; // Client-side property for display
  is_processing?: boolean; // Client-side property for UI state
}

// Updated to match raw_images table schema
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
  url?: string; // Client-side property for display
}

interface PanoramasTabProps {
  projectId: string;
}

export default function PanoramasTab({ projectId }: PanoramasTabProps) {
  const supabase = createClient();
  const panoramaFileInputRef = useRef<HTMLInputElement>(null);

  // Use the raw images hook
  const {
    rawImages,
    setRawImages,
    fetchRawImages,
    getImagesInFolder
  } = useRawImages(projectId);

  // Panorama management
  const [panoramas, setPanoramas] = useState<Panorama[]>([]);
  const [selectedPanoramas, setSelectedPanoramas] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog states
  const [renamePanoramaDialogOpen, setRenamePanoramaDialogOpen] = useState(false);
  const [generate360DialogOpen, setGenerate360DialogOpen] = useState(false);
  const [panoramaToRename, setPanoramaToRename] = useState<Panorama | null>(null);
  const [newPanoramaName, setNewPanoramaName] = useState("");
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

  const fetchPanoramas = async () => {
    try {
      const { data, error } = await supabase
        .from("panoramas")
        .select("*")
        .eq("project_id", projectId)
        .order("name", { ascending: true });

      if (error) throw error;

      // Transform data to add client-side properties with proper URLs
      const transformedData = await Promise.all((data || []).map(async (item) => {
        let url;

        if (item.is_public) {
          // For public panoramas, use the public URL
          url = supabase.storage
            .from("panoramas")
            .getPublicUrl(item.storage_path).data.publicUrl;
        } else {
          // For private panoramas, generate a signed URL
          const { data: urlData } = await supabase.storage
            .from("panoramas")
            .createSignedUrl(item.storage_path, 3600); // 1 hour expiration

          url = urlData?.signedUrl || null;
        }

        return {
          ...item,
          url,
          is_processing: item.metadata?.status === 'processing'
        };
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
        .from("panoramas")
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

      // Delete from storage
      try {
        if (panoramaToDelete.storage_path) {
          await supabase.storage
            .from("panoramas")
            .remove([panoramaToDelete.storage_path]);
        }
      } catch (storageError) {
        console.warn("Could not delete from storage:", storageError);
        // Continue anyway, as the file might not exist in storage
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("panoramas")
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
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }

        console.log("Panorama uploaded successfully:", uploadData?.path);

        // Get signed URL for private access
        const { data: urlData } = await supabase.storage
          .from("panoramas")
          .createSignedUrl(uploadData.path, 3600); // 1 hour expiration

        if (!urlData || !urlData.signedUrl) {
          console.error(
            "Failed to get signed URL for panorama:",
            uploadData?.path
          );
          throw new Error("Failed to get signed URL");
        }

        console.log("Signed URL generated for panorama:", urlData.signedUrl);

        // Save to database
        const { data, error } = await supabase
          .from("panoramas")
          .insert([
            {
              name: fileName,
              project_id: projectId,
              storage_path: uploadData.path,
              content_type: file.type,
              size_bytes: file.size,
              metadata: {},
              is_public: false, // Change to false to make it private
              user_id: (await supabase.auth.getUser()).data.user?.id, 
            },
          ])
          .select();

        if (error) {
          console.error("Database insert error:", error);
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
      console.error("Error uploading 360 images:", error);
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
            is_public: false,
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
            projectId: projectId
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
              is_public: false,
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
              projectId: projectId
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
          if (processingError.message !== "Failed to upload panorama") {
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
      alert(`Failed to generate 360 images: ${error.message}`);
    } finally {
      setProcessing(false);
      setGenerate360DialogOpen(false);
      setFoldersToConvert([]);
      setFolderSelectionMode(false);
    }
  };

  const getProjectPanoramas = () => {
    return panoramas;
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
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