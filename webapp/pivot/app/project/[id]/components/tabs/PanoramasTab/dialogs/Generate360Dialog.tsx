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
  import { Folder } from "../../../../../../../hooks/useFolders";
  import { RawImage } from "../../../../../../../hooks/useRawImages";
  
  interface Generate360DialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    folderSelectionMode: boolean;
    setFolderSelectionMode: (mode: boolean) => void;
    folders: Folder[];
    rawImages: RawImage[];
    getImagesInFolder: (folderId: string) => RawImage[];
    foldersToConvert: string[];
    toggleFolderSelection: (folderId: string) => void;
    imagesToConvert: RawImage[];
    setImagesToConvert: (images: RawImage[]) => void;
    processing: boolean;
    handleGenerate360Images: () => void;
    handleGenerate360ImagesFromFolders: () => void;
  }
  
  export default function Generate360Dialog({
    open,
    setOpen,
    folderSelectionMode,
    setFolderSelectionMode,
    folders,
    rawImages,
    getImagesInFolder,
    foldersToConvert,
    toggleFolderSelection,
    imagesToConvert,
    setImagesToConvert,
    processing,
    handleGenerate360Images,
    handleGenerate360ImagesFromFolders,
  }: Generate360DialogProps) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[525px] bg-background text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              Generate 360° Images
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {folderSelectionMode
                ? "Select folders containing images to convert into 360° panoramas"
                : "Select images to convert into 360° panoramas"}
            </DialogDescription>
          </DialogHeader>
  
          <div className="flex items-center justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFolderSelectionMode(!folderSelectionMode);
                // Clear selections when switching modes
                setImagesToConvert([]);
              }}
            >
              {folderSelectionMode
                ? "Select Individual Images"
                : "Select by Folder"}
            </Button>
          </div>
  
          <div className="max-h-[400px] overflow-y-auto py-4">
            {folderSelectionMode ? (
              <div className="space-y-2">
                {folders.map((folder) => {
                  const folderImages = getImagesInFolder(folder.id);
                  return (
                    <div
                      key={folder.id}
                      className={`flex items-center p-2 rounded border cursor-pointer ${
                        foldersToConvert.includes(folder.id)
                          ? "border-primary bg-primary/10"
                          : "border-border/50 hover:bg-muted/20"
                      }`}
                      onClick={() => toggleFolderSelection(folder.id)}
                    >
                      <FolderOpen className="h-5 w-5 mr-4" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {folder.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Contains {folderImages.length} image
                          {folderImages.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {folders.length === 0 && (
                  <div className="text-center p-4 text-muted-foreground">
                    No folders found. Create folders to organize your images.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {rawImages.map((image) => (
                  <div
                    key={image.id}
                    className={`cursor-pointer rounded border overflow-hidden ${
                      imagesToConvert.some((img) => img.id === image.id)
                        ? "border-2 border-primary"
                        : "border-border/50 hover:border-primary/70"
                    }`}
                    onClick={() => {
                      setImagesToConvert((prev) =>
                        prev.some((img) => img.id === image.id)
                          ? prev.filter((img) => img.id !== image.id)
                          : [...prev, image]
                      );
                    }}
                  >
                    <div className="aspect-square relative">
                      <img
                        src={image.url}
                        alt={image.name}
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-background/70 p-1 text-xs truncate">
                        {image.name}
                      </div>
                    </div>
                  </div>
                ))}
                {rawImages.length === 0 && (
                  <div className="col-span-full text-center p-4 text-muted-foreground">
                    No images found. Upload some images to get started.
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={
                folderSelectionMode
                  ? handleGenerate360ImagesFromFolders
                  : handleGenerate360Images
              }
              className="text-white bg-cyber-gradient hover:opacity-90"
              disabled={
                processing ||
                (folderSelectionMode
                  ? foldersToConvert.length === 0
                  : imagesToConvert.length === 0)
              }
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