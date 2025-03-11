import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Folder } from "./useFolders";
import { RawImage } from "./useRawImages";

export interface Panorama {
  id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
  source_image_id?: string | null;
  folder_id?: string | null;
  is_processing?: boolean;
}

export function usePanoramas(projectId: string) {
  const supabase = createClient();
  const panoramaFileInputRef = useRef<HTMLInputElement>(null);
  
  // State for panoramas
  const [panoramas, setPanoramas] = useState<Panorama[]>([]);
  const [selectedPanoramas, setSelectedPanoramas] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Dialog states
  const [renamePanoramaDialogOpen, setRenamePanoramaDialogOpen] = useState(false);
  const [movePanoramaDialogOpen, setMovePanoramaDialogOpen] = useState(false);
  const [generate360DialogOpen, setGenerate360DialogOpen] = useState(false);
  const [panoramaToRename, setPanoramaToRename] = useState<Panorama | null>(null);
  const [newPanoramaName, setNewPanoramaName] = useState("");
  const [panoramasToMove, setPanoramasToMove] = useState<Panorama[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  
  // Generation states
  const [imagesToConvert, setImagesToConvert] = useState<RawImage[]>([]);
  const [foldersToConvert, setFoldersToConvert] = useState<string[]>([]);
  const [folderSelectionMode, setFolderSelectionMode] = useState(false);

  useEffect(() => {
    fetchPanoramas();
  }, [projectId]);

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
      const url = new URL(panoramaToDelete.url);
      const storagePath = url.pathname.split("/").slice(2).join("/");

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("panoramas")
          .remove([storagePath]);

        if (storageError) throw storageError;
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

  const handleGenerate360Images = async (rawImages: RawImage[]) => {
    if (imagesToConvert.length === 0) {
      alert("Please select at least one image to convert to 360");
      return;
    }

    setProcessing(true);

    try {
      // Create processing records for each image
      const newPanoramas: Panorama[] = [];

      for (const image of imagesToConvert) {
        // Create a placeholder panorama record
        const { data, error } = await supabase
          .from("panorama_images")
          .insert([
            {
              name: `${image.name.split(".")[0]}_360.jpg`,
              project_id: projectId,
              url: image.url, // Temporary URL until processing is complete
              folder_id: image.folder_id,
              source_image_id: image.id,
              is_processing: true,
            },
          ])
          .select();

        if (error) {
          console.error("Error creating panorama record:", error);
          throw error;
        }

        if (data && data.length > 0) {
          newPanoramas.push(data[0]);
        }
      }

      // Update local state to show processing items
      setPanoramas((prev) => [...prev, ...newPanoramas]);

      // Call the 360 generation function (this would be an API endpoint in a real app)
      // For demo purposes, we'll simulate processing with a timeout

      // In a real app, you would make an API call like:
      // const { data, error } = await supabase.functions.invoke('generate-360-images', {
      //   body: { panoramaIds: newPanoramas.map(p => p.id) }
      // });

      // Simulate processing with a timeout
      setTimeout(async () => {
        try {
          // Update each panorama with "completed" status
          for (const panorama of newPanoramas) {
            // In a real app, this would be the result URL from your 360 generation service
            const simulatedUrl = panorama.url.replace(/\.[^/.]+$/, "_360.jpg");

            const { error } = await supabase
              .from("panorama_images")
              .update({
                is_processing: false,
                url: simulatedUrl,
              })
              .eq("id", panorama.id);

            if (error) throw error;
          }

          // Refresh panoramas
          fetchPanoramas();
          alert("360 image generation completed");
        } catch (error) {
          console.error("Error updating panorama status:", error);
          alert("Error during 360 image processing. Please try again.");
        } finally {
          setProcessing(false);
          setGenerate360DialogOpen(false);
          setImagesToConvert([]);
        }
      }, 3000); // Simulate 3 second processing time
    } catch (error) {
      console.error("Error generating 360 images:", error);
      alert("Failed to start 360 image generation");
      setProcessing(false);
    }
  };

  const handleGenerate360ImagesFromFolders = async (rawImages: RawImage[]) => {
    if (foldersToConvert.length === 0) {
      alert("Please select at least one folder of images to convert to 360");
      return;
    }

    setProcessing(true);

    try {
      // Collect all images from the selected folders
      let allImagesToConvert: RawImage[] = [];

      foldersToConvert.forEach((folderId) => {
        const folderImages = rawImages.filter(img => img.folder_id === folderId);
        allImagesToConvert = [...allImagesToConvert, ...folderImages];
      });

      if (allImagesToConvert.length === 0) {
        alert("The selected folders don't contain any images");
        setProcessing(false);
        return;
      }

      // Create processing records for each image
      const newPanoramas: Panorama[] = [];

      for (const image of allImagesToConvert) {
        // Create a placeholder panorama record
        const { data, error } = await supabase
          .from("panorama_images")
          .insert([
            {
              name: `${image.name.split(".")[0]}_360.jpg`,
              project_id: projectId,
              url: image.url, // Temporary URL until processing is complete
              folder_id: image.folder_id,
              source_image_id: image.id,
              is_processing: true,
            },
          ])
          .select();

        if (error) {
          console.error("Error creating panorama record:", error);
          throw error;
        }

        if (data && data.length > 0) {
          newPanoramas.push(data[0]);
        }
      }

      // Update local state to show processing items
      setPanoramas((prev) => [...prev, ...newPanoramas]);

      // Simulate processing with a timeout (in a real app, this would be an API call)
      setTimeout(async () => {
        try {
          // Update each panorama with "completed" status
          for (const panorama of newPanoramas) {
            const simulatedUrl = panorama.url.replace(/\.[^/.]+$/, "_360.jpg");

            const { error } = await supabase
              .from("panorama_images")
              .update({
                is_processing: false,
                url: simulatedUrl,
              })
              .eq("id", panorama.id);

            if (error) throw error;
          }

          // Refresh panoramas
          fetchPanoramas();
          alert(
            `Successfully generated ${newPanoramas.length} 360° images from ${foldersToConvert.length} folders`
          );
        } catch (error) {
          console.error("Error updating panorama status:", error);
          alert("Error during 360 image processing. Please try again.");
        } finally {
          setProcessing(false);
          setGenerate360DialogOpen(false);
          setFoldersToConvert([]);
          setFolderSelectionMode(false);
        }
      }, 3000); // Simulate 3 second processing time
    } catch (error) {
      console.error("Error generating 360 images:", error);
      alert("Failed to start 360 image generation");
      setProcessing(false);
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

  // Get current folder panoramas
  const getCurrentFolderPanoramas = (currentFolder: Folder | null) => {
    return panoramas.filter((pano) => pano.folder_id === currentFolder?.id);
  };

  // Get root level panoramas (no folder)
  const getRootPanoramas = () => {
    return panoramas.filter((pano) => pano.folder_id === null);
  };

  // Get panoramas in a folder by folderId
  const getPanoramasInFolder = (folderId: string) => {
    return panoramas.filter((pano) => pano.folder_id === folderId);
  };

  return {
    panoramas,
    setPanoramas,
    selectedPanoramas,
    setSelectedPanoramas,
    viewMode,
    setViewMode,
    uploading,
    setUploading,
    processing,
    setProcessing,
    renamePanoramaDialogOpen,
    setRenamePanoramaDialogOpen,
    movePanoramaDialogOpen,
    setMovePanoramaDialogOpen,
    generate360DialogOpen,
    setGenerate360DialogOpen,
    panoramaToRename,
    setPanoramaToRename,
    newPanoramaName,
    setNewPanoramaName,
    panoramasToMove,
    setPanoramasToMove,
    targetFolderId,
    setTargetFolderId,
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
    handleMovePanoramas,
    handlePanoramaUpload,
    handleGenerate360Images,
    handleGenerate360ImagesFromFolders,
    togglePanoramaSelection,
    toggleFolderSelection,
    getCurrentFolderPanoramas,
    getRootPanoramas,
    getPanoramasInFolder
  };
}