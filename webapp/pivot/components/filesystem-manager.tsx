"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  Plus,
  Image as ImageIcon,
  Trash2,
  Folder,
  MoreVertical,
  FilePlus,
  FolderPlus,
  ArrowLeft,
  X,
} from "lucide-react";
import ImageUploader from "@/components/image-uploader";

interface FileSystemManagerProps {
  userId: string;
  images: any[];
  onImageAssigned: () => void;
}

// Types for our file system
type FSItemType = "location" | "image" | "root";

interface FSItem {
  id: string;
  name: string;
  type: FSItemType;
  description?: string;
  url?: string;
  parent?: string; // Parent ID ("root" for top-level, location ID for images)
}

export default function FileSystemManager({
  userId,
  images,
  onImageAssigned,
}: FileSystemManagerProps) {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationDesc, setLocationDesc] = useState("");

  // File system navigation state
  const [currentPath, setCurrentPath] = useState<string[]>(["root"]);
  const [fileSystemItems, setFileSystemItems] = useState<FSItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FSItem | null>(null);

  // Add state to track drag operations
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const supabase = createClient();

  // Load locations and build file system hierarchy
  useEffect(() => {
    if (userId) {
      fetchLocations();
    }
  }, [userId]);

  // Update file system items when navigating or when locations/images change
  useEffect(() => {
    buildFileSystemView();
  }, [currentPath, locations, images]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationImages = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from("location_images")
        .select(
          `
          image_id,
          images:image_id(*)
        `
        )
        .eq("location_id", locationId);

      if (error) throw error;

      // Add debugging
      console.log(`Raw location images data for ${locationId}:`, data);

      // Check if we have any data
      if (!data || data.length === 0) {
        console.log("No images found for this location");
        return [];
      }

      // Return the images, ensure item.images exists before accessing its properties
      const filteredImages = data
        .map((item) => {
          if (!item.images) {
            console.log("Missing images data for item", item);
            return null;
          }
          return item.images;
        })
        .filter(Boolean);

      console.log("Processed images:", filteredImages);
      return filteredImages;
    } catch (error) {
      console.error("Error fetching location images:", error);
      return [];
    }
  };

  // Build the file system view based on current path
  const buildFileSystemView = async () => {
    const currentLocation = currentPath[currentPath.length - 1];
    let items: FSItem[] = [];

    if (currentLocation === "root") {
      // At root, show all locations
      items = locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        type: "location" as FSItemType,
        description: loc.description,
        parent: "root",
      }));

      // Also include unassigned images at root
      const assignedImageIds = await getAllAssignedImageIds();
      const unassignedImages = images.filter(
        (img) => !assignedImageIds.includes(img.id)
      );

      items = [
        ...items,
        ...unassignedImages.map((img) => ({
          id: img.id,
          name: img.name,
          type: "image" as FSItemType,
          url: img.url,
          parent: "root",
        })),
      ];
    } else {
      // Inside a location, show its images
      console.log(`Fetching images for location: ${currentLocation}`);
      const locationImages = await fetchLocationImages(currentLocation);
      console.log(
        `Got ${locationImages.length} images for location: ${currentLocation}`
      );

      items = (Array.isArray(locationImages) ? locationImages.flat() : locationImages)
        .filter(
          (img): img is { id: string; name?: string; url: string } =>
            !!img && typeof img === "object" && !Array.isArray(img) && "id" in img
        )
        .map((img) => {
          console.log("Processing image:", img);
          return {
            id: img.id,
            name: img.name || "Unnamed Image",
            type: "image" as FSItemType,
            url: img.url,
            parent: currentLocation,
          };
        });
    }

    console.log(`Final items for ${currentLocation}:`, items);
    setFileSystemItems(items);
  };

  // Get all image IDs that are assigned to any location
  const getAllAssignedImageIds = async () => {
    try {
      const { data, error } = await supabase
        .from("location_images")
        .select("image_id");

      if (error) throw error;
      return (data || []).map((item) => item.image_id);
    } catch (error) {
      console.error("Error fetching assigned image IDs:", error);
      return [];
    }
  };

  const handleCreateLocation = async () => {
    if (!locationName.trim()) return;

    try {
      const { data, error } = await supabase
        .from("locations")
        .insert({
          name: locationName,
          description: locationDesc,
          user_id: userId,
        })
        .select();

      if (error) throw error;

      // Reset form and refresh locations
      setLocationName("");
      setLocationDesc("");
      setCreateDialogOpen(false);
      fetchLocations();
    } catch (error) {
      console.error("Error creating location:", error);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      const { error } = await supabase
        .from("locations")
        .delete()
        .eq("id", locationId);

      if (error) throw error;

      // Refresh locations
      fetchLocations();
      setSelectedItem(null);
    } catch (error) {
      console.error("Error deleting location:", error);
    }
  };

  const handleDeleteImage = async (imageId: string, locationId?: string) => {
    try {
      if (locationId && locationId !== "root") {
        // Just remove the image from this location
        const { error } = await supabase
          .from("location_images")
          .delete()
          .eq("location_id", locationId)
          .eq("image_id", imageId);

        if (error) throw error;
      } else {
        // This is unassigned image, might want to delete it entirely
        // For now, we'll just refresh the view
      }

      // Refresh view
      buildFileSystemView();
      onImageAssigned();
      setSelectedItem(null);
    } catch (error) {
      console.error("Error removing image:", error);
    }
  };

  const handleAddImageToLocation = async (
    imageId: string,
    locationId: string
  ) => {
    try {
      const { error } = await supabase.from("location_images").insert({
        location_id: locationId,
        image_id: imageId,
      });

      if (error) throw error;

      // Refresh view
      buildFileSystemView();
      onImageAssigned();
    } catch (error) {
      console.error("Error adding image to location:", error);
    }
  };

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    onImageAssigned();
  };

  const navigateToLocation = (locationId: string) => {
    setCurrentPath([...currentPath, locationId]);
    setSelectedItem(null);
  };

  const navigateUp = () => {
    if (currentPath.length > 1) {
      setCurrentPath(currentPath.slice(0, -1));
      setSelectedItem(null);
    }
  };

  const getCurrentLocationName = () => {
    if (currentPath.length === 1) return "Root";

    const locationId = currentPath[currentPath.length - 1];
    const location = locations.find((loc) => loc.id === locationId);
    return location ? location.name : "Unknown Location";
  };

  const handleDragStart = (e: React.DragEvent, item: FSItem) => {
    // For internal file system dragging
    e.dataTransfer.setData(
      "application/phoenix-recon",
      JSON.stringify({
        id: item.id,
        type: item.type,
        name: item.name,
      })
    );

    // For the grid drops, only set location data, not image data
    if (item.type === "location") {
      console.log(`Setting drag data for location: ${item.id}, ${item.name}`);
      e.dataTransfer.setData("locationId", item.id);
      e.dataTransfer.setData("locationName", item.name);

      e.dataTransfer.setData(
        "location",
        JSON.stringify({
          id: item.id,
          name: item.name,
        })
      );
    }

    // Set dragged item in state
    setDraggedItem(item.id);

    // Create appropriate drag image
    if (item.type === "image" && item.url) {
      const img = new Image();
      img.src = item.url;
      e.dataTransfer.setDragImage(img, 25, 25);
    } else if (item.type === "location") {
      // Use MapPin icon for location dragging
      const pinIcon = document.createElement("div");
      pinIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
      pinIcon.style.color = "var(--primary)";
      pinIcon.style.opacity = "0.9";
      document.body.appendChild(pinIcon);
      e.dataTransfer.setDragImage(pinIcon, 20, 20);
      setTimeout(() => document.body.removeChild(pinIcon), 0);
    }

    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent, item: FSItem) => {
    // Only allow dropping into locations
    if (item.type === "location") {
      e.preventDefault();
      setDropTarget(item.id);
    }
    e.stopPropagation();
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, targetItem: FSItem) => {
    e.preventDefault();
    setDropTarget(null);

    // Only allow dropping into locations
    if (targetItem.type !== "location") return;

    try {
      // Get the data from our custom format
      const dataString = e.dataTransfer.getData("application/phoenix-recon");
      if (!dataString) {
        console.log("No valid drag data found");
        return;
      }

      const { id: itemId, type: itemType } = JSON.parse(dataString);

      console.log(
        `Drop: itemId=${itemId}, itemType=${itemType}, target=${targetItem.id}`
      );

      // Find the source item
      const sourceItem = fileSystemItems.find((item) => item.id === itemId);
      if (!sourceItem) {
        console.error("Source item not found");
        return;
      }

      if (itemType === "image") {
        // Handle image drop
        if (sourceItem.parent !== "root") {
          await handleDeleteImage(itemId, sourceItem.parent);
        }
        await handleAddImageToLocation(itemId, targetItem.id);

        // Navigate into the target location
        navigateToLocation(targetItem.id);
      } else if (itemType === "location") {
        // For locations, implement a location relationship
        console.log(`Moving location ${sourceItem.name} to ${targetItem.name}`);

        // This would be where you'd implement your location hierarchy logic
        // For now, we'll just navigate to the target location
        navigateToLocation(targetItem.id);
      }
    } catch (error) {
      console.error("Error in drop handler:", error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold">File Explorer</h2>
          <div className="text-sm text-muted-foreground bg-background/50 px-2 py-0.5 rounded-md">
            {currentPath.length > 1 && (
              <button onClick={navigateUp} className="hover:text-primary mr-1">
                <ArrowLeft className="h-3 w-3 inline" />
              </button>
            )}
            <span>{getCurrentLocationName()}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="bg-cyber-gradient">
                <ImageIcon className="mr-2 h-4 w-4" /> Upload Image
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl w-[90vw] text-foreground bg-background">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  Upload New Image
                </DialogTitle>
              </DialogHeader>

              <ImageUploader
                userId={userId}
                onUploadSuccess={handleUploadSuccess}
                embedded={true}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="bg-cyber-gradient">
                <FolderPlus className="mr-2 h-4 w-4" /> New Location
              </Button>
            </DialogTrigger>
            <DialogContent className="text-foreground bg-background">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  Create New Location
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Location Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter location name"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe this location"
                    value={locationDesc}
                    onChange={(e) => setLocationDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateLocation}
                  disabled={!locationName.trim()}
                  className="bg-cyber-gradient"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : fileSystemItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {currentPath.length === 1 ? (
                <>No locations or unassigned images.</>
              ) : (
                <>This location is empty. Add images to it.</>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {fileSystemItems.map((item) => (
                <div
                  key={item.id}
                  className={`relative group p-2 rounded-md border ${
                    selectedItem?.id === item.id
                      ? "bg-primary/10 border-primary"
                      : dropTarget === item.id
                      ? "border-primary border-dashed bg-primary/5"
                      : "border-border/50 hover:bg-background/50 hover:border-border"
                  } flex flex-col items-center justify-center cursor-pointer transition-all`}
                  onClick={() => {
                    setSelectedItem(item);
                    if (item.type === "location") {
                      navigateToLocation(item.id);
                    }
                  }}
                  draggable={true} // Keep all items draggable for consistent UX
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={(e) => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item)}
                >
                  {item.type === "location" ? (
                    // Replace Folder icon with MapPin for locations
                    <MapPin className="h-12 w-12 mb-2 text-primary opacity-80" />
                  ) : (
                    <div className="aspect-square w-full mb-2 bg-muted flex items-center justify-center overflow-hidden rounded-sm">
                      {item.url ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          draggable={false} // Prevent default image drag
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <p className="text-xs text-center font-medium truncate w-full">
                    {item.name}
                  </p>

                  {/* Add drag indicator for both images and locations */}
                  {(item.type === "image" || item.type === "location") && (
                    <div className="absolute top-1 left-1 bg-background/70 rounded-full p-0.5 text-xs opacity-0 group-hover:opacity-100">
                      <MapPin className="h-3 w-3" />
                    </div>
                  )}

                  {/* Add drop indicator for locations */}
                  {item.type === "location" && draggedItem && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10 opacity-0 group-hover:opacity-100 rounded-md">
                      <p className="text-xs font-medium bg-background/80 px-2 py-1 rounded">
                        Drop to Add
                      </p>
                    </div>
                  )}

                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {item.type === "location" ? (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToLocation(item.id);
                              }}
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLocation(item.id);
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(item.id, item.parent);
                              }}
                            >
                              Remove
                            </DropdownMenuItem>
                            {currentPath.length === 1 && (
                              <DropdownMenuItem>
                                Move to Location
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Item Detail Panel */}
      {selectedItem && selectedItem.type === "image" && (
        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center space-x-2">
              <ImageIcon className="h-4 w-4" />
              <span>{selectedItem.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-48 h-48 bg-muted rounded-md overflow-hidden">
                {selectedItem.url && (
                  <img
                    src={selectedItem.url}
                    alt={selectedItem.name}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Image Details</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Location:{" "}
                  {currentPath.length > 1
                    ? getCurrentLocationName()
                    : "Unassigned"}
                </p>

                {currentPath.length === 1 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      Assign to Location:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {locations.map((location) => (
                        <Button
                          key={location.id}
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAddImageToLocation(
                              selectedItem.id,
                              location.id
                            )
                          }
                          className="text-xs"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {location.name}
                        </Button>
                      ))}
                      {locations.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No locations available
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
