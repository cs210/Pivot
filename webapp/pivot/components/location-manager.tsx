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
import { MapPin, Plus, Image as ImageIcon, Trash2 } from "lucide-react";

interface LocationManagerProps {
  userId: string;
  images: any[];
  onImageAssigned: () => void;
}

export default function LocationManager({
  userId,
  images,
  onImageAssigned,
}: LocationManagerProps) {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [locationImages, setLocationImages] = useState<any[]>([]);
  const supabase = createClient();

  // Fetch locations and their images
  useEffect(() => {
    if (userId) {
      fetchLocations();
    }
  }, [userId]);

  // Fetch images for the selected location
  useEffect(() => {
    if (selectedLocation) {
      fetchLocationImages(selectedLocation.id);
    } else {
      setLocationImages([]);
    }
  }, [selectedLocation]);

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

      // Transform the data
      const locationImages = data?.map((item) => item.images) || [];
      setLocationImages(locationImages);
    } catch (error) {
      console.error("Error fetching location images:", error);
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
      if (selectedLocation?.id === locationId) {
        setSelectedLocation(null);
      }
    } catch (error) {
      console.error("Error deleting location:", error);
    }
  };

  const addImageToLocation = async (imageId: string) => {
    if (!selectedLocation) return;

    try {
      const { error } = await supabase.from("location_images").insert({
        location_id: selectedLocation.id,
        image_id: imageId,
      });

      if (error) throw error;

      // Refresh location images
      fetchLocationImages(selectedLocation.id);
      onImageAssigned();
    } catch (error) {
      console.error("Error adding image to location:", error);
    }
  };

  const removeImageFromLocation = async (imageId: string) => {
    if (!selectedLocation) return;

    try {
      const { error } = await supabase
        .from("location_images")
        .delete()
        .eq("location_id", selectedLocation.id)
        .eq("image_id", imageId);

      if (error) throw error;

      // Refresh location images
      fetchLocationImages(selectedLocation.id);
      onImageAssigned();
    } catch (error) {
      console.error("Error removing image from location:", error);
    }
  };

  const getAvailableImages = () => {
    // Return images that are not already in the selected location
    const locationImageIds = locationImages.map((img) => img.id);
    return images.filter((img) => !locationImageIds.includes(img.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Locations</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" className="bg-cyber-gradient">
              <Plus className="mr-2 h-4 w-4" /> Create Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Location</DialogTitle>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your Locations</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-4">Loading locations...</div>
            ) : locations.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No locations yet. Create your first location.
              </div>
            ) : (
              <div className="space-y-2">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className={`p-2 rounded-md cursor-pointer hover:bg-background/50 border border-border/50 ${
                      selectedLocation?.id === location.id
                        ? "bg-primary/10 border-primary"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div
                        className="flex items-center space-x-2"
                        onClick={() => setSelectedLocation(location)}
                      >
                        <MapPin
                          className={`h-4 w-4 ${
                            selectedLocation?.id === location.id
                              ? "text-primary"
                              : ""
                          }`}
                        />
                        <span>{location.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLocation(location.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedLocation
                ? `Images in ${selectedLocation.name}`
                : "Select a location"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedLocation ? (
              <div className="text-center py-4 text-muted-foreground">
                Select a location to manage its images
              </div>
            ) : (
              <div className="space-y-3">
                {locationImages.length === 0 ? (
                  <p className="text-muted-foreground">
                    No images in this location
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {locationImages.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="h-16 w-16 object-cover rounded-md"
                        />
                        <button
                          onClick={() => removeImageFromLocation(image.id)}
                          className="absolute top-1 right-1 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedLocation && (
        <Card className="bg-background/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Add Images to {selectedLocation.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {getAvailableImages().length === 0 ? (
                <p className="text-muted-foreground">
                  All images are already added to this location
                </p>
              ) : (
                getAvailableImages().map((image) => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="h-14 w-14 object-cover rounded-md cursor-pointer border border-dashed border-border/50 hover:border-primary"
                      onClick={() => addImageToLocation(image.id)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-primary/10">
                      <Plus className="h-5 w-5" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
