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
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [editProjectName, setEditProjectName] = useState("");

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

  const openEditDialog = (project: any) => {
    setCurrentProject(project);
    setEditProjectName(project.name);
    setEditDialogOpen(true);
  };

  const navigateToProject = (projectId: string) => {
    router.push(`/project/${projectId}`);
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
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                You haven't created any projects yet.
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-cyber-gradient hover:opacity-90"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Your First Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="bg-background/70 border-border/50 hover:border-border/80 transition-colors"
                >
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      {project.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateToProject(project.id)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Folder className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(project)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProjectClick(project.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Project</DialogTitle>
            <DialogDescription className="text-white/70">
              Update your project's name.
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
    </div>
  );
}
