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
  
  interface RenamePanoramaDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    newPanoramaName: string;
    setNewPanoramaName: (name: string) => void;
    handleRenamePanorama: () => void;
  }
  
  export default function RenamePanoramaDialog({
    open,
    setOpen,
    newPanoramaName,
    setNewPanoramaName,
    handleRenamePanorama,
  }: RenamePanoramaDialogProps) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Rename 360° Image</DialogTitle>
            <DialogDescription className="text-white/70">
              Enter a new name for this 360° image
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="rename-panorama-name"
                className="text-right text-white"
              >
                Name
              </Label>
              <Input
                id="rename-panorama-name"
                value={newPanoramaName}
                onChange={(e) => setNewPanoramaName(e.target.value)}
                className="col-span-3 text-white bg-background/70 border-white/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleRenamePanorama}
              className="text-white bg-cyber-gradient hover:opacity-90"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }