import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

interface Project {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
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

  return {
    project,
    loading,
    projectName,
    setProjectName,
    isEditing,
    setIsEditing,
    handleUpdateProject,
    user
  };
}