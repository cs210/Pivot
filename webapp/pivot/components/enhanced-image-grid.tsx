"use client";

import { useState, useEffect } from "react";
import {
  Trash2,
  Image as ImageIcon,
  PlusCircle,
  Download,
  MapPin,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageGridConfig } from "./image-grid-config";

interface GridItem {
  id: string;
  imageId: string | null;
  locationId?: string | null;
  locationName?: string | null; // Add locationName field to store the name directly
  position: number;
  itemType?: "image" | "location";
}

interface Image {
  id: string;
  name: string;
  url: string;
  path: string;
}

interface EnhancedImageGridProps {
  images: Image[];
  initialGridItems?: GridItem[];
  onGridChange?: (items: GridItem[]) => void;
  locations?: any[];
}

export function EnhancedImageGrid({
  images,
  initialGridItems,
  onGridChange,
  locations = [],
}: EnhancedImageGridProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [gridItems, setGridItems] = useState<GridItem[]>(
    initialGridItems ||
      Array(rows * cols)
        .fill(null)
        .map((_, i) => ({
          id: `grid-${i}`,
          imageId: null,
          position: i,
        }))
  );
  const [showConfig, setShowConfig] = useState(false);
  const [highlightedCell, setHighlightedCell] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // Regenerate grid when rows/cols change
  useEffect(() => {
    const totalCells = rows * cols;

    if (gridItems.length !== totalCells) {
      // Keep existing image mappings where possible
      const newGridItems = Array(totalCells)
        .fill(null)
        .map((_, i) => {
          // If we have an existing item for this position, use it
          const existingItem = gridItems.find((item) => item.position === i);
          return (
            existingItem || {
              id: `grid-${i}`,
              imageId: null,
              position: i,
            }
          );
        });

      setGridItems(newGridItems);
      onGridChange?.(newGridItems);
    }
  }, [rows, cols]);

  useEffect(() => {
    // Log locations when they change to help with debugging
    console.log("Locations provided to EnhancedImageGrid:", locations);
  }, [locations]);

  const handleDragOver = (e: React.DragEvent, position: number) => {
    // Only allow drop for locations, not for images
    const locationId = e.dataTransfer.getData("locationId");

    // Since we can't access dataTransfer data during dragOver in some browsers,
    // check if it's a location by looking for a specific format
    const hasLocationData =
      e.dataTransfer.types.includes("locationId") ||
      e.dataTransfer.types.includes("location");

    if (hasLocationData) {
      e.preventDefault();
      setHighlightedCell(position);
    }
  };

  const handleDrop = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    setHighlightedCell(null);

    // Skip if it's an image - only allow locations
    if (e.dataTransfer.getData("imageId")) {
      return;
    }

    // Process only location drops
    const locationId = e.dataTransfer.getData("locationId");
    const locationName = e.dataTransfer.getData("locationName");

    if (locationId) {
      console.log(
        `Adding location to grid: ID=${locationId}, Name=${locationName}`
      );

      // Find the location in our locations array
      const location = locations.find((loc) => loc.id === locationId);

      // Use the location name from our locations array if available, otherwise use the one from the drag event
      const resolvedName = location?.name || locationName || "Unknown Location";

      const updatedItems = gridItems.map((item) =>
        item.position === position
          ? {
              ...item,
              locationId,
              locationName: resolvedName,
              imageId: null,
              itemType: "location" as const,
            }
          : item
      );

      setGridItems(updatedItems);
      onGridChange?.(updatedItems);
    }
  };

  const handleRemoveFromGrid = (position: number) => {
    const updatedItems = gridItems.map((item) =>
      item.position === position
        ? { ...item, imageId: null, locationId: null, itemType: undefined }
        : item
    );
    setGridItems(updatedItems);
    onGridChange?.(updatedItems);
  };

  const applyGridConfig = (newRows: number, newCols: number) => {
    setRows(newRows);
    setCols(newCols);
    setShowConfig(false);
  };

  const exportGrid = async () => {
    setExporting(true);
    const gridElement = document.getElementById("image-grid-container");
    if (!gridElement) {
      setExporting(false);
      return;
    }

    try {
      // Dynamically import html2canvas only when needed
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;

      const canvas = await html2canvas(gridElement);
      const dataUrl = canvas.toDataURL("image/png");

      // Create a download link
      const link = document.createElement("a");
      link.download = "image-grid-export.png";
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error exporting grid:", error);
      alert("Failed to export grid. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Debug log to check location data
  console.log("Available locations:", locations);

  // Improved helper function to get location name by ID
  const getLocationName = (locationId: string | null) => {
    if (!locationId) return "Unknown Location";

    console.log(`Finding location name for ID: ${locationId}`);
    const location = locations.find((loc) => loc.id === locationId);

    if (location) {
      console.log(`Found location: ${location.name}`);
      return location.name;
    } else {
      console.log(`Location not found for ID: ${locationId}`);
      return "Unknown Location";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold cyber-glow">Location Grid</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Drag and drop locations onto the circles to arrange your grid
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {showConfig ? "Hide Config" : "Configure Grid"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportGrid}
            disabled={exporting}
            className="flex items-center"
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export Grid"}
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="mb-6">
          <ImageGridConfig
            onApplyConfig={applyGridConfig}
            currentRows={rows}
            currentCols={cols}
          />
        </div>
      )}

      <div
        id="image-grid-container"
        className="bg-background/30 border border-border/50 rounded-lg p-6"
      >
        <div
          className="grid gap-6 place-items-center"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, auto)`,
          }}
        >
          {gridItems.map((item) => {
            const imageInSlot = item.imageId
              ? images.find((img) => img.id === item.imageId)
              : null;
            const isLocation = item.itemType === "location";

            // Use the stored location name if available
            const locationName =
              item.locationName ||
              (item.locationId
                ? getLocationName(item.locationId)
                : "Unknown Location");

            console.log(
              `Grid item ${item.position}: isLocation=${isLocation}, locationId=${item.locationId}, name=${locationName}`
            );

            return (
              <div className="flex flex-col items-center" key={item.id}>
                <div
                  onDragOver={(e) => handleDragOver(e, item.position)}
                  onDragEnter={(e) => handleDragOver(e, item.position)}
                  onDragLeave={() => setHighlightedCell(null)}
                  onDrop={(e) => handleDrop(e, item.position)}
                  className={`w-20 h-20 rounded-full relative flex items-center justify-center border-2 transition-all ${
                    imageInSlot || isLocation
                      ? "border-primary shadow-md"
                      : highlightedCell === item.position
                      ? "border-dashed border-primary scale-110 bg-primary/10"
                      : "border-dashed border-muted-foreground/50 hover:border-muted-foreground hover:bg-background/40"
                  }`}
                  style={{
                    background: imageInSlot
                      ? `url(${imageInSlot.url}) center/cover no-repeat`
                      : "transparent",
                  }}
                >
                  {imageInSlot || isLocation ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Display location pin if it's a location */}
                      {isLocation && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <MapPin className="h-12 w-12 text-primary opacity-80" />
                        </div>
                      )}

                      {/* Remove button - Now always visible and red */}
                      <button
                        onClick={() => handleRemoveFromGrid(item.position)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                        aria-label="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <MapPin className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>

                {/* Display location name if it's a location */}
                {isLocation && (
                  <span className="text-xs font-medium mt-2 text-center max-w-[100px] truncate">
                    {locationName}
                  </span>
                )}

                {/* Display image name if it's an image */}
                {imageInSlot && (
                  <span className="text-xs text-muted-foreground mt-1 text-center max-w-[100px] truncate">
                    {imageInSlot.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
