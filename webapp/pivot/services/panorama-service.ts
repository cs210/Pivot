// Client-side implementation that calls the server endpoint
import { createClient } from '@/utils/supabase/client'
import { Project } from "../hooks/useProject";

// Create a client-side Supabase client that maintains the user session
const getSupabase = () => createClient();

/**
 * Updates a project's public status and moves all associated panorama files
 * This uses a server-side API endpoint to handle the file transfers
 */
export async function toggleProjectPublic(
  id: string, 
  setProject?: (project: Project) => void
) {
  try {
    const supabase = getSupabase();
    // First check if the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication error:", authError || "No user found");
      return { 
        success: false, 
        error: "You must be logged in to perform this action" 
      };
    }
    
    // Fetch the current project from Supabase
    const { data: projectData, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single(); // We expect exactly one project with this ID
    
    if (fetchError) {
      console.error("Error fetching project:", fetchError);
      return { 
        success: false, 
        error: fetchError.message || "Project not found" 
      };
    }
    
    // Verify the user has permission to modify this project
    if (projectData.user_id !== user.id) {
      console.error("Permission denied: User does not own this project");
      return {
        success: false,
        error: "You don't have permission to modify this project"
      };
    }
    
    // Use the server-side API to move files and update the project
    console.log(`Calling server API to move files for project ${id}`);
    const response = await fetch('/api/move-panorama-files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server API error:", errorData);
      return {
        success: false,
        error: errorData.error || `Server error: ${response.status}`
      };
    }
    
    const result = await response.json();
    
    // Update local state if setProject function is provided
    if (setProject && result.success) {
      setProject({
        ...projectData,
        is_public: result.isNowPublic
      });
    }
    
    return {
      success: true,
      project: { ...projectData, is_public: result.isNowPublic },
      isNowPublic: result.isNowPublic,
      message: result.message
    };
    
  } catch (error: any) {
    console.error("Error updating project visibility:", error);
    return {
      success: false,
      error: error.message || "Unexpected error updating project visibility"
    };
  }
}

// For backwards compatibility, keep the function signatures the same
// but make them use the server-side approach
export async function moveProjectPanoramaFiles(projectId: string, isPublic: boolean) {
  console.warn('moveProjectPanoramaFiles is deprecated - use toggleProjectPublic instead');
  return {
    success: false,
    error: 'This function is deprecated. Please use toggleProjectPublic instead.'
  };
}

export async function updatePanoramasPublicStatus(projectId: string, isPublic: boolean) {
  try {
    const supabase = getSupabase();
    
    // Debug authentication status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Authentication error in updatePanoramasPublicStatus:", authError || "No user found");
      return { 
        success: false, 
        error: "You must be logged in to update panorama status" 
      };
    }
    
    const { error } = await supabase
      .from('panoramas')
      .update({ is_public: isPublic })
      .eq('project_id', projectId);
      
    if (error) {
      console.error('Error updating panoramas public status:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating panoramas public status:', error);
    return { success: false, error: error.message };
  }
}