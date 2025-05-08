"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlusCircle,
  Folder,
  Trash2,
  Edit,
  Calendar,
  Share2,
  Copy,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { Header } from "@/components/header";
import { useProjects } from "@/hooks/useProjects";

export default function Dashboard() {
  const router = useRouter();
  const { 
    projects, 
    loading, 
    user, 
    createProject, 
    deleteProject 
  } = useProjects(router);
  
  const [newProjectName, setNewProjectName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert("Please enter a project name");
      return;
    }

    try {
      const newProject = await createProject(newProjectName.trim());
      
      // Close dialog and reset form
      setNewProjectName("");
      setCreateDialogOpen(false);

      // Redirect to the new project's page
      if (newProject) {
        router.push(`/project/${newProject.id}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project");
    }
  };

  const handleUpdateProject = async () => {
    if (!editProjectName.trim() || !currentProject) {
      alert("Please enter a project name");
      return;
    }

    try {
      // We need to keep this logic since it's not in the useProjects hook
      const supabase = createClient();
      const { error } = await supabase
        .from("projects")
        .update({ name: editProjectName.trim() })
        .eq("id", currentProject.id);

      if (error) throw error;

      // Update local state - in a real implementation, you might want to add 
      // an updateProject method to useProjects hook
      const updatedProjects = projects.map((p) =>
        p.id === currentProject.id
          ? { ...p, name: editProjectName.trim() }
          : p
      );
      
      setEditDialogOpen(false);
      setCurrentProject(null);

      alert("Project updated successfully");
      // Force a refresh to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project");
    }
  };

  const handleDeleteProjectClick = async (id: string) => {
    try {
      await deleteProject(id);
      alert("Project deleted successfully");
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project");
    }
  };

  const handleTogglePublic = async (project: any) => {
    try {
      // We need to keep this logic since it's not in the useProjects hook
      const supabase = createClient();
      const newPublicState = !project.is_public;

      const { error } = await supabase
        .from("projects")
        .update({ is_public: newPublicState })
        .eq("id", project.id);

      if (error) throw error;

      if (newPublicState) {
        // Generate and show the share link
        setCurrentProject(project);
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/shared/${project.id}`;
        setShareLink(link);
        setShareDialogOpen(true);
      }
      
      // Force a refresh to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error updating project visibility:", error);
      alert("Failed to update project visibility");
    }
  };

  const openEditDialog = (project: any) => {
    setCurrentProject(project);
    setEditProjectName(project.name);
    setEditDialogOpen(true);
  };

  const openShareDialog = (project: any) => {
    setCurrentProject(project);
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/shared/${project.id}`;
    setShareLink(link);
    setShareDialogOpen(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const navigateToProject = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  const navigateToSharedProject = (projectId: string) => {
    // Open in a new tab
    window.open(`/shared/${projectId}`, "_blank");
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <Header />
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-cyber-gradient opacity-5"></div>
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold cyber-glow">Your Projects</h1>
            <div className="flex gap-4">
              <Dialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="bg-cyber-gradient hover:opacity-90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] bg-background text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      Create New Project
                    </DialogTitle>
                    <DialogDescription className="text-white/70">
                      Give your project a descriptive name.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label
                        htmlFor="project-name"
                        className="text-right text-white"
                      >
                        Name
                      </Label>
                      <Input
                        id="project-name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="col-span-3 text-white bg-background/70 border-white/20"
                        placeholder="My Awesome Project"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleCreateProject}
                      className="text-white bg-cyber-gradient hover:opacity-90"
                    >
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                onClick={handleSignOut}
                variant="outline"
                className="cyber-border"
              >
                Sign Out
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">Loading your projects...</div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-lg border border-border/40">
              <Folder className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
              <p className="text-muted-foreground mb-6">
                Create your first project to get started
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-cyber-gradient hover:opacity-90"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className={`bg-background/80 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors ${
                    project.is_public ? "border-l-4 border-l-primary" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{project.name}</span>
                        {project.is_public && (
                          <Globe className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(project)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => handleDeleteProjectClick(project.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>
                        Created on{" "}
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {project.is_public && (
                      <div className="mt-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs text-primary p-0 h-auto"
                          onClick={() => navigateToSharedProject(project.id)}
                        >
                          View shared version
                        </Button>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button
                      onClick={() => navigateToProject(project.id)}
                      className="flex-1 bg-cyber-gradient hover:opacity-90"
                    >
                      Open Project
                    </Button>
                    {project.is_public ? (
                      <Button
                        onClick={() => openShareDialog(project)}
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 cyber-border"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleTogglePublic(project)}
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 cyber-border"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Edit Project Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px] bg-background text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Edit Project</DialogTitle>
                <DialogDescription className="text-white/70">
                  Update your project's details.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label
                    htmlFor="edit-project-name"
                    className="text-right text-white"
                  >
                    Name
                  </Label>
                  <Input
                    id="edit-project-name"
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    className="col-span-3 text-white bg-background/70 border-white/20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleUpdateProject}
                  className="text-white bg-cyber-gradient hover:opacity-90"
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Share Link Dialog */}
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogContent className="sm:max-w-[425px] bg-background text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Share Project</DialogTitle>
                <DialogDescription className="text-white/70">
                  Anyone with this link can view your project without logging
                  in.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-md">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm text-white"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyToClipboard}
                  className="h-8"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="mt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() =>
                    currentProject && handleTogglePublic(currentProject)
                  }
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  Make Private
                </Button>
                <Button
                  onClick={() => {
                    window.open(shareLink, "_blank");
                  }}
                  className="text-white bg-cyber-gradient hover:opacity-90"
                >
                  Open Shared View
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <footer className="border-t border-border/40 bg-background">
        <div className="container flex flex-col gap-2 py-4 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <p className="text-center text-sm text-muted-foreground md:text-left">
            © 2025 Pivot. All rights reserved.
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
