import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { FolderOpen, Loader2 } from "lucide-react";
  import { RawImage } from "../index";
  
  interface Generate360DialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    imagesToConvert: RawImage[];
    setImagesToConvert: (images: RawImage[]) => void;
    processing: boolean;
    handleGenerate360Images: () => Promise<void>;
    rawImages: RawImage[];
  }
  
  export default function Generate360Dialog({
    open,
    setOpen,
    imagesToConvert,
    setImagesToConvert,
    processing,
    handleGenerate360Images,
    rawImages,
  }: Generate360DialogProps) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[525px] bg-background text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              Generate 360° Images
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Select images to convert into 360° images
            </DialogDescription>
          </DialogHeader>
  
          <div className="max-h-[400px] overflow-y-auto py-4">
            <div className="space-y-2">
              {rawImages.map((image) => (
                <div
                  key={image.id}
                  className={`flex items-center p-2 rounded border cursor-pointer ${
                    imagesToConvert.some((img) => img.id === image.id)
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:bg-muted/20"
                  }`}
                  onClick={() => {
                    setImagesToConvert((prev) =>
                      prev.some((img) => img.id === image.id)
                        ? prev.filter((img) => img.id !== image.id)
                        : [...prev, image]
                    );
                  }}
                >
                  <div className="h-10 w-10 mr-4 overflow-hidden rounded">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="flex-1 truncate">
                    {image.name}
                  </div>
                </div>
              ))}
              {rawImages.length === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  No images found. Upload some images to get started.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleGenerate360Images}
              className="text-white bg-cyber-gradient hover:opacity-90"
              disabled={processing || imagesToConvert.length === 0}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Generate</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }