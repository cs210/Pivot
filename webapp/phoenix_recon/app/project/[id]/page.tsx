/* this is probably the most heinous file in the entire codebase.

 * right now this beast handles the entire UI for the project page,
 * including:
 * - project metadata
 * - uploading still images
 * - uploading panoramas
 * - placing panoramas onto the grid
 * - doing the walkthrough
 * 
 * we will refactor this code next quarter. sorry. -jun & caroline
 */
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
// Update your import statement
import {
  ChevronLeft,
  Save,
  Settings,
  FolderPlus,
  Upload,
  Image as ImageIcon,
  MoreVertical,
  FolderOpen,
  Edit,
  Trash2,
  MoveRight,
  Grid,
  List,
  Loader2,
  Cog,
  Box,
} from "lucide-react";
import PlaceLocationsTabContent from "@/components/enhanced-enhanced-image-grid";
import PanoramaViewerPage from "@/components/panorama-viewer-page";

interface Project {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

interface Folder {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  parent_id: string | null;
}

interface RawImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
  folder_id: string | null;
}

interface Panorama {
  id: string;
  project_id: string;
  name: string;
  url: string;
  created_at: string;
  source_image_id?: string | null;
  folder_id?: string | null;
  is_processing?: boolean;
}

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const panoramaFileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Image and folder management
  const [activeTab, setActiveTab] = useState("raw-images");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rawImages, setRawImages] = useState<RawImage[]>([]);
  const [panoramas, setPanoramas] = useState<Panorama[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedPanoramas, setSelectedPanoramas] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog states
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [renameImageDialogOpen, setRenameImageDialogOpen] = useState(false);
  const [renamePanoramaDialogOpen, setRenamePanoramaDialogOpen] =
    useState(false);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [moveImageDialogOpen, setMoveImageDialogOpen] = useState(false);
  const [movePanoramaDialogOpen, setMovePanoramaDialogOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [imageToRename, setImageToRename] = useState<RawImage | null>(null);
  const [panoramaToRename, setPanoramaToRename] = useState<Panorama | null>(
    null
  );
  const [newImageName, setNewImageName] = useState("");
  const [newPanoramaName, setNewPanoramaName] = useState("");
  const [imagesToMove, setImagesToMove] = useState<RawImage[]>([]);
  const [panoramasToMove, setPanoramasToMove] = useState<Panorama[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generate360DialogOpen, setGenerate360DialogOpen] = useState(false);
  const [imagesToConvert, setImagesToConvert] = useState<RawImage[]>([]);

  // Add these new state variables to store selected folders for conversion
  const [foldersToConvert, setFoldersToConvert] = useState([]);
  const [folderSelectionMode, setFolderSelectionMode] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      fetchProjectDetails();
    };

    checkUser();
  }, [router, supabase, projectId]);

  // Function to get all images in a folder
  const getImagesInFolder = (folderId) => {
    return rawImages.filter((img) => img.folder_id === folderId);
  };

  // Updated function to handle 360 image generation from selected folders
  const handleGenerate360ImagesFromFolders = async () => {
    if (foldersToConvert.length === 0) {
      alert("Please select at least one folder of images to convert to 360");
      return;
    }

    setProcessing(true);

    try {
      // Collect all images from the selected folders
      let allImagesToConvert = [];

      foldersToConvert.forEach((folderId) => {
        const folderImages = getImagesInFolder(folderId);
        allImagesToConvert = [...allImagesToConvert, ...folderImages];
      });

      if (allImagesToConvert.length === 0) {
        alert("The selected folders don't contain any images");
        setProcessing(false);
        return;
      }

      // Create processing records for each image
      const newPanoramas = [];

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

  // Toggle folder selection for 360 conversion
  const toggleFolderSelection = (folderId) => {
    setFoldersToConvert((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setProject(data);
      setProjectName(data.name);

      // After fetching project details, fetch folders, images and panoramas
      await Promise.all([fetchFolders(), fetchRawImages(), fetchPanoramas()]);
    } catch (error) {
      console.error("Error fetching project:", error);
      // If project not found, redirect to dashboard
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("project_id", projectId)
        .order("name", { ascending: true });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error("Error fetching folders:", error);
      // Handle potential errors if the table doesn't exist yet
      setFolders([]);
    }
  };

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
      }));

      setPanoramas(transformedData);
    } catch (error) {
      console.error("Error fetching panoramas:", error);
      setPanoramas([]);
    }
  };

  // Remove the createPanoramasTable function since we're using an existing table

  const handleUpdateProject = async () => {
    if (!projectName.trim()) {
      alert("Please enter a project name");
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: projectName.trim() })
        .eq("id", projectId);

      if (error) throw error;

      setProject((prev) =>
        prev ? { ...prev, name: projectName.trim() } : null
      );
      setIsEditing(false);
      alert("Project updated successfully");
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project");
    }
  };

  // Folder management
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }

    try {
      console.log("Creating folder:", {
        name: newFolderName.trim(),
        project_id: projectId,
        parent_id: null,
      });

      // Step 1: Check if the folders table exists
      const { error: tableCheckError } = await supabase
        .from("folders")
        .select("id")
        .limit(1);

      if (tableCheckError) {
        console.error("Error checking folders table:", {
          message: tableCheckError.message,
          code: tableCheckError.code,
          details: tableCheckError.details,
          hint: tableCheckError.hint,
          fullError: JSON.stringify(tableCheckError, null, 2),
        });
        throw new Error(`Table check failed: ${tableCheckError.message}`);
      }

      // Step 2: Attempt to create the folder
      const { data, error } = await supabase
        .from("folders")
        .insert([
          {
            name: newFolderName.trim(),
            project_id: projectId,
            parent_id: null, // Root level folder
          },
        ])
        .select();

      if (error) {
        console.error("Folder creation error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: JSON.stringify(error, null, 2),
        });
        throw new Error(`Insert failed: ${error.message}`);
      }

      console.log("Folder created successfully:", data);

      // Step 3: Update local state only if we have data
      if (data && data.length > 0) {
        setFolders((prev) => [...prev, ...data]);
        setNewFolderName("");
        setCreateFolderDialogOpen(false);
        alert("Folder created successfully");
      } else {
        throw new Error("No data returned from insert operation");
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      alert(`Failed to create folder: ${error.message || "Unknown error"}`);
    }
  };

  const handleRenameFolder = async () => {
    if (!newFolderName.trim() || !folderToRename) {
      alert("Please enter a folder name");
      return;
    }

    try {
      const { error } = await supabase
        .from("folders")
        .update({ name: newFolderName.trim() })
        .eq("id", folderToRename.id);

      if (error) throw error;

      setFolders(
        folders.map((f) =>
          f.id === folderToRename.id ? { ...f, name: newFolderName.trim() } : f
        )
      );

      setRenameFolderDialogOpen(false);
      setFolderToRename(null);
      setNewFolderName("");
      alert("Folder renamed successfully");
    } catch (error) {
      console.error("Error renaming folder:", error);
      alert("Failed to rename folder");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    // Check if folder has images or panoramas
    const folderImages = rawImages.filter((img) => img.folder_id === folderId);
    const folderPanoramas = panoramas.filter(
      (pano) => pano.folder_id === folderId
    );

    if (folderImages.length > 0 || folderPanoramas.length > 0) {
      const confirmDelete = window.confirm(
        `This folder contains ${folderImages.length} images and ${folderPanoramas.length} panoramas. Deleting it will also delete all contents inside. Continue?`
      );

      if (!confirmDelete) return;
    }

    try {
      // First delete all images in the folder
      for (const image of folderImages) {
        await handleDeleteImage(image.id, false); // Don't show alerts for each image
      }

      // Delete all panoramas in the folder
      for (const panorama of folderPanoramas) {
        await handleDeletePanorama(panorama.id, false); // Don't show alerts for each panorama
      }

      // Then delete the folder
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;

      setFolders(folders.filter((f) => f.id !== folderId));

      if (currentFolder?.id === folderId) {
        setCurrentFolder(null);
      }

      alert("Folder and its contents deleted successfully");
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Failed to delete folder");
    }
  };

  // Image management
  const handleRenameImage = async () => {
    if (!newImageName.trim() || !imageToRename) {
      alert("Please enter an image name");
      return;
    }

    try {
      const { error } = await supabase
        .from("raw_images")
        .update({ name: newImageName.trim() })
        .eq("id", imageToRename.id);

      if (error) throw error;

      setRawImages(
        rawImages.map((img) =>
          img.id === imageToRename.id
            ? { ...img, name: newImageName.trim() }
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

      // Delete from storage (assuming the URL contains the path)
      const url = new URL(imageToDelete.url);
      const storagePath = url.pathname.split("/").slice(2).join("/");

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("raw_images")
          .remove([storagePath]);

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

  // Panorama (360 image) management
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

  // Upload handling
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

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("raw_images")
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

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("raw_images")
          .getPublicUrl(uploadData.path);

        if (!urlData || !urlData.publicUrl) {
          console.error("Failed to get public URL for:", uploadData?.path);
          throw new Error("Failed to get public URL");
        }

        console.log("Public URL generated:", urlData.publicUrl);

        // Save to database
        const { data, error } = await supabase
          .from("raw_images")
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

        console.log("Image record created in database:", data);

        // Add to local state
        if (data && data.length > 0) {
          setRawImages((prev) => [...prev, ...data]);
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
              code: uploadError.code,
              details: uploadError.details,
              hint: uploadError.hint,
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
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
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
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        name: error.name,
        stack: error.stack,
        fullError: JSON.stringify(error, null, 2),
      });
      alert(`Failed to upload folders: ${error.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      // Reset the folder input
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    }
  };

  // 360 Image Generation
  const handleGenerate360Images = async () => {
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

  // Helper function to toggle image selection
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages((prev) =>
      prev.includes(imageId)
        ? prev.filter((id) => id !== imageId)
        : [...prev, imageId]
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

  // Get current folder images
  const getCurrentFolderImages = () => {
    return rawImages.filter((img) => img.folder_id === currentFolder?.id);
  };

  // Get current folder panoramas
  const getCurrentFolderPanoramas = () => {
    return panoramas.filter((pano) => pano.folder_id === currentFolder?.id);
  };

  // Get root level images (no folder)
  const getRootImages = () => {
    return rawImages.filter((img) => img.folder_id === null);
  };

  // Get root level panoramas (no folder)
  const getRootPanoramas = () => {
    return panoramas.filter((pano) => pano.folder_id === null);
  };

  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          {loading ? (
            <div className="text-center py-12">Loading project...</div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-8">
                <Button
                  variant="outline"
                  className="cyber-border"
                  onClick={() => router.push("/dashboard")}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>

                <div className="flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-4">
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="text-xl font-bold text-white bg-background/70 border-white/20"
                      />
                      <Button
                        onClick={handleUpdateProject}
                        className="bg-cyber-gradient hover:opacity-90"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setProjectName(project?.name || "");
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <h1 className="text-3xl font-bold cyber-glow">
                        {project?.name}
                      </h1>
                      <Button
                        variant="ghost"
                        className="ml-2"
                        onClick={() => setIsEditing(true)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="mb-6 bg-muted/50 border border-border/50">
                  <TabsTrigger
                    value="raw-images"
                    className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
                  >
                    Raw Images
                  </TabsTrigger>
                  <TabsTrigger
                    value="360-images"
                    className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
                  >
                    360° Images
                  </TabsTrigger>
                  <TabsTrigger
                    value="place-locations"
                    className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
                    // onClick={() =>
                    //   router.push(`/project/${projectId}/locations`)
                    // }
                  >
                    Assign to Grid
                  </TabsTrigger>
                  <TabsTrigger
                    value="walkthrough"
                    className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
                    // onClick={() =>
                    //   router.push(`/project/${projectId}/walkthrough`)
                    // }
                  >
                    View on Web
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground"
                  >
                    Project Settings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="place-locations">
                  <PlaceLocationsTabContent projectId={projectId} />
                </TabsContent>
                <TabsContent value="walkthrough">
                  <PanoramaViewerPage projectId={projectId} />
                </TabsContent>
                <TabsContent value="raw-images">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                    {/* Folders sidebar */}
                    <div className="md:col-span-3">
                      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle>Folders</CardTitle>
                          <Dialog
                            open={createFolderDialogOpen}
                            onOpenChange={setCreateFolderDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <FolderPlus className="h-5 w-5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] bg-background text-white">
                              <DialogHeader>
                                <DialogTitle className="text-white">
                                  Create New Folder
                                </DialogTitle>
                                <DialogDescription className="text-white/70">
                                  Enter a name for your new folder
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label
                                    htmlFor="folder-name"
                                    className="text-right text-white"
                                  >
                                    Name
                                  </Label>
                                  <Input
                                    id="folder-name"
                                    value={newFolderName}
                                    onChange={(e) =>
                                      setNewFolderName(e.target.value)
                                    }
                                    className="col-span-3 text-white bg-background/70 border-white/20"
                                    placeholder="Location Name"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  onClick={handleCreateFolder}
                                  className="text-white bg-cyber-gradient hover:opacity-90"
                                >
                                  Create
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </CardHeader>
                        <CardContent>
                          <nav className="flex flex-col space-y-1">
                            <Button
                              variant={
                                currentFolder === null ? "default" : "ghost"
                              }
                              className="justify-start"
                              onClick={() => setCurrentFolder(null)}
                            >
                              <FolderOpen className="mr-2 h-4 w-4" />
                              All Images
                            </Button>
                            {folders.map((folder) => (
                              <div
                                key={folder.id}
                                className="flex items-center"
                              >
                                <Button
                                  variant={
                                    currentFolder?.id === folder.id
                                      ? "default"
                                      : "ghost"
                                  }
                                  className="justify-start flex-1"
                                  onClick={() => setCurrentFolder(folder)}
                                >
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                  {folder.name}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setFolderToRename(folder);
                                        setNewFolderName(folder.name);
                                        setRenameFolderDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() =>
                                        handleDeleteFolder(folder.id)
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                          </nav>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Images content area */}
                    <div className="md:col-span-9">
                      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <CardTitle>
                              {currentFolder
                                ? `Images in ${currentFolder.name}`
                                : "All Images"}
                            </CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setViewMode(
                                    viewMode === "grid" ? "list" : "grid"
                                  )
                                }
                                title={
                                  viewMode === "grid"
                                    ? "Switch to list view"
                                    : "Switch to grid view"
                                }
                              >
                                {viewMode === "grid" ? (
                                  <List className="h-4 w-4" />
                                ) : (
                                  <Grid className="h-4 w-4" />
                                )}
                              </Button>

                              {selectedImages.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setImagesToMove(
                                      rawImages.filter((img) =>
                                        selectedImages.includes(img.id)
                                      )
                                    );
                                    setMoveImageDialogOpen(true);
                                  }}
                                >
                                  <MoveRight className="mr-2 h-4 w-4" />
                                  Move {selectedImages.length} Selected
                                </Button>
                              )}

                              {/* Image upload button */}
                              <Button
                                className="bg-cyber-gradient hover:opacity-90"
                                disabled={uploading}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                <label className="cursor-pointer">
                                  Upload Images
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                  />
                                </label>
                              </Button>

                              {/* Folder upload button */}
                              <Button
                                className="bg-cyber-gradient hover:opacity-90"
                                disabled={uploading}
                              >
                                <FolderPlus className="mr-2 h-4 w-4" />
                                <label className="cursor-pointer">
                                  Upload Folders
                                  <input
                                    ref={folderInputRef}
                                    type="file"
                                    className="hidden"
                                    webkitdirectory="true"
                                    directory="true"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFolderUpload}
                                    disabled={uploading}
                                  />
                                </label>
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {uploading ? (
                            <div className="text-center py-12">
                              <p className="text-muted-foreground mb-4">
                                Uploading images...
                              </p>
                            </div>
                          ) : viewMode === "grid" ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {(currentFolder
                                ? getCurrentFolderImages()
                                : rawImages
                              ).map((image) => (
                                <Card
                                  key={image.id}
                                  className={`cursor-pointer overflow-hidden hover:border-primary transition-colors ${
                                    selectedImages.includes(image.id)
                                      ? "border-2 border-primary"
                                      : "border-border/50"
                                  }`}
                                  onClick={() => toggleImageSelection(image.id)}
                                >
                                  <div className="aspect-square relative">
                                    <img
                                      src={image.url}
                                      alt={image.name}
                                      className="object-cover w-full h-full"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-background/70 p-2 text-xs truncate">
                                      {image.name}
                                    </div>
                                    <div className="absolute top-2 right-2">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger
                                          asChild
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 bg-background/50"
                                          >
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setImageToRename(image);
                                              setNewImageName(image.name);
                                              setRenameImageDialogOpen(true);
                                            }}
                                          >
                                            <Edit className="mr-2 h-4 w-4" />
                                            Rename
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setImagesToMove([image]);
                                              setMoveImageDialogOpen(true);
                                            }}
                                          >
                                            <MoveRight className="mr-2 h-4 w-4" />
                                            Move
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteImage(image.id);
                                            }}
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(currentFolder
                                ? getCurrentFolderImages()
                                : rawImages
                              ).map((image) => (
                                <div
                                  key={image.id}
                                  className={`flex items-center p-2 rounded border ${
                                    selectedImages.includes(image.id)
                                      ? "border-primary bg-primary/10"
                                      : "border-border/50 hover:bg-muted/20"
                                  }`}
                                  onClick={() => toggleImageSelection(image.id)}
                                >
                                  <div className="h-10 w-10 mr-4 overflow-hidden rounded">
                                    <img
                                      src={image.url}
                                      alt={image.name}
                                      className="object-cover w-full h-full"
                                    />
                                  </div>
                                  <div className="flex-1 truncate">
                                    {image.name}
                                  </div>
                                  <div className="flex items-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger
                                        asChild
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setImageToRename(image);
                                            setNewImageName(image.name);
                                            setRenameImageDialogOpen(true);
                                          }}
                                        >
                                          <Edit className="mr-2 h-4 w-4" />
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setImagesToMove([image]);
                                            setMoveImageDialogOpen(true);
                                          }}
                                        >
                                          <MoveRight className="mr-2 h-4 w-4" />
                                          Move
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteImage(image.id);
                                          }}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {(currentFolder
                            ? getCurrentFolderImages().length === 0
                            : rawImages.length === 0) && (
                            <div className="text-center py-12">
                              <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                              <p className="text-muted-foreground mb-4">
                                No images found. Upload some images to get
                                started.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                {/* New 360 Images Tab */}
                <TabsContent value="360-images">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                    {/* Folders sidebar */}
                    <div className="md:col-span-3">
                      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle>Folders</CardTitle>
                          <Dialog
                            open={createFolderDialogOpen}
                            onOpenChange={setCreateFolderDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <FolderPlus className="h-5 w-5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] bg-background text-white">
                              <DialogHeader>
                                <DialogTitle className="text-white">
                                  Create New Folder
                                </DialogTitle>
                                <DialogDescription className="text-white/70">
                                  Enter a name for your new folder
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label
                                    htmlFor="folder-name"
                                    className="text-right text-white"
                                  >
                                    Name
                                  </Label>
                                  <Input
                                    id="folder-name"
                                    value={newFolderName}
                                    onChange={(e) =>
                                      setNewFolderName(e.target.value)
                                    }
                                    className="col-span-3 text-white bg-background/70 border-white/20"
                                    placeholder="Location Name"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  onClick={handleCreateFolder}
                                  className="text-white bg-cyber-gradient hover:opacity-90"
                                >
                                  Create
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </CardHeader>
                        <CardContent>
                          <nav className="flex flex-col space-y-1">
                            <Button
                              variant={
                                currentFolder === null ? "default" : "ghost"
                              }
                              className="justify-start"
                              onClick={() => setCurrentFolder(null)}
                            >
                              <FolderOpen className="mr-2 h-4 w-4" />
                              All 360° Images
                            </Button>
                            {folders.map((folder) => (
                              <div
                                key={folder.id}
                                className="flex items-center"
                              >
                                <Button
                                  variant={
                                    currentFolder?.id === folder.id
                                      ? "default"
                                      : "ghost"
                                  }
                                  className="justify-start flex-1"
                                  onClick={() => setCurrentFolder(folder)}
                                >
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                  {folder.name}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setFolderToRename(folder);
                                        setNewFolderName(folder.name);
                                        setRenameFolderDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() =>
                                        handleDeleteFolder(folder.id)
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                          </nav>
                        </CardContent>
                      </Card>
                    </div>

                    {/* 360 Images content area */}
                    <div className="md:col-span-9">
                      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <CardTitle>
                              {currentFolder
                                ? `360° Images in ${currentFolder.name}`
                                : "All 360° Images"}
                            </CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setViewMode(
                                    viewMode === "grid" ? "list" : "grid"
                                  )
                                }
                                title={
                                  viewMode === "grid"
                                    ? "Switch to list view"
                                    : "Switch to grid view"
                                }
                              >
                                {viewMode === "grid" ? (
                                  <List className="h-4 w-4" />
                                ) : (
                                  <Grid className="h-4 w-4" />
                                )}
                              </Button>

                              {selectedPanoramas.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPanoramasToMove(
                                      panoramas.filter((p) =>
                                        selectedPanoramas.includes(p.id)
                                      )
                                    );
                                    setMovePanoramaDialogOpen(true);
                                  }}
                                >
                                  <MoveRight className="mr-2 h-4 w-4" />
                                  Move {selectedPanoramas.length} Selected
                                </Button>
                              )}

                              {/* Generate 360 Images button */}
                              <Dialog
                                open={generate360DialogOpen}
                                onOpenChange={setGenerate360DialogOpen}
                              >
                                <DialogTrigger asChild>
                                  <Button variant="outline">
                                    <Box className="mr-2 h-4 w-4" />
                                    Generate 360° Images
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[525px] bg-background text-white">
                                  <DialogHeader>
                                    <DialogTitle className="text-white">
                                      Generate 360° Images
                                    </DialogTitle>
                                    <DialogDescription className="text-white/70">
                                      {folderSelectionMode
                                        ? "Select folders containing images to convert into 360° panoramas"
                                        : "Select images to convert into 360° panoramas"}
                                    </DialogDescription>
                                  </DialogHeader>

                                  <div className="flex items-center justify-end mb-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setFolderSelectionMode(
                                          !folderSelectionMode
                                        );
                                        // Clear selections when switching modes
                                        setImagesToConvert([]);
                                        setFoldersToConvert([]);
                                      }}
                                    >
                                      {folderSelectionMode
                                        ? "Select Individual Images"
                                        : "Select by Folder"}
                                    </Button>
                                  </div>

                                  <div className="max-h-[400px] overflow-y-auto py-4">
                                    {folderSelectionMode ? (
                                      <div className="space-y-2">
                                        {folders.map((folder) => {
                                          const folderImages =
                                            getImagesInFolder(folder.id);
                                          return (
                                            <div
                                              key={folder.id}
                                              className={`flex items-center p-2 rounded border cursor-pointer ${
                                                foldersToConvert.includes(
                                                  folder.id
                                                )
                                                  ? "border-primary bg-primary/10"
                                                  : "border-border/50 hover:bg-muted/20"
                                              }`}
                                              onClick={() =>
                                                toggleFolderSelection(folder.id)
                                              }
                                            >
                                              <FolderOpen className="h-5 w-5 mr-4" />
                                              <div className="flex-1">
                                                <div className="font-medium">
                                                  {folder.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  Contains {folderImages.length}{" "}
                                                  image
                                                  {folderImages.length !== 1
                                                    ? "s"
                                                    : ""}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {folders.length === 0 && (
                                          <div className="text-center p-4 text-muted-foreground">
                                            No folders found. Create folders to
                                            organize your images.
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {rawImages.map((image) => (
                                          <div
                                            key={image.id}
                                            className={`flex items-center p-2 rounded border cursor-pointer ${
                                              imagesToConvert.some(
                                                (img) => img.id === image.id
                                              )
                                                ? "border-primary bg-primary/10"
                                                : "border-border/50 hover:bg-muted/20"
                                            }`}
                                            onClick={() => {
                                              setImagesToConvert((prev) =>
                                                prev.some(
                                                  (img) => img.id === image.id
                                                )
                                                  ? prev.filter(
                                                      (img) =>
                                                        img.id !== image.id
                                                    )
                                                  : [...prev, image]
                                              );
                                            }}
                                          >
                                            <div className="h-10 w-10 mr-4 overflow-hidden rounded">
                                              <img
                                                src={image.url}
                                                alt={image.name}
                                                className="object-cover w-full h-full"
                                              />
                                            </div>
                                            <div className="flex-1 truncate">
                                              {image.name}
                                            </div>
                                          </div>
                                        ))}
                                        {rawImages.length === 0 && (
                                          <div className="text-center p-4 text-muted-foreground">
                                            No images found. Upload some images
                                            to get started.
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      type="submit"
                                      onClick={
                                        folderSelectionMode
                                          ? handleGenerate360ImagesFromFolders
                                          : handleGenerate360Images
                                      }
                                      className="text-white bg-cyber-gradient hover:opacity-90"
                                      disabled={
                                        processing ||
                                        (folderSelectionMode
                                          ? foldersToConvert.length === 0
                                          : imagesToConvert.length === 0)
                                      }
                                    >
                                      {processing ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Processing...
                                        </>
                                      ) : (
                                        <>Generate</>
                                      )}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>

                              {/* Upload 360 Images button */}
                              <Button
                                className="bg-cyber-gradient hover:opacity-90"
                                disabled={uploading}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                <label className="cursor-pointer">
                                  Upload 360° Images
                                  <input
                                    ref={panoramaFileInputRef}
                                    type="file"
                                    className="hidden"
                                    multiple
                                    accept="image/*"
                                    onChange={handlePanoramaUpload}
                                    disabled={uploading}
                                  />
                                </label>
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {uploading || processing ? (
                            <div className="text-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                              <p className="text-muted-foreground mb-4">
                                {uploading
                                  ? "Uploading images..."
                                  : "Processing 360° images..."}
                              </p>
                            </div>
                          ) : viewMode === "grid" ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {(currentFolder
                                ? getCurrentFolderPanoramas()
                                : panoramas
                              ).map((panorama) => (
                                <Card
                                  key={panorama.id}
                                  className={`cursor-pointer overflow-hidden hover:border-primary transition-colors ${
                                    selectedPanoramas.includes(panorama.id)
                                      ? "border-2 border-primary"
                                      : "border-border/50"
                                  }`}
                                  onClick={() =>
                                    togglePanoramaSelection(panorama.id)
                                  }
                                >
                                  <div className="aspect-square relative">
                                    <img
                                      src={panorama.url}
                                      alt={panorama.name}
                                      className="object-cover w-full h-full"
                                    />
                                    {panorama.is_processing && (
                                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                      </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-background/70 p-2 text-xs truncate">
                                      {panorama.name}
                                      {panorama.is_processing &&
                                        " (Processing)"}
                                    </div>
                                    <div className="absolute top-2 right-2">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger
                                          asChild
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 bg-background/50"
                                          >
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPanoramaToRename(panorama);
                                              setNewPanoramaName(panorama.name);
                                              setRenamePanoramaDialogOpen(true);
                                            }}
                                            disabled={panorama.is_processing}
                                          >
                                            <Edit className="mr-2 h-4 w-4" />
                                            Rename
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPanoramasToMove([panorama]);
                                              setMovePanoramaDialogOpen(true);
                                            }}
                                            disabled={panorama.is_processing}
                                          >
                                            <MoveRight className="mr-2 h-4 w-4" />
                                            Move
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePanorama(panorama.id);
                                            }}
                                            disabled={panorama.is_processing}
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(currentFolder
                                ? getCurrentFolderPanoramas()
                                : panoramas
                              ).map((panorama) => (
                                <div
                                  key={panorama.id}
                                  className={`flex items-center p-2 rounded border ${
                                    selectedPanoramas.includes(panorama.id)
                                      ? "border-primary bg-primary/10"
                                      : "border-border/50 hover:bg-muted/20"
                                  }`}
                                  onClick={() =>
                                    togglePanoramaSelection(panorama.id)
                                  }
                                >
                                  <div className="h-10 w-10 mr-4 overflow-hidden rounded">
                                    <img
                                      src={panorama.url}
                                      alt={panorama.name}
                                      className="object-cover w-full h-full"
                                    />
                                    {panorama.is_processing && (
                                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 truncate">
                                    {panorama.name}
                                    {panorama.is_processing && " (Processing)"}
                                  </div>
                                  <div className="flex items-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger
                                        asChild
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPanoramaToRename(panorama);
                                            setNewPanoramaName(panorama.name);
                                            setRenamePanoramaDialogOpen(true);
                                          }}
                                          disabled={panorama.is_processing}
                                        >
                                          <Edit className="mr-2 h-4 w-4" />
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPanoramasToMove([panorama]);
                                            setMovePanoramaDialogOpen(true);
                                          }}
                                          disabled={panorama.is_processing}
                                        >
                                          <MoveRight className="mr-2 h-4 w-4" />
                                          Move
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePanorama(panorama.id);
                                          }}
                                          disabled={panorama.is_processing}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {(currentFolder
                            ? getCurrentFolderPanoramas().length === 0
                            : panoramas.length === 0) && (
                            <div className="text-center py-12">
                              <Box className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                              <p className="text-muted-foreground mb-4">
                                No 360° images found. Upload or generate some
                                images to get started.
                              </p>
                              <div className="flex justify-center gap-4">
                                <Dialog
                                  open={generate360DialogOpen}
                                  onOpenChange={setGenerate360DialogOpen}
                                >
                                  <DialogTrigger asChild>
                                    <Button variant="outline">
                                      <Box className="mr-2 h-4 w-4" />
                                      Generate from Images
                                    </Button>
                                  </DialogTrigger>
                                </Dialog>
                                <Button className="bg-cyber-gradient hover:opacity-90">
                                  <Upload className="mr-2 h-4 w-4" />
                                  <label className="cursor-pointer">
                                    Upload 360° Images
                                    <input
                                      ref={panoramaFileInputRef}
                                      type="file"
                                      className="hidden"
                                      multiple
                                      accept="image/*"
                                      onChange={handlePanoramaUpload}
                                    />
                                  </label>
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                    {/* Project settings sidebar */}
                    <div className="md:col-span-3">
                      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                        <CardHeader>
                          <CardTitle>Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <nav className="flex flex-col space-y-1">
                            <Button variant="ghost" className="justify-start">
                              General
                            </Button>
                            <Button variant="ghost" className="justify-start">
                              Team Members
                            </Button>
                            <Button variant="ghost" className="justify-start">
                              Integrations
                            </Button>
                          </nav>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Project settings content */}
                    <div className="md:col-span-9">
                      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                        <CardHeader>
                          <CardTitle>General Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label
                                htmlFor="project-name"
                                className="text-white"
                              >
                                Project Name
                              </Label>
                              <Input
                                id="project-name"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="text-white bg-background/70 border-white/20"
                              />
                            </div>
                            <Button
                              onClick={handleUpdateProject}
                              className="bg-cyber-gradient hover:opacity-90"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Rename folder dialog */}
              <Dialog
                open={renameFolderDialogOpen}
                onOpenChange={setRenameFolderDialogOpen}
              >
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      Rename Folder
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                      Enter a new name for this folder
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label
                        htmlFor="rename-folder-name"
                        className="text-right text-white"
                      >
                        Name
                      </Label>
                      <Input
                        id="rename-folder-name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="col-span-3 text-white bg-background/70 border-white/20"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleRenameFolder}
                      className="text-white bg-cyber-gradient hover:opacity-90"
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Rename image dialog */}
              <Dialog
                open={renameImageDialogOpen}
                onOpenChange={setRenameImageDialogOpen}
              >
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      Rename Image
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                      Enter a new name for this image
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label
                        htmlFor="rename-image-name"
                        className="text-right text-white"
                      >
                        Name
                      </Label>
                      <Input
                        id="rename-image-name"
                        value={newImageName}
                        onChange={(e) => setNewImageName(e.target.value)}
                        className="col-span-3 text-white bg-background/70 border-white/20"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleRenameImage}
                      className="text-white bg-cyber-gradient hover:opacity-90"
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Rename 360 image dialog */}
              <Dialog
                open={renamePanoramaDialogOpen}
                onOpenChange={setRenamePanoramaDialogOpen}
              >
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      Rename 360° Image
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                      Enter a new name for this 360° image
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label
                        htmlFor="rename-panorama-name"
                        className="text-right text-white"
                      >
                        Name
                      </Label>
                      <Input
                        id="rename-panorama-name"
                        value={newPanoramaName}
                        onChange={(e) => setNewPanoramaName(e.target.value)}
                        className="col-span-3 text-white bg-background/70 border-white/20"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleRenamePanorama}
                      className="text-white bg-cyber-gradient hover:opacity-90"
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Move image dialog */}
              <Dialog
                open={moveImageDialogOpen}
                onOpenChange={setMoveImageDialogOpen}
              >
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      Move Images
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                      Select a destination folder for {imagesToMove.length}{" "}
                      image(s)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[300px] overflow-y-auto">
                    <Button
                      variant={targetFolderId === null ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setTargetFolderId(null)}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Root (No Folder)
                    </Button>
                    {folders.map((folder) => (
                      <Button
                        key={folder.id}
                        variant={
                          targetFolderId === folder.id ? "default" : "outline"
                        }
                        className="w-full justify-start"
                        onClick={() => setTargetFolderId(folder.id)}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        {folder.name}
                      </Button>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleMoveImages}
                      className="text-white bg-cyber-gradient hover:opacity-90"
                    >
                      Move
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Move 360 image dialog */}
              <Dialog
                open={movePanoramaDialogOpen}
                onOpenChange={setMovePanoramaDialogOpen}
              >
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      Move 360° Images
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                      Select a destination folder for {panoramasToMove.length}{" "}
                      360° image(s)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[300px] overflow-y-auto">
                    <Button
                      variant={targetFolderId === null ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setTargetFolderId(null)}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Root (No Folder)
                    </Button>
                    {folders.map((folder) => (
                      <Button
                        key={folder.id}
                        variant={
                          targetFolderId === folder.id ? "default" : "outline"
                        }
                        className="w-full justify-start"
                        onClick={() => setTargetFolderId(folder.id)}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        {folder.name}
                      </Button>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleMovePanoramas}
                      className="text-white bg-cyber-gradient hover:opacity-90"
                    >
                      Move
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </main>
      <footer className="border-t border-border/40 bg-background">
        <div className="container flex flex-col gap-2 py-4 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <p className="text-center text-sm text-muted-foreground md:text-left">
            © 2024 Phoenix Recon. All rights reserved.
          </p>
          <nav className="flex items-center justify-center gap-4 md:gap-6">
            <Link
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              href="#"
            >
              Terms of Service
            </Link>
            <Link
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              href="#"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
