import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { toggleProjectPublic, updatePanoramasPublicStatus } from '../../../../services/panorama-service';
import { useRouter } from 'next/navigation';
import { Project } from "../../../../hooks/useProject";

interface ShareButtonProps {
  project: Project;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project) => void;
  setShareLink: (link: string) => void;
  setShareDialogOpen: (open: boolean) => void;
}

const ShareButton = ({ 
  project, 
  projects, 
  setProjects, 
  setCurrentProject, 
  setShareLink, 
  setShareDialogOpen 
}: ShareButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleTogglePublic = async (project: Project) => {
    setIsLoading(true);
    
    try {
      // If project is already public, just open the dialog
      if (project.is_public) {
        setCurrentProject(project);
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/shared/${project.id}`;
        setShareLink(link);
        setShareDialogOpen(true);
        setIsLoading(false);
        return;
      }
      
      // If project is private, make it public and move files
      const result = await toggleProjectPublic(project.id, projects, setProjects);
      
      if (!result.success) {
        console.error(result.error || "Failed to update project visibility");
        // You could use a toast notification here instead of alert
        alert(result.error || "Failed to update project visibility");
        setIsLoading(false);
        return;
      }
      
      // Also update the panoramas' public status to match the project
      await updatePanoramasPublicStatus(project.id, result.isNowPublic || false);
      
      // Generate and show the share link
      setCurrentProject(result.project);
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/shared/${project.id}`;
      setShareLink(link);
      setShareDialogOpen(true);
      
      // Force a refresh to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error updating project visibility:", error);
      alert("Failed to update project visibility");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={() => handleTogglePublic(project)}
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