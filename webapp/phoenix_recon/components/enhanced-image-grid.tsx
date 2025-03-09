"use client";

import { useState, useEffect } from "react";
import { Trash2, Image as ImageIcon, PlusCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageGridConfig } from "./image-grid-config";

interface GridItem {
  id: string;
  imageId: string | null;
  position: number;
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
}

export function EnhancedImageGrid({
  images,
  initialGridItems,
  onGridChange,
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

  const handleDrop = (imageId: string, gridPosition: number) => {
    const updatedItems = gridItems.map((item) =>
      item.position === gridPosition ? { ...item, imageId } : item
    );
    setGridItems(updatedItems);
    onGridChange?.(updatedItems);
  };

  const handleRemoveFromGrid = (position: number) => {
    const updatedItems = gridItems.map((item) =>
      item.position === position ? { ...item, imageId: null } : item
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold cyber-glow">Image Grid</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Drag and drop images onto the circles to arrange your grid
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
            const imageInSlot = images.find((img) => img.id === item.imageId);
            return (
              <div
                key={item.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setHighlightedCell(item.position);
                }}
                onDragLeave={() => setHighlightedCell(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const imageId = e.dataTransfer.getData("imageId");
                  handleDrop(imageId, item.position);
                  setHighlightedCell(null);
                }}
                className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all ${
                  imageInSlot
                    ? "border-primary"
                    : highlightedCell === item.position
                    ? "border-dashed border-primary scale-110"
                    : "border-dashed border-muted-foreground/50"
                }`}
                style={{
                  background: imageInSlot
                    ? `url(${imageInSlot.url}) center/cover no-repeat`
                    : "transparent",
                }}
              >
                {imageInSlot ? (
                  <button
                    onClick={() => handleRemoveFromGrid(item.position)}
                    className="w-6 h-6 bg-background/80 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                ) : (
                  <div className="text-muted-foreground text-xs flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 mr-1" />
                    <span>Drop</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
