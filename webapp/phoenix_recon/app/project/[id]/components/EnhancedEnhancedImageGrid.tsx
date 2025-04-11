"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { TabsContent } from "@/components/ui/tabs";
// Import an "X" icon from lucide-react
import { X } from "lucide-react";

interface PanoramaImage {
  id: string;
  url: string;
  name?: string;
}

type GridItemMap = Record<string, string | null>;

interface EnhancedImageGridProps {
  projectId: string;
}

export default function EnhancedImageGrid({
  projectId,
}: EnhancedImageGridProps) {
  const supabase = createClient();

  // Grid dimensions
  const [rows, setRows] = useState<number>(2);
  const [cols, setCols] = useState<number>(2);

  // All images for this project
  const [allImages, setAllImages] = useState<PanoramaImage[]>([]);
  // Unassigned images (not on the grid)
  const [unassigned, setUnassigned] = useState<PanoramaImage[]>([]);
  // Map cell index → imageId
  const [gridItems, setGridItems] = useState<GridItemMap>({});

  // Track which cell’s dropdown is currently open
  const [openDropdownCell, setOpenDropdownCell] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // 1) Try to get existing panorama_grid row for this project
      const { data: gridRow, error: gridError } = await supabase
        .from("panorama_grid")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (!gridError && gridRow) {
        setRows(gridRow.rows);
        setCols(gridRow.cols);
        setGridItems(gridRow.grid_items || {});
      } else {
        console.log("No existing grid or error fetching it:", gridError);
      }

      // 2) Fetch all 360 images from "panorama_images"
      const { data: imagesData, error: imagesError } = await supabase
        .from("panorama_images")
        .select("*")
        .eq("project_id", projectId);

      if (imagesError) {
        console.error("Error fetching 360 images:", imagesError);
        return;
      }
      if (!imagesData) {
        console.warn("No 360 images found for project:", projectId);
        return;
      }

      // Convert DB rows into our PanoramaImage shape
      const images: PanoramaImage[] = imagesData.map((item: any) => ({
        id: item.id,
        url: item.url,
        name: item.name,
      }));
      setAllImages(images);

      // Figure out which are unassigned
      const assignedIds = new Set(Object.values(gridRow?.grid_items || {}));
      const unassignedImages = images.filter((img) => !assignedIds.has(img.id));
      setUnassigned(unassignedImages);
    };

    fetchData();
  }, [projectId, supabase]);

  // Keep rows & cols numeric
  const handleChangeRows = (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = parseInt(e.target.value, 10);
    setRows(Number.isNaN(r) ? 1 : r);
  };
  const handleChangeCols = (e: React.ChangeEvent<HTMLInputElement>) => {
    const c = parseInt(e.target.value, 10);
    setCols(Number.isNaN(c) ? 1 : c);
  };

  // Assign an image to a cell
  const handleAssignImageToCell = (cellIndex: number, newImageId: string) => {
    const cellKey = cellIndex.toString();
    const oldImageId = gridItems[cellKey];

    setGridItems((prev) => ({
      ...prev,
      [cellKey]: newImageId,
    }));

    // Remove newImageId from unassigned
    setUnassigned((prev) => prev.filter((img) => img.id !== newImageId));

    // If the cell had an existing image, put it back in unassigned
    if (oldImageId) {
      const oldImageObj = allImages.find((img) => img.id === oldImageId);
      if (oldImageObj) {
        setUnassigned((prev) => [...prev, oldImageObj]);
      }
    }

    // Close the dropdown
    setOpenDropdownCell(null);
  };

  // Unassign the image from a cell (move it back to unassigned)
  const handleUnassignImageFromCell = (cellIndex: number) => {
    const cellKey = cellIndex.toString();
    const oldImageId = gridItems[cellKey];
    if (!oldImageId) return; // No image to remove

    // Return old image to unassigned
    const oldImageObj = allImages.find((img) => img.id === oldImageId);
    if (oldImageObj) {
      setUnassigned((prev) => [...prev, oldImageObj]);
    }

    // Clear the cell
    setGridItems((prev) => ({
      ...prev,
      [cellKey]: null,
    }));
  };

  // Save grid to DB
  const handleSaveGrid = async () => {
    const { data, error } = await supabase
      .from("panorama_grid")
      .upsert({
        project_id: projectId,
        rows,
        cols,
        grid_items: gridItems,
      })
      .single();

    if (error) {
      console.error("Error saving grid:", error);
    } else {
      console.log("Grid saved:", data);
      alert("Grid saved!");
    }
  };

  return (
    <TabsContent value="place-locations" className="p-4 space-y-6">
      {/* Top section with heading and row/col controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold cyber-glow">
            360 Panorama Grid
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose rows and columns, then assign images
          </p>
        </div>
        <div className="flex space-x-2">
          <label className="flex items-center space-x-2">
            <span className="text-sm font-medium">Rows:</span>
            <input
              type="number"
              min={1}
              value={rows}
              onChange={handleChangeRows}
              className="w-16 border border-border/50 rounded px-2 bg-cyber-gradient py-1"
            />
          </label>
          <label className="flex items-center space-x-2">
            <span className="text-sm font-medium">Cols:</span>
            <input
              type="number"
              min={1}
              value={cols}
              onChange={handleChangeCols}
              className="w-16 border border-border/50 rounded px-2 py-1 bg-cyber-gradient"
            />
          </label>
          <button
            onClick={handleSaveGrid}
            className="px-4 py-2 text-white rounded bg-cyber-gradient hover:opacity-90 transition-colors"
          >
            Save Grid
          </button>
        </div>
      </div>

      {/* Outer container for the grid */}
      <div className="bg-background/30 border border-border/50 rounded-lg p-6">
        {/* Center the grid horizontally */}
        <div className="flex justify-center">
          {/* The grid itself */}
          <div
            className="grid gap-6 place-items-center"
            style={{
              gridTemplateRows: `repeat(${rows}, 200px)`,
              gridTemplateColumns: `repeat(${cols}, 200px)`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, cellIndex) => {
              const cellKey = cellIndex.toString();
              const imageId = gridItems[cellKey];
              const found = allImages.find((img) => img.id === imageId);

              return (
                <div key={cellIndex} className="relative">
                  {/* Circle cell */}
                  <div
                    className={`w-28 h-28 rounded-full relative flex items-center justify-center border-2 transition-all cursor-pointer ${
                      found
                        ? "border-primary shadow-md"
                        : "border-dashed border-muted-foreground/50 hover:border-muted-foreground hover:bg-background/40"
                    }`}
                    onClick={() =>
                      setOpenDropdownCell((prev) =>
                        prev === cellIndex ? null : cellIndex
                      )
                    }
                  >
                    {found ? (
                      <>
                        <img
                          src={found.url}
                          alt={found.name || found.id}
                          className="w-full h-full object-cover rounded-full"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1 truncate">
                          {found.name || found.id}
                        </div>

                        {/* X button to unassign the image */}
                        <button
                          className="absolute top-0 right-0 m-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 focus:outline-none"
                          style={{ width: "1.25rem", height: "1.25rem" }}
                          onClick={(e) => {
                            e.stopPropagation(); // prevent cell click
                            handleUnassignImageFromCell(cellIndex);
                          }}
                          aria-label="Unassign image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">Empty</span>
                    )}
                  </div>

                  {/* Dropdown overlay, placed BELOW the circle using top-full & mt-2 */}
                  {openDropdownCell === cellIndex && (
                    <div
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 
                                 min-w-[300px] max-h-96 p-4 bg-grey border 
                                 shadow-md z-50 rounded-lg text-base overflow-auto"
                      style={{ width: "300px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="font-semibold mb-2 text-sm">
                        Assign an image to this location:
                      </p>
                      {unassigned.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No unassigned images
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {unassigned.map((img) => (
                            <li
                              key={img.id}
                              className="p-2 bg-gray hover:border cursor-pointer flex items-center rounded"
                              onClick={() =>
                                handleAssignImageToCell(cellIndex, img.id)
                              }
                            >
                              <img
                                src={img.url}
                                alt={img.name || img.id}
                                className="w-16 h-16 object-cover mr-3 rounded"
                              />
                              <span className="truncate">
                                {img.name || img.id}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
