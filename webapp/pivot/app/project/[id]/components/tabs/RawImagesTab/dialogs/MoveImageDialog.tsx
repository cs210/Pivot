import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { FolderOpen } from "lucide-react";
  import { Folder } from "../../../../hooks/useFolders";
  import { RawImage } from "../../../../hooks/useRawImages";
  
  interface MoveImageDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    folders: Folder[];
    targetFolderId: string | null;
    setTargetFolderId: (id: string | null) => void;
    imagesToMove: RawImage[];
    handleMoveImages: () => void;
  }
  
  export default function MoveImageDialog({
    open,
    setOpen,
    folders,
    targetFolderId,
    setTargetFolderId,
    imagesToMove,
    handleMoveImages,
  }: MoveImageDialogProps) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Move Images</DialogTitle>
            <DialogDescription className="text-white/70">
              Select a destination folder for {imagesToMove.length} image(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[300px] overflow-y-auto">
            <Button
              variant={targetFolderId === null ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setTargetFolderId(null)}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              All Images
            </Button>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                variant={targetFolderId === folder.id ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setTargetFolderId(folder.id)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {folder.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleMoveImages}
              className="text-white bg-cyber-gradient hover:opacity-90"
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }