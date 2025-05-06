import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { useRouter } from 'next/navigation';
import { Project } from "../../../../hooks/useProject";
import { createClient } from "@/utils/supabase/client";

interface ShareButtonProps {
  project: Project;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project) => void;
  setShareLink: (link: string) => void;
  setShareDialogOpen: (open: boolean) => void;
}

const ShareButton = ({ 
  project, 
  setProjects, 
  setCurrentProject, 
  setShareLink, 
  setShareDialogOpen 
}: ShareButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleToggleOrg = async (project: Project) => {
    setIsLoading(true);
    
    try {
      // If project is already shared with the organization, just open the dialog
      if (project.organization_id) {
        setCurrentProject(project);
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/shared/${project.id}`;
        setShareLink(link);
        setShareDialogOpen(true);
        setIsLoading(false);
        return;
      }
      
      // If project is not shared with organization, make it shared
      // Find the organization ID that matches the user's email domain
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !userData.user.email) {
        throw new Error("User not authenticated or missing email");
      }
      
      const userEmail = userData.user.email;
      const emailDomain = userEmail.split("@")[1];
      
      const { data: orgs, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("domain_restriction", emailDomain)
        .single();
      
      if (orgError) {
        alert("No organization found for this email domain: " + emailDomain);
        setIsLoading(false);
        return;
      }
      
      // Update the project with the organization ID
      const { error: updateError } = await supabase
        .from("projects")
        .update({ organization_id: orgs.id })
        .eq("id", project.id);
        
      if (updateError) throw updateError;
      
      // Create a properly typed updated project
      const updatedProject: Project = {
        ...project,
        organization_id: orgs.id
      };
      
      // Update the project in state
      setCurrentProject(updatedProject);
      
      // Update the projects list by fetching the current list from state first
      // and then updating it before passing to setProjects
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: projectsData } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (projectsData) {
          setProjects(projectsData as Project[]);
        }
      }
      
      // Generate and show the share link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/shared/${project.id}`;
      setShareLink(link);
      setShareDialogOpen(true);
      
      // Force a refresh to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error updating project organization status:", error);
      alert("Failed to update project organization status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={() => handleToggleOrg(project)}
      variant="outline"
      size="icon"
      className="h-10 w-10 cyber-border"
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </Button>
  );
};

export default ShareButton;