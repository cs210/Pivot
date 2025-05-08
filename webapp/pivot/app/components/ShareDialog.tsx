import { useState } from "react";
import { CheckCircle2, Copy, School } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  currentProject: any;
  handleToggleProjectOrg: (metadata?: any) => Promise<boolean>;
  handleUpdateMetadata: (metadata: any) => Promise<boolean>;
}

export default function ShareDialog({
  open,
  onOpenChange,
  shareLink,
  currentProject,
  handleToggleProjectOrg,
  handleUpdateMetadata,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const success = await handleToggleProjectOrg();
      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error sharing project:", error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Share with Organization</DialogTitle>
          <DialogDescription className="text-white/70">
            Share this project with Stanford University. Other Stanford users will be able to find and view this project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-y-4 bg-muted/30 p-4 rounded-md">
          <School className="h-5 w-5 text-primary mr-2" />
          <div className="flex-1">
            <h3 className="font-medium">Stanford University</h3>
            <p className="text-sm text-muted-foreground">
              Share with all Stanford users
            </p>
          </div>
        </div>

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

        <DialogFooter className="mt-4">
          <Button
            onClick={handleShare}
            disabled={isSharing}
            className="text-white bg-cyber-gradient hover:opacity-90"
          >
            {isSharing ? "Sharing..." : "Share with Stanford"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 