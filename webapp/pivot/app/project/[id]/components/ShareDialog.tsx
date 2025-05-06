// Update your share dialog implementation
import { useState } from "react";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { toggleProjectPublic, updatePanoramasPublicStatus } from '../../../../services/panorama-service';
import { useRouter } from 'next/navigation';
import { Project } from "../../../../hooks/useProject";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  currentProject: Project | null;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ 
  open, 
  onOpenChange, 
  shareLink, 
  currentProject, 
  projects, 
  setProjects 
}) => {
  const [copied, setCopied] = useState(false);
  const [isTogglingPrivate, setIsTogglingPrivate] = useState(false);
  const router = useRouter();
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleMakePrivate = async () => {
    if (!currentProject) return;
    
    setIsTogglingPrivate(true);
    
    try {
      const result = await toggleProjectPublic(currentProject.id, projects, setProjects);
      
      if (!result.success) {
        console.error(result.error || "Failed to make project private");
        alert(result.error || "Failed to make project private");
        setIsTogglingPrivate(false);
        return;
      }
      
      // Update panoramas public status to match the project
      await updatePanoramasPublicStatus(currentProject.id, false);
      
      // Close the dialog since the project is now private
      onOpenChange(false);
      
      // Force a refresh to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error making project private:", error);
      alert("Failed to make project private");
    } finally {
      setIsTogglingPrivate(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Share Project</DialogTitle>
          <DialogDescription className="text-white/70">
            Anyone with this link can view your project without logging in.
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
            onClick={handleMakePrivate}
            disabled={isTogglingPrivate}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            {isTogglingPrivate ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Making Private...
              </>
            ) : (
              "Make Private"
            )}
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
  );
};

export default ShareDialog;