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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Save, Settings, FolderPlus, Upload, Image as ImageIcon, MoreVertical, FolderOpen, Edit, Trash2, MoveRight, Grid, List } from "lucide-react";

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

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Image and folder management
  const [activeTab, setActiveTab] = useState("raw-images");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rawImages, setRawImages] = useState<RawImage[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Dialog states
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [renameImageDialogOpen, setRenameImageDialogOpen] = useState(false);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [moveImageDialogOpen, setMoveImageDialogOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [imageToRename, setImageToRename] = useState<RawImage | null>(null);
  const [newImageName, setNewImageName] = useState("");
  const [imagesToMove, setImagesToMove] = useState<RawImage[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
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
      
      // After fetching project details, fetch folders and images
      await Promise.all([
        fetchFolders(),
        fetchRawImages()
      ]);
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

      setProject(prev => prev ? {...prev, name: projectName.trim()} : null);
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
      const { data, error } = await supabase
        .from("folders")
        .insert([
          {
            name: newFolderName.trim(),
            project_id: projectId,
            parent_id: null // Root level folder
          },
        ])
        .select();

      if (error) throw error;

      setFolders([...(data || []), ...folders]);
      setNewFolderName("");
      setCreateFolderDialogOpen(false);
      alert("Folder created successfully");
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder");
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
          f.id === folderToRename.id
            ? { ...f, name: newFolderName.trim() }
            : f
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
    // Check if folder has images
    const folderImages = rawImages.filter(img => img.folder_id === folderId);
    
    if (folderImages.length > 0) {
      const confirmDelete = window.confirm(
        `This folder contains ${folderImages.length} images. Deleting it will also delete all images inside. Continue?`
      );
      
      if (!confirmDelete) return;
    }

    try {
      // First delete all images in the folder
      for (const image of folderImages) {
        await handleDeleteImage(image.id, false); // Don't show alerts for each image
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
      const imageToDelete = rawImages.find(img => img.id === imageId);
      
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
      setSelectedImages(selectedImages.filter(id => id !== imageId));
      
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
          imagesToMove.some(moveImg => moveImg.id === img.id)
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

  // Upload handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
            upsert: true
          });
        
        if (uploadError) {
          console.error("Storage upload error:", {
            message: uploadError.message,
            name: uploadError.name,
            code: uploadError.code,
            details: uploadError.details,
            hint: uploadError.hint,
            fullError: JSON.stringify(uploadError, null, 2)
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
              folder_id: currentFolder?.id || null
            },
          ])
          .select();
        
        if (error) {
          console.error("Database insert error:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: JSON.stringify(error, null, 2)
          });
          throw error;
        }
        
        console.log("Image record created in database:", data);
        
        // Add to local state
        if (data && data.length > 0) {
          setRawImages(prev => [...prev, ...data]);
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
        fullError: JSON.stringify(error, null, 2)
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
  
  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        const pathParts = relativePath.split('/');
        
        // Skip files deeper than 2 levels (main folder > subfolder > file)
        if (pathParts.length > 3) {
          console.warn(`Skipping file ${relativePath} - too deep in hierarchy`);
          continue;
        }
        
        const topLevelDir = pathParts[0];
        const secondLevelDir = pathParts.length > 2 ? pathParts[1] : null;
        
        // Determine which directory this file belongs to
        const dirKey = secondLevelDir ? `${topLevelDir}/${secondLevelDir}` : topLevelDir;
        
        if (!filesByDirectory[dirKey]) {
          filesByDirectory[dirKey] = [];
        }
        
        filesByDirectory[dirKey].push(file);
      }
      
      console.log("Files grouped by directory:", Object.keys(filesByDirectory));
      
      // Process each directory
      for (const [dirPath, dirFiles] of Object.entries(filesByDirectory)) {
        const pathParts = dirPath.split('/');
        const folderName = pathParts[pathParts.length - 1];
        
        console.log(`Processing folder: ${folderName} with ${dirFiles.length} files`);
        
        // Create folder if it doesn't exist
        const { data: folderData, error: folderError } = await supabase
          .from("folders")
          .insert([
            {
              name: folderName,
              project_id: projectId,
              parent_id: null // Root level folder
            },
          ])
          .select();
        
        if (folderError) {
          console.error("Folder creation error:", {
            message: folderError.message,
            code: folderError.code,
            details: folderError.details,
            hint: folderError.hint,
            fullError: JSON.stringify(folderError, null, 2)
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
        setFolders(prev => [...prev, ...folderData]);
        
        // Upload files for this folder
        for (const file of dirFiles) {
          const fileName = file.name;
          const filePath = `${projectId}/${folderId}/${fileName}`;
          
          console.log(`Uploading file: ${fileName} to path: ${filePath}`);
          
          // Upload to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("raw_images")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: true
            });
          
          if (uploadError) {
            console.error("Storage upload error:", {
              message: uploadError.message,
              name: uploadError.name,
              code: uploadError.code,
              details: uploadError.details,
              hint: uploadError.hint,
              fullError: JSON.stringify(uploadError, null, 2)
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
                folder_id: folderId
              },
            ])
            .select();
          
          if (error) {
            console.error("Database insert error:", {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              fullError: JSON.stringify(error, null, 2)
            });
            throw error;
          }
          
          // Add to local state
          if (data && data.length > 0) {
            setRawImages(prev => [...prev, ...data]);
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
        fullError: JSON.stringify(error, null, 2)
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
  
  // Helper function to toggle image selection
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };
  
  // Get current folder images
  const getCurrentFolderImages = () => {
    return rawImages.filter(img => img.folder_id === currentFolder?.id);
  };
  
  // Get root level images (no folder)
  const getRootImages = () => {
    return rawImages.filter(img => img.folder_id === null);
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
                      <h1 className="text-3xl font-bold cyber-glow">{project?.name}</h1>
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

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-6 bg-muted/50 border border-border/50">
                  <TabsTrigger
                    value="raw-images"
                    className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                      activeTab === "raw-images" ? "bg-cyber-gradient text-foreground" : ""
                    }`}
                  >
                    Raw Images
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className={`data-[state=active]:bg-cyber-gradient data-[state=active]:text-foreground ${
                      activeTab === "settings" ? "bg-cyber-gradient text-foreground" : ""
                    }`}
                  >
                    Project Settings
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="raw-images">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                    {/* Folders sidebar */}
                    <div className="md:col-span-3">
                      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle>Folders</CardTitle>
                          <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <FolderPlus className="h-5 w-5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] bg-background text-white">
                              <DialogHeader>
                                <DialogTitle className="text-white">Create New Folder</DialogTitle>
                                <DialogDescription className="text-white/70">
                                  Enter a name for your new folder
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="folder-name" className="text-right text-white">
                                    Name
                                  </Label>
                                  <Input
                                    id="folder-name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    className="col-span-3 text-white bg-background/70 border-white/20"
                                    placeholder="Location Name"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button type="submit" onClick={handleCreateFolder} className="text-white bg-cyber-gradient hover:opacity-90">
                                  Create
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </CardHeader>
                        <CardContent>
                          <nav className="flex flex-col space-y-1">
                            <Button 
                              variant={currentFolder === null ? "default" : "ghost"} 
                              className="justify-start"
                              onClick={() => setCurrentFolder(null)}
                            >
                              <FolderOpen className="mr-2 h-4 w-4" />
                              All Images
                            </Button>
                            {folders.map((folder) => (
                              <div key={folder.id} className="flex items-center">
                                <Button 
                                  variant={currentFolder?.id === folder.id ? "default" : "ghost"} 
                                  className="justify-start flex-1"
                                  onClick={() => setCurrentFolder(folder)}
                                >
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                  {folder.name}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                      onClick={() => handleDeleteFolder(folder.id)}
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
                                : 'All Images'
                              }
                            </CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                                title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
                              >
                                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                              </Button>
                              
                              {selectedImages.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setImagesToMove(rawImages.filter(img => selectedImages.includes(img.id)));
                                    setMoveImageDialogOpen(true);
                                  }}
                                >
                                  <MoveRight className="mr-2 h-4 w-4" />
                                  Move {selectedImages.length} Selected
                                </Button>
                              )}
                              
                              {/* Image upload button */}
                              <Button className="bg-cyber-gradient hover:opacity-90" disabled={uploading}>
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
                              <Button className="bg-cyber-gradient hover:opacity-90" disabled={uploading}>
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
                              <p className="text-muted-foreground mb-4">Uploading images...</p>
                            </div>
                          ) : viewMode === "grid" ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {(currentFolder 
                                ? getCurrentFolderImages() 
                                : rawImages).map((image) => (
                                <Card
                                  key={image.id}
                                  className={`cursor-pointer overflow-hidden hover:border-primary transition-colors ${
                                    selectedImages.includes(image.id) ? "border-2 border-primary" : "border-border/50"
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
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50">
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
                                : rawImages).map((image) => (
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
                                  <div className="flex-1 truncate">{image.name}</div>
                                  <div className="flex items-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                No images found. Upload some images to get started.
                              </p>
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
                              <Label htmlFor="project-name" className="text-white">
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
              <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">Rename Folder</DialogTitle>
                    <DialogDescription className="text-white/70">
                      Enter a new name for this folder
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="rename-folder-name" className="text-right text-white">
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
                    <Button type="submit" onClick={handleRenameFolder} className="text-white bg-cyber-gradient hover:opacity-90">
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Rename image dialog */}
              <Dialog open={renameImageDialogOpen} onOpenChange={setRenameImageDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">Rename Image</DialogTitle>
                    <DialogDescription className="text-white/70">
                      Enter a new name for this image
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="rename-image-name" className="text-right text-white">
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
                    <Button type="submit" onClick={handleRenameImage} className="text-white bg-cyber-gradient hover:opacity-90">
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Move image dialog */}
              <Dialog open={moveImageDialogOpen} onOpenChange={setMoveImageDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">Move Images</DialogTitle>
                    <DialogDescription className="text-white/70">
                      Select a destination folder for {imagesToMove.length} image(s)
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
                        variant={targetFolderId === folder.id ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setTargetFolderId(folder.id)}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        {folder.name}
                      </Button>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button type="submit" onClick={handleMoveImages} className="text-white bg-cyber-gradient hover:opacity-90">
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