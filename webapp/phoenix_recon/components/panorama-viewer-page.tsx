"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";

// Dynamically import ReactPhotoSphereViewer to avoid SSR issues
const ReactPhotoSphereViewer = dynamic(
  () =>
    import("react-photo-sphere-viewer").then(
      (mod) => mod.ReactPhotoSphereViewer
    ),
  { ssr: false }
);

interface PanoramaViewerPageProps {
  projectId: string;
}

/** Minimal shape for your panorama_images table. Adjust fields as needed. */
interface PanoramaImage {
  id: string;
  project_id: string;
  url: string;
}

/** The shape of grid_items: index => imageId or null */
type GridItemMap = Record<string, string | null>;

export default function PanoramaViewerPage({
  projectId,
}: PanoramaViewerPageProps) {
  const supabase = createClient();

  // State for grid
  const [rows, setRows] = useState<number>(0);
  const [cols, setCols] = useState<number>(0);
  const [gridItems, setGridItems] = useState<GridItemMap>({});

  // State for images
  const [allPanoramas, setAllPanoramas] = useState<PanoramaImage[]>([]);

  // The currently selected panorama URL to show in the viewer
  const [currentPanoramaUrl, setCurrentPanoramaUrl] = useState<string | null>(
    null
  );

  // Fetch grid + images on mount
  useEffect(() => {
    const fetchGridAndImages = async () => {
      try {
        // 1) Fetch the panorama_grid row for this project
        const { data: gridData, error: gridError } = await supabase
          .from("panorama_grid")
          .select("*")
          .eq("project_id", projectId)
          .single();

        if (gridError) {
          console.error("Error fetching panorama_grid:", gridError);
          return;
        }
        if (gridData) {
          setRows(gridData.rows);
          setCols(gridData.cols);
          setGridItems(gridData.grid_items || {});
        }

        // 2) Fetch all panorama_images for this project
        const { data: imagesData, error: imagesError } = await supabase
          .from("panorama_images")
          .select("*")
          .eq("project_id", projectId);

        if (imagesError) {
          console.error("Error fetching panorama_images:", imagesError);
          return;
        }
        if (imagesData) {
          setAllPanoramas(imagesData);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    };

    fetchGridAndImages();
  }, [projectId, supabase]);

  /** Handle clicking a cell in the grid. If assigned, show that panorama in the viewer. */
  const handleCellClick = (cellIndex: number) => {
    const imageId = gridItems[String(cellIndex)];
    if (!imageId) return; // unassigned => do nothing

    // Find the corresponding panorama in allPanoramas
    const pano = allPanoramas.find((p) => p.id === imageId);
    if (pano) {
      setCurrentPanoramaUrl(pano.url);
    } else {
      console.warn("No panorama found for imageId:", imageId);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* LEFT SIDE: The Grid */}
      <div className="w-1/4 p-4 border-r border-gray-300 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Locations Grid</h2>
        {rows > 0 && cols > 0 ? (
          <div
            className="grid gap-3 place-items-center"
            style={{
              gridTemplateRows: `repeat(${rows}, 120px)`,
              gridTemplateColumns: `repeat(${cols}, 120px)`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, i) => {
              const imageId = gridItems[String(i)];
              const isAssigned = Boolean(imageId);
              // If assigned, find the panorama's URL for a small preview
              const assignedPano = isAssigned
                ? allPanoramas.find((p) => p.id === imageId)
                : null;

              return (
                <div
                  key={i}
                  onClick={() => isAssigned && handleCellClick(i)}
                  className={`relative w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all 
                    ${
                      isAssigned
                        ? "border-blue-500 bg-blue-100 hover:bg-blue-200 cursor-pointer"
                        : "border-dashed border-gray-300 bg-gray-200 cursor-not-allowed opacity-60"
                    }`}
                >
                  {assignedPano ? (
                    <img
                      src={assignedPano.url}
                      alt={`Panorama ${imageId}`}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-sm text-gray-500">Unassigned</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">
            No grid data found. Check if panorama_grid is set up for this
            project.
          </p>
        )}
      </div>

      {/* RIGHT SIDE: Panorama Viewer */}
      <div className="flex-1 p-4 relative bg-gray-50">
        {currentPanoramaUrl ? (
          <ReactPhotoSphereViewer
            src={currentPanoramaUrl}
            height="100%"
            width="100%"
            navbar={["zoom", "fullscreen"]}
            minFov={30}
            maxFov={90}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-500">
            Select a grid location to view its panorama
          </div>
        )}
      </div>
    </div>
  );
}
