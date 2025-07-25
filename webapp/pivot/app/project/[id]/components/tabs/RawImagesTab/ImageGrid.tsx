import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Image as ImageIcon,
  MoreVertical,
  Edit,
  Trash2,
  MoveRight,
  Grid,
  List,
  FolderPlus,
} from "lucide-react";
import { RawImage } from "../../../../../../hooks/useRawImages";
import { Folder } from "../../../../../../hooks/useFolders";
import { useState, useEffect } from "react";

interface ImageGridProps {
  rawImages: RawImage[];
  currentFolder: Folder | null;
  selectedImages: string[];
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
  toggleImageSelection: (imageId: string) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteImage: (imageId: string, showAlert?: boolean) => void;
  setImageToRename: (image: RawImage | null) => void;
  setNewImageName: (name: string) => void;
  setRenameImageDialogOpen: (open: boolean) => void;
  setImagesToMove: (images: RawImage[]) => void;
  setMoveImageDialogOpen: (open: boolean) => void;
  getCurrentFolderImages: () => RawImage[];
  getAllImages: () => RawImage[];
}

export default function ImageGrid({
  rawImages,
  currentFolder,
  selectedImages,
  viewMode,
  setViewMode,
  uploading,
  fileInputRef,
  folderInputRef,
  toggleImageSelection,
  handleFileUpload,
  handleFolderUpload,
  handleDeleteImage,
  setImageToRename,
  setNewImageName,
  setRenameImageDialogOpen,
  setImagesToMove,
  setMoveImageDialogOpen,
  getCurrentFolderImages,
  getAllImages,
}: ImageGridProps) {
  // Use state to store the images to display
  const [uniqueImageArray, setUniqueImageArray] = useState<RawImage[]>([]);

  // Update images when dependencies change
  useEffect(() => {
    // Determine which images to show based on currentFolder
    const imagesToShow = currentFolder
      ? getCurrentFolderImages()
      : getAllImages();

    // Create a map to track unique images by ID to ensure no duplicates
    const imageMap = new Map<string, RawImage>();

    // Add each image to the map, ensuring no duplicates
    imagesToShow.forEach((image) => {
      if (!imageMap.has(image.id)) {
        imageMap.set(image.id, image);
      }
    });

    // Convert the Map back to an array for rendering
    setUniqueImageArray(Array.from(imageMap.values()));
  }, [rawImages, currentFolder, getCurrentFolderImages, getAllImages]);

  return (
    <div className="md:col-span-9">
      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {currentFolder ? `Images in ${currentFolder.name}` : "All Images"}
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setViewMode(viewMode === "grid" ? "list" : "grid")
                }
                title={
                  viewMode === "grid"
                    ? "Switch to list view"
                    : "Switch to grid view"
                }
                className="bg-cyber-gradient hover:opacity-90"
              >
                {viewMode === "grid" ? (
                  <List className="h-4 w-4" />
                ) : (
                  <Grid className="h-4 w-4" />
                )}
              </Button>

              {selectedImages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImagesToMove(
                      rawImages.filter((img) => selectedImages.includes(img.id))
                    );
                    setMoveImageDialogOpen(true);
                  }}
                >
                  <MoveRight className="mr-2 h-4 w-4" />
                  Move {selectedImages.length} Selected
                </Button>
              )}

              {/* Image upload button */}
              <Button
                className="bg-cyber-gradient hover:opacity-90"
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                <label className="cursor-pointer">
                  Upload Images
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </Button>

              {/* Folder upload button */}
              <Button
                className="bg-cyber-gradient hover:opacity-90"
                disabled={uploading}
                onClick={() => {
                  if (folderInputRef.current && !uploading) {
                    folderInputRef.current.click();
                  }
                }}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Upload Folders
              </Button>
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                accept="image/*"
                onChange={handleFolderUpload}
                disabled={uploading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {uploading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Uploading images...</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {uniqueImageArray.map((image) => (
                <Card
                  key={`${image.id}-${image.updated_at}`}
                  className={`cursor-pointer overflow-hidden hover:border-primary transition-colors ${
                    selectedImages.includes(image.id)
                      ? "border-2 border-primary"
                      : "border-border/50"
                  }`}
                  onClick={() => toggleImageSelection(image.id)}
                >
                  <div className="aspect-square relative">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-background/70 p-2 text-xs truncate">
                      {image.name}
                    </div>
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 bg-background/50"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageToRename(image);
                              setNewImageName(image.name);
                              setRenameImageDialogOpen(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setImagesToMove([image]);
                              setMoveImageDialogOpen(true);
                            }}
                          >
                            <MoveRight className="mr-2 h-4 w-4" />
                            Move
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(image.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {uniqueImageArray.map((image) => (
                <div
                  key={`${image.id}-${image.updated_at}`}
                  className={`flex items-center p-2 rounded border ${
                    selectedImages.includes(image.id)
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:bg-muted/20"
                  }`}
                  onClick={() => toggleImageSelection(image.id)}
                >
                  <div className="h-10 w-10 mr-4 overflow-hidden rounded">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="flex-1 truncate">{image.name}</div>
                  <div className="flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToRename(image);
                            setNewImageName(image.name);
                            setRenameImageDialogOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagesToMove([image]);
                            setMoveImageDialogOpen(true);
                          }}
                        >
                          <MoveRight className="mr-2 h-4 w-4" />
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(image.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}

          {uniqueImageArray.length === 0 && (
            <div className="text-center py-12">
              <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No images found. Upload some images to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
