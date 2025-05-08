import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { RawImage } from "./useRawImages";
import { generateThumbnail } from "@/utils/generate-thumbnail";
import {
  getCachedPanoramas,
  addPanoramaToCache,
  updatePanoramaInCache,
  removePanoramaFromCache,
} from "./cache-service";

export interface Panorama {
  id: string;
  name: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  metadata: {
    status?: "processing" | "completed" | "failed";
    error?: string;
    annotations?: Array<{
      id: string;
      position: {
        yaw: number;
        pitch: number;
      };
      tooltip?: {
        content: string;
      };
      data?: {
        type?: string;
        targetPanoramaId?: string | null;
      };
    }>;
  };
  project_id: string;
  is_public: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  url?: string | null; // Client-side property for display
  thumbnail_url?: string | null; // Client-side property for thumbnail display
  is_processing?: boolean; // Client-side property for UI state
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
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [renamePanoramaDialogOpen, setRenamePanoramaDialogOpen] =
    useState(false);
  const [generate360DialogOpen, setGenerate360DialogOpen] = useState(false);
  const [movePanoramaDialogOpen, setMovePanoramaDialogOpen] = useState(false);
  const [panoramaToRename, setPanoramaToRename] = useState<Panorama | null>(
    null
  );
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

  const fetchPanoramas = async (forceRefresh = false) => {
    console.log("Starting fetchPanoramas for project:", projectId);

    try {
      // Check if we have cached panoramas
      const cachedPanoramas = getCachedPanoramas(projectId);

      if (cachedPanoramas && !forceRefresh) {
        console.log("Using cached panoramas");
        setPanoramas(cachedPanoramas);
        setLoading(false);
        return;
      }

      // If no cache or force refresh, fetch from database
      const { data, error } = await supabase
        .from("panoramas")
        .select("*")
        .eq("project_id", projectId);

      if (error) {
        throw error;
      }

      // Add signed URLs to panoramas
      const transformedData = await Promise.all(
        (data || []).map(async (item) => {
          let url;
          let thumbnailUrl;

          if (item.is_public) {
            // For public panoramas, use the public URL
            url = supabase.storage
              .from("panoramas-public")
              .getPublicUrl(item.storage_path).data.publicUrl;

            // Get thumbnail URL from thumbnails bucket
            thumbnailUrl = supabase.storage
              .from("thumbnails-public")
              .getPublicUrl(item.storage_path).data.publicUrl;
          } else {
            // For private panoramas, generate signed URLs
            const { data: urlData } = await supabase.storage
              .from("panoramas-private")
              .createSignedUrl(item.storage_path, 3600); // 1 hour expiration

            const { data: thumbUrlData } = await supabase.storage
              .from("thumbnails-private")
              .createSignedUrl(item.storage_path, 3600); // 1 hour expiration

            url = urlData?.signedUrl || null;
            thumbnailUrl = thumbUrlData?.signedUrl || null;
          }

          return {
            ...item,
            url,
            thumbnail_url: thumbnailUrl,
            is_processing: item.metadata?.status === "processing",
          };
        })
      );

      // Update state and cache
      setPanoramas(transformedData);
      transformedData.forEach((panorama) =>
        addPanoramaToCache(projectId, panorama)
      );
    } catch (error) {
      console.error("Error fetching panoramas:", error);
      alert("Error loading panoramas. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const updatePanorama = async (
    panoramaId: string,
    updateData: Partial<Panorama>
  ) => {
    try {
      console.log(`Updating panorama ${panoramaId} with data:`, updateData);

      const { error } = await supabase
        .from("panoramas")
        .update(updateData)
        .eq("id", panoramaId);

      if (error) throw error;

      // Update local state
      setPanoramas((prevPanoramas) =>
        prevPanoramas.map((pano) =>
          pano.id === panoramaId ? { ...pano, ...updateData } : pano
        )
      );

      // Update the cache
      updatePanoramaInCache(projectId, panoramaId, updateData);

      // If we're updating a URL or metadata that affects URLs, refresh the panorama
      if (updateData.is_public !== undefined || updateData.storage_path) {
        // Find the panorama to refresh its URL
        const panoramaToRefresh = panoramas.find((p) => p.id === panoramaId);
        if (panoramaToRefresh) {
          await refreshPanoramaUrl(panoramaToRefresh);
        }
      }

      return true;
    } catch (error) {
      console.error("Error updating panorama:", error);
      throw error;
    }
  };

  const refreshPanoramaUrl = async (panorama: Panorama) => {
    try {
      let url;
      if (panorama.is_public) {
        // For public panoramas, use the public URL
        url = supabase.storage
          .from("panoramas-public")
          .getPublicUrl(panorama.storage_path).data.publicUrl;
      } else {
        // For private panoramas, generate a signed URL
        const { data: urlData } = await supabase.storage
          .from("panoramas-private")
          .createSignedUrl(panorama.storage_path, 3600); // 1 hour expiration

        url = urlData?.signedUrl || null;
      }

      // Update the panorama in state with the new URL
      const updatedPanorama = {
        ...panorama,
        url,
      };

      setPanoramas((prevPanoramas) =>
        prevPanoramas.map((p) => (p.id === panorama.id ? updatedPanorama : p))
      );

      // Update the cache
      updatePanoramaInCache(projectId, panorama.id, { url });

      return url;
    } catch (error) {
      console.error("Error refreshing panorama URL:", error);
      return null;
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

      const updatedPanoramas = panoramas.map((pano) =>
        pano.id === panoramaToRename.id
          ? { ...pano, name: newPanoramaName.trim() }
          : pano
      );

      // Update state
      setPanoramas(updatedPanoramas);

      // Update cache
      updatePanoramaInCache(projectId, panoramaToRename.id, {
        name: newPanoramaName.trim(),
      });

      setRenamePanoramaDialogOpen(false);
      setPanoramaToRename(null);
      setNewPanoramaName("");
      // USED TO BE ALERT()
      console.log("360 image renamed successfully");
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
          if (panoramaToDelete.is_public) {
            await supabase.storage
              .from("panoramas-public")
              .remove([panoramaToDelete.storage_path]);

            // Delete the thumbnail
            await supabase.storage
              .from("thumbnails-public")
              .remove([panoramaToDelete.storage_path]);
          } else {
            // Delete the full panorama
            await supabase.storage
              .from("panoramas-private")
              .remove([panoramaToDelete.storage_path]);
            // Delete the thumbnail
            await supabase.storage
              .from("thumbnails-private")
              .remove([panoramaToDelete.storage_path]);
          }
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

      // Update cache
      removePanoramaFromCache(projectId, panoramaId);

      if (showAlert) {
        // USED TO BE ALERT()
        console.log("360 image deleted successfully");
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

        // Check if file is a JPG image
        if (file.type !== "image/jpeg" && file.type !== "image/jpg") {
          console.log(`Skipping non-JPG file: ${fileName}`);
          alert(`Only JPG images are supported. Skipping file: ${fileName}`);
          continue;
        }

        // First, create database entry to get the ID
        const { data: dbData, error: dbError } = await supabase
          .from("panoramas")
          .insert([
            {
              name: fileName,
              project_id: projectId,
              storage_path: null, // Will update this after storage upload
              content_type: "image/jpeg", // Always set to image/jpeg
              size_bytes: file.size,
              metadata: {},
              user_id: (await supabase.auth.getUser()).data.user?.id,
            },
          ])
          .select();

        if (dbError) {
          console.error("Database insert error:", dbError);
          throw dbError;
        }

        if (!dbData || dbData.length === 0) {
          throw new Error("Failed to create database entry");
        }

        // Extract the unique ID from the database entry
        const panoramaId = dbData[0].id;
        const isPublic = dbData[0].is_public;

        // Use the unique ID in the filepath with .jpg extension
        const filePath = `${projectId}/${panoramaId}.jpg`;

        console.log(
          `Uploading panorama (public=${isPublic}): ${fileName} with ID: ${panoramaId} to path: ${filePath}`
        );

        // Choose the appropriate storage bucket based on public/private status
        const storageBucket = isPublic
          ? "panoramas-public"
          : "panoramas-private";
        const thumbnailBucket = isPublic
          ? "thumbnails-public"
          : "thumbnails-private";

        // Upload to storage with ID-based path
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: "image/jpeg", // Explicitly set content type to image/jpeg
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }

        console.log("Panorama uploaded successfully:", uploadData?.path);

        // Generate and upload thumbnail
        const thumbnailBlob = await generateThumbnail(file, {
          maxDimension: 800,
          quality: 0.95,
          format: "image/jpeg",
          filename: `thumb_${fileName}`,
        });

        const { data: thumbnailData, error: thumbnailError } =
          await supabase.storage
            .from(thumbnailBucket)
            .upload(filePath, thumbnailBlob, {
              cacheControl: "3600",
              upsert: true,
            });

        if (thumbnailError) {
          console.error("Thumbnail upload error:", thumbnailError);
          throw thumbnailError;
        }

        console.log("Thumbnail uploaded successfully:", thumbnailData?.path);

        const { error: databaseUpdateError } = await supabase
          .from("panoramas")
          .update({ storage_path: uploadData.path })
          .eq("id", panoramaId);

        if (databaseUpdateError) {
          console.error("Database update error:", databaseUpdateError);
          throw databaseUpdateError;
        }
        console.log("Database updated with storage path:", uploadData.path);

        let url;
        let thumbnailUrl;
        if (isPublic) {
          // For public panoramas, use the public URL
          const { data: urlData } = supabase.storage
            .from(storageBucket)
            .getPublicUrl(uploadData.path);

          if (!urlData?.publicUrl) {
            console.error(
              "Failed to get public URL for panorama:",
              uploadData?.path
            );
            throw new Error("Failed to get public URL");
          }

          // For public panoramas, use the public URL
          const { data: thumbnailUrlData } = supabase.storage
            .from(thumbnailBucket)
            .getPublicUrl(uploadData.path);

          if (!thumbnailUrlData?.publicUrl) {
            console.error(
              "Failed to get public URL for panorama thumbnail:",
              uploadData?.path
            );
            throw new Error("Failed to get public URL");
          }

          url = urlData.publicUrl;
          thumbnailUrl = thumbnailUrlData.publicUrl;
        } else {
          // Get signed URLs for both panorama and thumbnail
          const { data: panoramaUrlData } = await supabase.storage
            .from("panoramas")
            .createSignedUrl(uploadData.path, 3600);
          if (!panoramaUrlData?.signedUrl) {
            console.error(
              "Failed to get signed URL for panorama:",
              uploadData?.path
            );
            throw new Error("Failed to get signed URL");
          }
          const { data: thumbnailUrlData } = await supabase.storage
            .from(thumbnailBucket)
            .createSignedUrl(thumbnailData.path, 3600);
          if (!thumbnailUrlData?.signedUrl) {
            console.error(
              "Failed to get signed URL for panorama thumbnail:",
              thumbnailData?.path
            );
            throw new Error("Failed to get signed URL");
          }
          url = panoramaUrlData.signedUrl;
          thumbnailUrl = thumbnailUrlData.signedUrl;
        }
        console.log("Generated signed URL for panorama:", url);
        console.log("Generated signed URL for thumbnail:", thumbnailUrl);

        // Insert into database
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
              is_public: false,
              user_id: (await supabase.auth.getUser()).data.user?.id,
            },
          ])
          .select();

        if (error) {
          console.error("Database insert error:", error);
          throw error;
        }

        if (data && data.length > 0) {
          const newPanorama = {
            ...data[0],
            url: url,
            thumbnail_url: thumbnailUrl,
            is_processing: false,
          };

          // ✅ Prevent duplicate appends
          setPanoramas((prev) => {
            if (prev.some((p) => p.id === newPanorama.id)) return prev;
            return [...prev, newPanorama];
          });

          addPanoramaToCache(projectId, newPanorama);
        }
      }

      alert("360 images uploaded successfully");
    } catch (error) {
      console.error("Error uploading 360 images:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to upload 360 images: ${errorMessage}`);
    } finally {
      setUploading(false);
      if (panoramaFileInputRef.current) {
        panoramaFileInputRef.current.value = "";
      }
    }
  };

  const getProjectPanoramas = () => {
    console.log("Fetching panoramas for project:", projectId);
    console.log("Panoramas:", panoramas);
    return panoramas;
  };

  const getPanoramaById = (id: string) => {
    return panoramas.find((pano) => pano.id === id) || null;
  };

  return {
    // State variables
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
    loading,
    setLoading,

    // Dialog related states
    renamePanoramaDialogOpen,
    setRenamePanoramaDialogOpen,
    generate360DialogOpen,
    setGenerate360DialogOpen,
    movePanoramaDialogOpen,
    setMovePanoramaDialogOpen,
    panoramaToRename,
    setPanoramaToRename,
    newPanoramaName,
    setNewPanoramaName,
    panoramasToMove,
    setPanoramasToMove,
    targetFolderId,
    setTargetFolderId,

    // Generation states
    imagesToConvert,
    setImagesToConvert,
    foldersToConvert,
    setFoldersToConvert,
    folderSelectionMode,
    setFolderSelectionMode,

    // Refs
    panoramaFileInputRef,

    // Main functions
    fetchPanoramas,
    handleRenamePanorama,
    handleDeletePanorama,
    handlePanoramaUpload,
    updatePanorama,

    // Helper functions
    getProjectPanoramas,
    getPanoramaById,
    refreshPanoramaUrl,
  };
}
