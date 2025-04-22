import { useState, useEffect, useRef } from "react";
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
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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
      const errorMessage = (error as Error).message || "Unknown error";
      alert(`Failed to create folder: ${errorMessage}`);
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
    try {
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

      alert("Folder deleted successfully");
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Failed to delete folder");
    }
  };

  return {
    // State variables
    folders,
    setFolders,
    currentFolder,
    setCurrentFolder,
    
    // Folder name states
    newFolderName,
    setNewFolderName,
    
    // Dialog states
    createFolderDialogOpen,
    setCreateFolderDialogOpen,
    renameFolderDialogOpen,
    setRenameFolderDialogOpen,
    deleteFolderDialogOpen,
    setDeleteFolderDialogOpen,
    
    // Folder operation targets
    folderToRename,
    setFolderToRename,
    folderToDelete,
    setFolderToDelete,
    
    // Refs
    folderInputRef,
    
    // Main functions
    fetchFolders,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder
  };
}