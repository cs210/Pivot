import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Project } from "./useProject";

export function useProjects(router: any) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      fetchProjects(user.id);
    };

    checkUser();
  }, [router, supabase]);

  const fetchProjects = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name: string, metadata?: any) => {
    if (!name.trim() || !user) {
      throw new Error("Project name required and user must be logged in");
    }

    try {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .insert([
          {
            name: name.trim(),
            user_id: user.id,
            is_public: false,
            metadata: metadata || {}
          },
        ])
        .select();

      if (projectError) throw projectError;

      // Get the project ID from the inserted data
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // create a 1x1 grid 
      const { data: gridData, error: gridError } = await supabase
        .from("grids")
        .insert([
          {
            project_id: projectData[0].id,
            name: "Default Grid",
            rows: 1,
            cols: 1,
            is_default: true,
            user_id: userId,
          },
        ])
        .select();
      if (gridError) throw gridError;
      console.log("Grid created:", gridData);

      if (projectData && projectData.length > 0) {
        // Add the new project to the local state
        setProjects(prev => [projectData[0], ...prev]);
        return projectData[0];
      }
      return null;
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Remove the project from local state
      setProjects(projects.filter(p => p.id !== id));
      return true;
    } catch (error) {
      console.error("Error deleting project:", error);
      throw error;
    }
  };

  return {
    projects,
    loading,
    user,
    createProject,
    deleteProject,
    refreshProjects: () => user && fetchProjects(user.id)
  };
}