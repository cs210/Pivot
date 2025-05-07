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
  const [inOrganization, setInOrganization] = useState(false);
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
        setInOrganization(!!cachedProject.organization_id); // Convert to boolean
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
      setInOrganization(!!data.organization_id); // Convert to boolean
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

  const handleToggleProjectOrg = async () => {
    try {
      let newOrgId = null; // Changed from empty string to null
      let updatedMetadata = project?.metadata || {};
      
      if (!inOrganization) {
        // Find the organization ID that matches the user's email domain
        const { data: orgs, error } = await supabase
          .from("organizations")
          .select("*")
          .eq("domain_restriction", user.email.split("@")[1])
          .single();
        if (error) throw error;

        if (orgs) {
          console.log("Found organization");
          newOrgId = orgs.id;
          setInOrganization(true);
        } else {
          alert("No organization found for this email domain: " + user.email.split("@")[1]);
          return;
        }
      } else {
        // We're removing the organization, set to null
        newOrgId = null;
        setInOrganization(false);
        
        // Also clear the housing metadata when removing org access
        updatedMetadata = {};
      }

      const { error } = await supabase
        .from("projects")
        .update({ 
          organization_id: newOrgId,
          metadata: updatedMetadata
        })
        .eq("id", projectId);

      if (error) throw error;

      const updatedProject = project 
        ? { 
            ...project, 
            organization_id: newOrgId,
            metadata: updatedMetadata
          } 
        : null;

      // Update state
      setProject(updatedProject);

      // Update cache
      if (updatedProject) {
        cacheProject(updatedProject);
      }

      return true;
    } catch (error) {
      console.error("Error updating project organization:", error);
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
    inOrganization,
    setProjectName,
    setInOrganization,
    isEditing,
    setIsEditing,
    handleUpdateProjectName,
    handleToggleProjectOrg,
    user,
    clearCache,
    fetchProjectDetails
  };
}