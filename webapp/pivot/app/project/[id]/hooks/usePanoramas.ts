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

    // Get user ID first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("User not authenticated. Please log in.");
      setUploading(false);
      return;
    }
    const userId = user.id;

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
          console.error(
            "Storage upload error:", 
            uploadError.message, // Log the primary message
            { fullError: uploadError } // Log the full error object for details
          );
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
              user_id: userId,
            },
          ])
          .select();

        if (error) {
          // Explicitly check if error is a PostgrestError or similar if needed
          // For now, log safely
          console.error(
            "Database insert error:",
            error instanceof Error ? error.message : "Unknown database error",
            { fullError: error }
          );
          throw error;
        }

        console.log("Panorama saved to database:", data);

        // Update local state immediately if insert was successful
        if (data && data.length > 0) {
          const newPanorama = {
            ...data[0],
            folder_id: data[0].folder_id || null,
            source_image_id: data[0].source_image_id || null,
            is_processing: data[0].is_processing || false,
          };
          setPanoramas((prev) => [...prev, newPanorama]);
        }
      }

      alert("360 images uploaded successfully");
    } catch (error) {
      console.error(
        "Failed to upload 360 images:",
        error instanceof Error ? error.message : "Unknown error",
        { fullError: error }
        );
      alert("Failed to upload 360 images");
    } finally {
      setUploading(false);
      // Reset the file input
      if (panoramaFileInputRef.current) {
        panoramaFileInputRef.current.value = "";
      }
    }
  };

  // In handleGenerate360Images function
const handleGenerate360Images = async () => {
  if (imagesToConvert.length === 0) {
    alert("Please select at least one image to convert to 360");
    return;
  }

  // Get user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("User not authenticated. Please log in.");
    return;
  }
  const userId = user.id;

  setProcessing(true);

  try {
    // Create a placeholder panorama record first
    const panoramaName = `panorama_${Date.now()}`;
    
    const { data: panoramaData, error: panoramaError } = await supabase
      .from("panorama_images")
      .insert([
        {
          name: `${panoramaName}.jpg`,
          project_id: projectId,
          url: imagesToConvert[0].url, // Temporary URL until processing is complete
          folder_id: imagesToConvert[0].folder_id,
          is_processing: true,
          user_id: userId,
        },
      ])
      .select();

    if (panoramaError) {
      throw panoramaError;
    }

    const panoramaId = panoramaData?.[0]?.id;
    
    if (!panoramaId) {
      throw new Error("Failed to create panorama record");
    }

    // Update local state to show processing item
    if (panoramaData) {
      setPanoramas((prev) => [...prev, ...panoramaData]);
    }
    
    // Process the panorama with the API
    try {
      // Download the selected images
      const imageBlobs = await Promise.all(
        imagesToConvert.map(async (image) => {
          const response = await fetch(image.url);
          const blob = await response.blob();
          return new File([blob], image.name, { type: blob.type });
        })
      );
      
      // Prepare FormData to send to API
      const formData = new FormData();
      imageBlobs.forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('userId', projectId);
      formData.append('panoramaName', panoramaName);
      
      // Send to API for processing
      const stitchResponse = await fetch('/api/stitch-panorama', {
        method: 'POST',
        body: formData,
      });
      
      const stitchResult = await stitchResponse.json();
      
      if (!stitchResponse.ok) {
        throw new Error(stitchResult.error || 'Failed to generate panorama');
      }
      
      // Update database record with the generated panorama URL
      const { error: updateError } = await supabase
        .from("panorama_images")
        .update({
          is_processing: false,
          url: `${window.location.origin}${stitchResult.panoramaUrl}`,
        })
        .eq("id", panoramaId);

      if (updateError) {
        throw updateError;
      }
    } catch (processingError) {
      // Update the record to show failure but don't throw
      // This allows the system to keep the failed item for reference
      await supabase
        .from("panorama_images")
        .update({
          is_processing: false,
          // Use safe access for error message
          annotations: JSON.stringify({
            error: processingError instanceof Error ? processingError.message : "Failed to process panorama",
            timestamp: new Date().toISOString()
          })
        })
        .eq("id", panoramaId);
        
      // Still throw after logging failure state
      throw processingError; 
    }

    // Refresh panoramas
    await fetchPanoramas();
    alert("360° image generation completed successfully");
    
  } catch (error) {
    // Apply safe error handling
    console.error(
      "Error generating 360 images:", 
      error instanceof Error ? error.message : "Unknown error during generation",
      { fullError: error }
    );
    alert(`Failed to generate 360 image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setProcessing(false);
    setGenerate360DialogOpen(false);
    setImagesToConvert([]);
  }
};

  const handleGenerate360ImagesFromFolders = async (rawImages: RawImage[]) => {
    if (foldersToConvert.length === 0) {
      alert("Please select at least one folder of images to convert to 360");
      return;
    }

    // Get user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("User not authenticated. Please log in.");
      return;
    }
    const userId = user.id;

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
              user_id: userId,
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
      console.error(
        "Error generating 360 images from folders:",
        error instanceof Error ? error.message : "Unknown error",
        { fullError: error }
      );
      alert("Failed to generate 360 images from folders.");
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