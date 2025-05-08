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
  organization_id: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
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
        setInOrganization(!!cachedProject.organization_id);
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
      setInOrganization(!!data.organization_id);
    } catch (error) {
      console.error("Error fetching project:", error);
      // If project not found, redirect to dashboard
      router.push("/dashboard");
    } finally {
      setLoading(false);
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
      alert("Project updated successfully");
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project");
    }
  };
  
  const handleToggleProjectOrg = async (metadata?: any) => {
    if (!project) return false;

    try {
      // Get user's email domain
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return false;

      const domain = user.email.split('@')[1];

      // Find matching organization
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .eq('domain_restriction', domain)
        .single();

      if (!orgs) return false;

      // Update project
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          organization_id: project.organization_id ? null : orgs.id,
          metadata: metadata || project.metadata
        })
        .eq('id', project.id);

      if (updateError) throw updateError;

      setInOrganization(!project.organization_id);
      setProject({
        ...project,
        organization_id: project.organization_id ? null : orgs.id,
        metadata: metadata || project.metadata
      });

      return true;
    } catch (error) {
      console.error("Error toggling organization:", error);
      return false;
    }
  };

  const handleUpdateMetadata = async (metadata: any) => {
    if (!project) return false;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ metadata })
        .eq('id', project.id);

      if (error) throw error;

      setProject({
        ...project,
        metadata
      });

      return true;
    } catch (error) {
      console.error("Error updating metadata:", error);
      return false;
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
    loading,
    projectName,
    inOrganization,
    setProjectName,
    setInOrganization,
    isEditing,
    setIsEditing,
    handleUpdateProject,
    handleToggleProjectOrg,
    handleUpdateMetadata,
    user,
    clearCache,
    fetchProjectDetails
  };
}