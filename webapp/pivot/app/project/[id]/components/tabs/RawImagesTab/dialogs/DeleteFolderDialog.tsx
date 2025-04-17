import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface DeleteFolderDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  folderName: string;
  imageCount: number;
  folders: Array<{ id: string; name: string }>;
  onDelete: (deleteImages: boolean, targetFolderId: string | null) => void;
}

export default function DeleteFolderDialog({
  open,
  setOpen,
  folderName,
  imageCount,
  folders,
  onDelete,
}: DeleteFolderDialogProps) {
  const [deleteOption, setDeleteOption] = useState<"delete" | "move">("delete");
  const [targetFolderId, setTargetFolderId] = useState<string | null>("root"); // Use "root" instead of null or empty string

  const handleSubmit = () => {
    // Convert "root" to null when passing to the parent component
    onDelete(deleteOption === "delete", targetFolderId === "root" ? null : targetFolderId);
    setOpen(false);
    // Reset the form
    setDeleteOption("delete");
    setTargetFolderId("root");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{folderName}"?
            {imageCount > 0 && ` This folder contains ${imageCount} image(s).`}
          </DialogDescription>
        </DialogHeader>

        {imageCount > 0 && (
          <div className="space-y-4">
            <RadioGroup 
              value={deleteOption} 
              onValueChange={(v) => setDeleteOption(v as "delete" | "move")}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete" id="delete" />
                <Label htmlFor="delete">Delete the folder and all its images</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="move" />
                <Label htmlFor="move">Delete the folder and move images to:</Label>
              </div>
            </RadioGroup>

            {deleteOption === "move" && (
              <Select
                value={targetFolderId || "root"}
                onValueChange={setTargetFolderId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a destination folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">All Images</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}