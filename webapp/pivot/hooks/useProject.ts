import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  getCachedProject, 
  cacheProject, 
  clearProjectCache,
  clearAllCache 
} from "./cache-service";

export interface Project {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  is_public: boolean; 
  organization_id: string;
  metadata: {
    housing_type?: string;
    residence_type?: string;
    residence_name?: string;
    room_type?: string;
  };
}

export function useProject(projectId: string, router: any) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

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

  const fetchProjectDetails = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Check if the project is in cache
      const cachedProject = getCachedProject(projectId);
      
      if (cachedProject && !forceRefresh) {
        console.log("Using cached project details");
        setProject(cachedProject);
        setProjectName(cachedProject.name);
        setLoading(false);
        return;
      }
      
      // If not in cache or force refresh, fetch from database
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      
      // Update cache
      cacheProject(data);
      
      // Update state
      setProject(data);
      setProjectName(data.name);
    } catch (error) {
      console.error("Error fetching project:", error);
      // If project not found, redirect to dashboard
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProjectName = async () => {
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

      const updatedProject = project 
        ? { ...project, name: projectName.trim() } 
        : null;
        
      // Update state
      setProject(updatedProject);
      
      // Update cache
      if (updatedProject) {
        cacheProject(updatedProject);
      }
      
      setIsEditing(false);
      
      return true;
    } catch (error) {
      console.error("Error updating project:", error);
      throw error;
    }
  };
  
  // Function to clear cache for the current project
  const clearCache = (allProjects = false) => {
    if (allProjects) {
      clearAllCache();
    } else {
      clearProjectCache(projectId);
    }
  };

  return {
    project,
    setProject,
    loading,
    projectName,
    setProjectName,
    isEditing,
    setIsEditing,
    handleUpdateProjectName,
    user,
    clearCache,
    fetchProjectDetails
  };
}