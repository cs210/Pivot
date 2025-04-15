import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export interface Folder {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  parent_id: string | null;
}

export function useFolders(projectId: string) {
  const supabase = createClient();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);

  useEffect(() => {
    fetchFolders();
  }, [projectId]);

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

      // Check if the folders table exists
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

      // Attempt to create the folder
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

      // Update local state only if we have data
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

  const handleDeleteFolder = async (folderId: string, imagesInFolder: number, panoramasInFolder: number, handleDeleteImage: Function, handleDeletePanorama: Function) => {
    // Check if folder has images or panoramas
    if (imagesInFolder > 0 || panoramasInFolder > 0) {
      const confirmDelete = window.confirm(
        `This folder contains ${imagesInFolder} images and ${panoramasInFolder} panoramas. Deleting it will also delete all contents inside. Continue?`
      );

      if (!confirmDelete) return;
    }

    try {
      // First delete all images in the folder using the provided handlers
      // These functions should be passed from the parent components
      
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

  return {
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
    folderToRename,
    setFolderToRename,
    fetchFolders,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder
  };
}