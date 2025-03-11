import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { Label } from "@/components/ui/label";
  import { Input } from "@/components/ui/input";
  
  interface RenameFolderDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    newFolderName: string;
    setNewFolderName: (name: string) => void;
    handleRenameFolder: () => void;
  }
  
  export default function RenameFolderDialog({
    open,
    setOpen,
    newFolderName,
    setNewFolderName,
    handleRenameFolder,
  }: RenameFolderDialogProps) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Rename Folder</DialogTitle>
            <DialogDescription className="text-white/70">
              Enter a new name for this folder
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="rename-folder-name"
                className="text-right text-white"
              >
                Name
              </Label>
              <Input
                id="rename-folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="col-span-3 text-white bg-background/70 border-white/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleRenameFolder}
              className="text-white bg-cyber-gradient hover:opacity-90"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }