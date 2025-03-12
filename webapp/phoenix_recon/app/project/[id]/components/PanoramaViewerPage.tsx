"use client";

import React, { useEffect, useState, useRef } from "react";
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

interface Annotation {
  longitude: number; // in radians, center of bounding box
  latitude: number; // in radians, center of bounding box
  angularWidth: number; // in radians, width of bounding box
  angularHeight: number; // in radians, height of bounding box
  note: string;
}

interface PanoramaImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  annotations: Annotation[];
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

  // The currently selected panorama image to show in the viewer
  const [currentPanorama, setCurrentPanorama] = useState<PanoramaImage | null>(
    null
  );

  // State and refs for annotation drawing
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [viewerInitialized, setViewerInitialized] = useState<boolean>(false);
  const [forceRerender, setForceRerender] = useState<number>(0);
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(true);

  interface Rect {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }
  const [drawingRect, setDrawingRect] = useState<Rect | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<Rect | null>(null);
  const [annotationNote, setAnnotationNote] = useState<string>("");

  // This state is updated on each camera change so we recalc overlay positions
  const [viewerUpdate, setViewerUpdate] = useState<number>(Date.now());

  const viewerRef = useRef<HTMLDivElement>(null);
  const photoViewerRef = useRef<any>(null);

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
          // Make sure annotation arrays are properly initialized and valid
          const processedImages = imagesData.map((img) => {
            // Validate annotation format - must be an array
            let processedAnnotations = [];

            // Handle null or undefined annotations
            if (!img.annotations) {
              processedAnnotations = [];
            }
            // Handle array annotations (correct format)
            else if (Array.isArray(img.annotations)) {
              processedAnnotations = img.annotations;
            }
            // Handle object annotations (incorrect format - convert to array)
            else if (typeof img.annotations === "object") {
              console.warn(
                `Image ${img.id} had non-array annotations, converting to array`
              );
              processedAnnotations = [img.annotations];
            }

            // Ensure each annotation has all required fields
            processedAnnotations = processedAnnotations.filter((anno) => {
              if (!anno || typeof anno !== "object") return false;
              const hasRequiredFields =
                typeof anno.longitude === "number" &&
                typeof anno.latitude === "number" &&
                typeof anno.angularWidth === "number" &&
                typeof anno.angularHeight === "number";

              if (!hasRequiredFields) {
                console.warn("Filtered out invalid annotation:", anno);
              }

              return hasRequiredFields;
            });

            console.log(
              `Image ${img.id} has ${processedAnnotations.length} valid annotations`
            );

            return {
              ...img,
              annotations: processedAnnotations,
            };
          });

          console.log(
            "Loaded panorama images with annotations:",
            processedImages
          );
          setAllPanoramas(processedImages);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    };

    fetchGridAndImages();
  }, [projectId, supabase]);

  // Direct data verification function - check Supabase for annotations
  const verifyAnnotationsInDatabase = async (imageId) => {
    try {
      console.log("Directly querying Supabase for image:", imageId);
      const { data, error } = await supabase
        .from("panorama_images")
        .select("annotations")
        .eq("id", imageId)
        .single();

      if (error) {
        console.error("Error querying annotations:", error);
        return;
      }

      console.log("Raw annotation data from Supabase:", data.annotations);
      if (data.annotations) {
        if (Array.isArray(data.annotations)) {
          console.log(
            `Found ${data.annotations.length} annotations in database`
          );
        } else {
          console.log(
            "Warning: annotations in database is not an array:",
            typeof data.annotations
          );
        }
      } else {
        console.log("No annotations found in database");
      }
    } catch (err) {
      console.error("Error verifying annotations:", err);
    }
  };

  // Force a rerender every 2 seconds when viewing an image
  useEffect(() => {
    if (!currentPanorama) return;

    const interval = setInterval(() => {
      // Only force update if there are annotations to display
      if (currentPanorama?.annotations?.length > 0) {
        console.log("Forcing rerender to update annotation positions");
        setForceRerender((prev) => prev + 1);
        setViewerUpdate(Date.now());
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentPanorama]);

  // Update annotations when viewer position changes or when panorama changes
  useEffect(() => {
    if (photoViewerRef.current?.viewer) {
      setViewerInitialized(true);
      console.log(
        "Viewer updated, annotations should be visible",
        currentPanorama?.annotations?.length > 0
          ? "and has annotations"
          : "but no annotations"
      );
    }
  }, [viewerUpdate, currentPanorama, forceRerender]);

  /** Handle clicking a cell in the grid. If assigned, show that panorama in the viewer. */
  const handleCellClick = (cellIndex: number) => {
    const imageId = gridItems[String(cellIndex)];
    if (!imageId) return; // unassigned => do nothing

    // Find the corresponding panorama in allPanoramas
    const pano = allPanoramas.find((p) => p.id === imageId);
    if (pano) {
      console.log("Selected panorama:", pano.id);
      console.log(
        "Panorama has annotations:",
        pano.annotations ? `Yes (${pano.annotations.length})` : "No"
      );
      if (pano.annotations && pano.annotations.length > 0) {
        console.log("Annotations:", pano.annotations);
      }

      // Verify annotations directly from database
      verifyAnnotationsInDatabase(pano.id);

      // Reset state for clean initialization
      setIsAnnotating(false);
      setViewerInitialized(false);
      setPendingAnnotation(null);
      setDrawingRect(null);

      // Set the new panorama
      setCurrentPanorama(pano);
    } else {
      console.warn("No panorama found for imageId:", imageId);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAnnotating) return;
    // If an annotation pop-up is already open, don't start a new one
    if (pendingAnnotation) return;
    if (!viewerRef.current) return;
    // If the click originates from an element with class 'prevent-draw', do nothing
    if ((e.target as HTMLElement).closest(".prevent-draw")) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setDrawingRect({ startX, startY, endX: startX, endY: startY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAnnotating || !drawingRect) return;
    if (!viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    setDrawingRect({ ...drawingRect, endX, endY });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAnnotating || !drawingRect) return;
    setPendingAnnotation(drawingRect);
    setDrawingRect(null);
  };

  // Render the active drawing rectangle during annotation
  const renderDrawingRect = () => {
    if (!drawingRect || !isAnnotating) return null;

    const left = Math.min(drawingRect.startX, drawingRect.endX);
    const top = Math.min(drawingRect.startY, drawingRect.endY);
    const width = Math.abs(drawingRect.endX - drawingRect.startX);
    const height = Math.abs(drawingRect.endY - drawingRect.startY);

    return (
      <div
        className="absolute border-2 border-red-500 bg-red-200 bg-opacity-30 z-20 pointer-events-none"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      />
    );
  };

  // Function to render all annotations safely
  const renderAnnotations = () => {
    if (
      !currentPanorama?.annotations?.length ||
      !viewerRef.current ||
      !photoViewerRef.current?.viewer
    ) {
      return null;
    }

    try {
      return currentPanorama.annotations.map((anno, index) => {
        try {
          const containerRect = viewerRef.current.getBoundingClientRect();

          // Skip if the viewer doesn't have toScreenPosition method
          if (
            typeof photoViewerRef.current.viewer.toScreenPosition !== "function"
          ) {
            console.warn("toScreenPosition method not available");
            return null;
          }

          // Convert the spherical coordinate to screen position
          const screenPos = photoViewerRef.current.viewer.toScreenPosition({
            longitude: anno.longitude,
            latitude: anno.latitude,
          });

          // Skip if screenPos is null or undefined
          if (!screenPos) {
            // console.warn("Couldn't calculate screen position for annotation", index);
            return null;
          }

          // Calculate box dimensions
          const boxWidth =
            (anno.angularWidth / (2 * Math.PI)) * containerRect.width;
          const boxHeight =
            (anno.angularHeight / Math.PI) * containerRect.height;
          const left = screenPos.x - boxWidth / 2;
          const top = screenPos.y - boxHeight / 2;

          // Check if the point is within the visible area with some margin
          const margin = 50; // pixels
          const isVisible =
            screenPos.x >= -margin &&
            screenPos.x <= containerRect.width + margin &&
            screenPos.y >= -margin &&
            screenPos.y <= containerRect.height + margin;

          // Skip rendering if point is not in view
          if (!isVisible) {
            return null;
          }

          return (
            <div
              key={index}
              style={{
                position: "absolute",
                left,
                top,
                width: boxWidth,
                height: boxHeight,
                border: "2px solid green",
                backgroundColor: "rgba(0, 255, 0, 0.2)",
                zIndex: 15,
                pointerEvents: "auto",
              }}
              className="group"
              onClick={(e) => {
                e.stopPropagation();
                console.log("Clicked annotation:", anno);
              }}
            >
              <div className="hidden group-hover:block absolute bg-green-500 text-white text-xs p-1 -top-8 left-0 z-20 min-w-[100px]">
                {anno.note || "No description"}
              </div>
            </div>
          );
        } catch (error) {
          console.error("Error rendering annotation:", error);
          return null;
        }
      });
    } catch (error) {
      console.error("Error in renderAnnotations:", error);
      return null;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* TOP: Panorama Viewer */}
      <div
        ref={viewerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 p-4 relative bg-gray-50"
      >
        {isAnnotating && (
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 5,
              background: "transparent",
              pointerEvents: "all",
            }}
          />
        )}

        {/* Render the current drawing rectangle during active annotation */}
        {renderDrawingRect()}

        {/* Control buttons */}
        <div className="absolute top-2 right-2 z-10 flex space-x-2">
          {currentPanorama && (
            <button
              className="prevent-draw bg-blue-500 text-white px-3 py-1 rounded"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsAnnotating((prev) => !prev);
              }}
            >
              {isAnnotating ? "Exit Annotation Mode" : "Enter Annotation Mode"}
            </button>
          )}

          <button
            className="prevent-draw bg-gray-500 text-white px-3 py-1 rounded"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowDebugOverlay((prev) => !prev);
            }}
          >
            {showDebugOverlay ? "Hide Debug" : "Show Debug"}
          </button>

          <button
            className="prevent-draw bg-green-500 text-white px-3 py-1 rounded"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setViewerUpdate(Date.now());
              setForceRerender((prev) => prev + 1);
            }}
          >
            Refresh View
          </button>
        </div>

        {pendingAnnotation && viewerRef.current && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="prevent-draw absolute bg-black border border-gray-300 p-2 z-20"
            style={{
              left: Math.min(pendingAnnotation.startX, pendingAnnotation.endX),
              top:
                Math.min(pendingAnnotation.startY, pendingAnnotation.endY) - 40,
            }}
          >
            <textarea
              className="w-48 h-16 border bg-gray-800"
              value={annotationNote}
              onChange={(e) => setAnnotationNote(e.target.value)}
              placeholder="Enter annotation note..."
            />
            <div className="mt-2 flex justify-end">
              <button
                className="mr-2 px-2 py-1 bg-gray-800 rounded"
                onClick={() => {
                  setPendingAnnotation(null);
                  setAnnotationNote("");
                }}
              >
                Cancel
              </button>
              <button
                className="px-2 py-1 bg-blue-500 text-white rounded"
                onClick={async () => {
                  if (!currentPanorama || !viewerRef.current) return;
                  const containerRect =
                    viewerRef.current.getBoundingClientRect();
                  const rectX = Math.min(
                    pendingAnnotation.startX,
                    pendingAnnotation.endX
                  );
                  const rectY = Math.min(
                    pendingAnnotation.startY,
                    pendingAnnotation.endY
                  );
                  const rectWidth = Math.abs(
                    pendingAnnotation.endX - pendingAnnotation.startX
                  );
                  const rectHeight = Math.abs(
                    pendingAnnotation.endY - pendingAnnotation.startY
                  );
                  const centerX = rectX + rectWidth / 2;
                  const centerY = rectY + rectHeight / 2;
                  const percentageX = centerX / containerRect.width;
                  const percentageY = centerY / containerRect.height;
                  const longitude = (percentageX - 0.5) * 2 * Math.PI;
                  const latitude = (0.5 - percentageY) * Math.PI;
                  const angularWidth =
                    (rectWidth / containerRect.width) * (2 * Math.PI);
                  const angularHeight =
                    (rectHeight / containerRect.height) * Math.PI;
                  const newAnnotation = {
                    longitude,
                    latitude,
                    angularWidth,
                    angularHeight,
                    note: annotationNote,
                  };

                  // Make sure we have an annotations array to work with
                  const currentAnnotations = Array.isArray(
                    currentPanorama.annotations
                  )
                    ? currentPanorama.annotations
                    : [];

                  const updatedAnnotations = [
                    ...currentAnnotations,
                    newAnnotation,
                  ];

                  console.log("Creating new annotation:", newAnnotation);
                  console.log("Updated annotations array:", updatedAnnotations);

                  // Create a new panorama object to ensure state updates properly
                  const updatedPanorama = {
                    ...currentPanorama,
                    annotations: updatedAnnotations,
                  };

                  // Save to backend
                  try {
                    const { data, error } = await supabase
                      .from("panorama_images")
                      .update({ annotations: updatedAnnotations })
                      .eq("id", currentPanorama.id)
                      .select();

                    if (error) {
                      console.error("Error updating annotations:", error);
                      alert("Failed to save annotation: " + error.message);
                    } else {
                      console.log(
                        "Successfully saved annotations to Supabase, response:",
                        data
                      );

                      // Verify the annotations were saved correctly
                      await verifyAnnotationsInDatabase(currentPanorama.id);

                      // Update current panorama state
                      setCurrentPanorama(updatedPanorama);

                      // Also update the panorama in allPanoramas
                      setAllPanoramas((prev) =>
                        prev.map((p) =>
                          p.id === currentPanorama.id ? updatedPanorama : p
                        )
                      );

                      // Force a viewer update
                      setViewerUpdate(Date.now());
                      setForceRerender((prev) => prev + 1);
                    }
                  } catch (err) {
                    console.error("Unexpected error saving annotation:", err);
                    alert(
                      "An unexpected error occurred when saving the annotation"
                    );
                  }

                  setPendingAnnotation(null);
                  setAnnotationNote("");
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Render annotations overlay using our safe renderer function */}
        <div
          className="annotation-overlay"
          key={`overlay-${forceRerender}-${viewerUpdate}`}
        >
          {renderAnnotations()}
        </div>

        {/* Add a debug panel to show annotation status */}
        {currentPanorama && showDebugOverlay && (
          <div className="absolute bottom-4 left-4 bg-black p-4 rounded shadow z-30 max-w-md">
            <h3 className="font-bold">Debug Information</h3>
            <div className="mt-2 text-xs space-y-1">
              <p>
                <strong>Panorama ID:</strong> {currentPanorama.id}
              </p>
              <p>
                <strong>Annotations:</strong>{" "}
                {currentPanorama.annotations?.length || 0}
              </p>
              <p>
                <strong>Viewer initialized:</strong>{" "}
                {viewerInitialized ? "Yes" : "No"}
              </p>
              <p>
                <strong>Annotation mode:</strong> {isAnnotating ? "Yes" : "No"}
              </p>
              <p>
                <strong>Force rerender count:</strong> {forceRerender}
              </p>
              <p>
                <strong>Viewer update:</strong>{" "}
                {new Date(viewerUpdate).toLocaleTimeString()}
              </p>
            </div>

            {currentPanorama.annotations &&
              currentPanorama.annotations.length > 0 && (
                <div className="mt-2">
                  <p className="font-bold text-sm">Annotation Data:</p>
                  <div className="mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32 text-xs">
                    <pre>
                      {JSON.stringify(currentPanorama.annotations, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

            <div className="mt-2 flex space-x-2">
              <button
                onClick={async () => {
                  console.log("Current panorama:", currentPanorama);
                  console.log("Viewer ref:", photoViewerRef.current);
                  await verifyAnnotationsInDatabase(currentPanorama.id);
                }}
                className="bg-gray-200 px-2 py-1 rounded text-xs"
              >
                Log Details
              </button>

              <button
                onClick={() => {
                  setViewerUpdate(Date.now());
                  setForceRerender((prev) => prev + 1);
                }}
                className="bg-blue-200 px-2 py-1 rounded text-xs"
              >
                Force Refresh
              </button>
            </div>
          </div>
        )}

        {currentPanorama ? (
          <ReactPhotoSphereViewer
            ref={photoViewerRef}
            src={currentPanorama.url}
            height="100%"
            width="100%"
            navbar={["zoom", "fullscreen"]}
            minFov={30}
            maxFov={90}
            onPositionChange={() => {
              // Update the view state when camera moves
              setViewerUpdate(Date.now());
            }}
            onReady={() => {
              console.log("Panorama viewer is ready!");
              setViewerInitialized(true);
              // Force an update after viewer is ready
              setTimeout(() => {
                setViewerUpdate(Date.now());
                setForceRerender((prev) => prev + 1);
              }, 500);
            }}
            plugins={[]}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-500">
            Select a grid location to view its panorama
          </div>
        )}
      </div>

      {/* BOTTOM: Grid */}
      <div className="p-4 border-t border-gray-300 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Locations Grid</h2>
        {rows > 0 && cols > 0 ? (
          <div
            className="grid gap-3 place-items-center w-max mx-auto"
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
                    <>
                      <img
                        src={assignedPano.url}
                        alt={`Panorama ${imageId}`}
                        className="w-full h-full object-cover rounded-full"
                      />
                      {assignedPano.annotations?.length > 0 && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {assignedPano.annotations.length}
                        </div>
                      )}
                    </>
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
    </div>
  );
}
