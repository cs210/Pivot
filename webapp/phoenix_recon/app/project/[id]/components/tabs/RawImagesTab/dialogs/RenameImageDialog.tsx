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
  
  interface RenameImageDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    newImageName: string;
    setNewImageName: (name: string) => void;
    handleRenameImage: () => void;
  }
  
  export default function RenameImageDialog({
    open,
    setOpen,
    newImageName,
    setNewImageName,
    handleRenameImage,
  }: RenameImageDialogProps) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Rename Image</DialogTitle>
            <DialogDescription className="text-white/70">
              Enter a new name for this image
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="rename-image-name"
                className="text-right text-white"
              >
                Name
              </Label>
              <Input
                id="rename-image-name"
                value={newImageName}
                onChange={(e) => setNewImageName(e.target.value)}
                className="col-span-3 text-white bg-background/70 border-white/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleRenameImage}
              className="text-white bg-cyber-gradient hover:opacity-90"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }