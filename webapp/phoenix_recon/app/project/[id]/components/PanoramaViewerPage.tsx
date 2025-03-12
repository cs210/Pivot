"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";

// Dynamically import ReactPhotoSphereViewer to avoid SSR issues
const ReactPhotoSphereViewer = dynamic(
  () =>
    import("react-photo-sphere-viewer").then(
      (mod) => mod.ReactPhotoSphereViewer
    ),
  { ssr: false }
);

interface Marker {
  id: string;
  position: {
    yaw?: number; // in radians
    pitch?: number; // in radians
    longitude?: number; // in radians
    latitude?: number; // in radians
  };
  tooltip?:
    | string
    | {
        content: string; // annotation text
        position?: string;
      };
  content?: string;
  image?: string; // optional image for the marker
  size?: {
    width: number;
    height: number;
  };
  anchor?: string;
  html?: string;
}

interface PanoramaImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  markers?: Marker[];
  annotations?: any[]; // For backward compatibility
}

/** The shape of grid_items: index => imageId or null */
type GridItemMap = Record<string, string | null>;

export default function PanoramaViewerPage({
  projectId,
}: {
  projectId: string;
}) {
  const supabase = createClient();

  // Use an HTML marker instead of an image that might not exist
  const USE_HTML_MARKER = true;

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

  // State for marker interaction
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);

  // For marker editing
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [markerInput, setMarkerInput] = useState<string>("");

  // References
  const viewerRef = useRef<HTMLDivElement>(null);
  const photoViewerRef = useRef<any>(null);
  const markersPluginRef = useRef<any>(null);

  // Cleanup viewer on unmount or when changing panoramas
  useEffect(() => {
    return () => {
      if (photoViewerRef.current?.viewer) {
        try {
          console.log("Cleaning up viewer instance");
          photoViewerRef.current.viewer.destroy();
        } catch (error) {
          console.error("Error cleaning up viewer:", error);
        }
      }
    };
  }, []);

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
          // Process the images to standardize marker format
          const processedImages = imagesData.map((img) => {
            // Determine which field to use (markers or annotations)
            let markersData = null;

            if (img.hasOwnProperty("markers") && Array.isArray(img.markers)) {
              markersData = img.markers;
            } else if (
              img.hasOwnProperty("annotations") &&
              Array.isArray(img.annotations)
            ) {
              // Convert annotations format to markers format
              markersData = img.annotations.map((anno) => ({
                id: `marker-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
                position: {
                  yaw: anno.longitude,
                  pitch: anno.latitude,
                },
                tooltip: anno.note || "No description",
                html: '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>',
                anchor: "center center",
              }));
            }

            // Default to empty array if no valid markers found
            return {
              ...img,
              markers: markersData || [],
            };
          });

          console.log("Loaded panorama images with markers:", processedImages);
          setAllPanoramas(processedImages);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    };

    fetchGridAndImages();
  }, [projectId, supabase]);

  // Direct data verification function - check Supabase for markers
  const verifyMarkersInDatabase = async (imageId) => {
    try {
      console.log("Directly querying Supabase for image:", imageId);

      const { data, error } = await supabase
        .from("panorama_images")
        .select("*")
        .eq("id", imageId)
        .single();

      if (error) {
        console.error("Error querying image data:", error);
        return;
      }

      console.log("Full image data:", data);
      console.log("Column names:", Object.keys(data));

      if (data.markers) {
        console.log("Markers data:", data.markers);
        console.log(
          `Found ${
            Array.isArray(data.markers) ? data.markers.length : 0
          } markers`
        );
        if (Array.isArray(data.markers)) {
          data.markers.forEach((marker, index) => {
            console.log(`Marker ${index}:`, marker);
            console.log(`  Has position:`, !!marker.position);
            console.log(`  Has tooltip:`, !!marker.tooltip);
            console.log(`  Has html:`, !!marker.html);
            console.log(`  Has image:`, !!marker.image);
          });
        }
      }

      if (data.annotations) {
        console.log("Annotations data:", data.annotations);
        console.log(
          `Found ${
            Array.isArray(data.annotations) ? data.annotations.length : 0
          } annotations`
        );
        if (Array.isArray(data.annotations)) {
          data.annotations.forEach((anno, index) => {
            console.log(`Annotation ${index}:`, anno);
            console.log(`  Has longitude:`, !!anno.longitude);
            console.log(`  Has latitude:`, !!anno.latitude);
            console.log(`  Has note:`, !!anno.note);
          });
        }
      }

      return data;
    } catch (err) {
      console.error("Error verifying markers:", err);
      return null;
    }
  };

  /** Handle clicking a cell in the grid. If assigned, show that panorama in the viewer. */
  const handleCellClick = (cellIndex: number) => {
    const imageId = gridItems[String(cellIndex)];
    if (!imageId) return; // unassigned => do nothing

    // Find the corresponding panorama in allPanoramas
    const pano = allPanoramas.find((p) => p.id === imageId);
    if (pano) {
      console.log("Selected panorama:", pano.id);
      console.log(
        "Panorama has markers:",
        pano.markers ? `Yes (${pano.markers.length})` : "No"
      );

      // Verify markers directly from database
      verifyMarkersInDatabase(pano.id);

      // Reset state
      setEditingMarker(null);
      setMarkerInput("");

      // Clean up existing viewer if needed
      if (photoViewerRef.current?.viewer) {
        try {
          console.log("Cleaning up existing viewer");
          markersPluginRef.current = null;
          photoViewerRef.current.viewer.destroy();
        } catch (error) {
          console.error("Error cleaning up viewer:", error);
        }
      }

      // Set the new panorama
      setCurrentPanorama(pano);
    } else {
      console.warn("No panorama found for imageId:", imageId);
    }
  };

  // Handle marker click
  const handleMarkerClick = (marker) => {
    console.log("handleMarkerClick called for", marker);
    setEditingMarker(marker.id);
    // Get the tooltip content regardless of format
    let content = "";
    if (typeof marker.tooltip === "string") {
      content = marker.tooltip;
    } else if (marker.tooltip && marker.tooltip.content) {
      content = marker.tooltip.content;
    }
    setMarkerInput(content);
  };

  // Handle saving marker annotation
  const handleSaveMarkerAnnotation = async () => {
    if (!currentPanorama || !editingMarker) return;

    try {
      // Use the markersPluginRef instead of trying to get it from photoViewerRef
      if (!markersPluginRef.current) {
        console.error("MarkersPlugin reference not found!");
        return;
      }

      console.log("Updating marker with ID:", editingMarker);

      // Update the marker tooltip in the viewer
      markersPluginRef.current.updateMarker({
        id: editingMarker,
        tooltip: markerInput,
      });

      // Update in our state
      const updatedMarkers = currentPanorama.markers.map((marker) => {
        if (marker.id === editingMarker) {
          return {
            ...marker,
            tooltip: markerInput,
          };
        }
        return marker;
      });

      // Detect which column to use in the database
      const { data } = await supabase
        .from("panorama_images")
        .select("*")
        .eq("id", currentPanorama.id)
        .single();

      let updateColumn =
        data && "annotations" in data ? "annotations" : "markers";
      console.log(`Using database column: ${updateColumn}`);

      // Save to database
      const updateData = {};
      updateData[updateColumn] = updatedMarkers;

      const { error } = await supabase
        .from("panorama_images")
        .update(updateData)
        .eq("id", currentPanorama.id);

      if (error) {
        console.error(`Error updating ${updateColumn}:`, error);
        return;
      }

      // Update state
      const updatedPanorama = { ...currentPanorama, markers: updatedMarkers };
      setCurrentPanorama(updatedPanorama);
      setAllPanoramas((prev) =>
        prev.map((p) => (p.id === currentPanorama.id ? updatedPanorama : p))
      );

      // Close dialog
      setEditingMarker(null);
      setMarkerInput("");

      console.log("Marker updated successfully");
    } catch (err) {
      console.error("Error saving marker:", err);
    }
  };

  // Handle removing a marker
  const handleRemoveMarker = async () => {
    if (!currentPanorama || !editingMarker) return;

    try {
      // Use the markersPluginRef instead of trying to get it from photoViewerRef
      if (!markersPluginRef.current) {
        console.error("MarkersPlugin reference not found!");
        return;
      }

      console.log("Removing marker with ID:", editingMarker);

      // Remove the marker from the viewer
      markersPluginRef.current.removeMarker(editingMarker);

      // Remove from our state
      const updatedMarkers = currentPanorama.markers.filter(
        (marker) => marker.id !== editingMarker
      );

      // Detect which column to use in the database
      const { data } = await supabase
        .from("panorama_images")
        .select("*")
        .eq("id", currentPanorama.id)
        .single();

      let updateColumn =
        data && "annotations" in data ? "annotations" : "markers";
      console.log(`Using database column: ${updateColumn}`);

      // Save to database
      const updateData = {};
      updateData[updateColumn] = updatedMarkers;

      const { error } = await supabase
        .from("panorama_images")
        .update(updateData)
        .eq("id", currentPanorama.id);

      if (error) {
        console.error(`Error updating ${updateColumn}:`, error);
        return;
      }

      // Update state
      const updatedPanorama = { ...currentPanorama, markers: updatedMarkers };
      setCurrentPanorama(updatedPanorama);
      setAllPanoramas((prev) =>
        prev.map((p) => (p.id === currentPanorama.id ? updatedPanorama : p))
      );

      // Close dialog
      setEditingMarker(null);
      setMarkerInput("");

      console.log("Marker removed successfully");
    } catch (err) {
      console.error("Error removing marker:", err);
    }
  };

  // Initialize viewer and plugins exactly as in the example
  const initializeViewer = (instance) => {
    if (!instance || !currentPanorama) return;

    console.log("Initializing viewer with instance:", instance);

    try {
      // Store references for later use
      markersPluginRef.current = instance.getPlugin(MarkersPlugin);

      if (!markersPluginRef.current) {
        console.error("Could not get MarkersPlugin!");
        return;
      }

      console.log(
        "MarkersPlugin initialized successfully:",
        markersPluginRef.current
      );

      // Ensure the current markers are actually loaded in the plugin
      console.log("Current markers in state:", currentPanorama.markers);

      if (currentPanorama.markers && currentPanorama.markers.length > 0) {
        // Clear existing markers to be safe
        try {
          markersPluginRef.current.clearMarkers();
        } catch (e) {
          console.error("Error clearing markers:", e);
        }

        // Add each marker individually
        currentPanorama.markers.forEach((marker) => {
          console.log("Adding pre-existing marker to viewer:", marker);
          try {
            // Make sure each marker has HTML if not using image
            const markerToAdd =
              !marker.html && !marker.image
                ? {
                    ...marker,
                    html: '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>',
                    anchor: marker.anchor || "center center",
                  }
                : marker;

            markersPluginRef.current.addMarker(markerToAdd);
          } catch (e) {
            console.error("Error adding marker:", e, marker);
          }
        });
      }

      // Set click event to add markers - just like in the example
      instance.addEventListener("click", (e) => {
        if (!e.data.rightClick) {
          console.log("Click detected at:", e.data);

          // Create marker with a unique ID
          const markerId = `marker-${Date.now()}`;

          // Create a marker - use HTML marker instead of image for reliability
          const newMarker = USE_HTML_MARKER
            ? {
                id: markerId,
                position: {
                  yaw: e.data.yaw,
                  pitch: e.data.pitch,
                },
                html: '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>',
                anchor: "center center",
                tooltip: "New marker",
              }
            : {
                id: markerId,
                position: {
                  yaw: e.data.yaw,
                  pitch: e.data.pitch,
                },
                image: "/assets/pin-red.png", // This path might not exist
                size: { width: 32, height: 32 },
                anchor: "bottom center",
                tooltip: "New marker",
              };

          console.log("Adding new marker:", newMarker);

          // Add the marker to the viewer
          markersPluginRef.current.addMarker(newMarker);

          // Open edit dialog for this new marker
          setEditingMarker(markerId);
          setMarkerInput("New marker");

          // Update our state
          const updatedMarkers = [
            ...(currentPanorama.markers || []),
            newMarker,
          ];
          const updatedPanorama = {
            ...currentPanorama,
            markers: updatedMarkers,
          };

          setCurrentPanorama(updatedPanorama);
          setAllPanoramas((prev) =>
            prev.map((p) => (p.id === currentPanorama.id ? updatedPanorama : p))
          );
        }
      });

      // Handle marker clicks
      markersPluginRef.current.addEventListener("select-marker", (event) => {
        console.log("Marker selected:", event.marker);
        handleMarkerClick(event.marker);
      });
    } catch (error) {
      console.error("Error in initializeViewer:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* TOP: Panorama Viewer */}
      <div ref={viewerRef} className="flex-1 p-4 relative bg-gray-50">
        {/* Control buttons */}
        <div className="absolute top-2 right-2 z-10 flex space-x-2">
          <button
            className="bg-gray-500 text-white px-3 py-1 rounded"
            onClick={() => setShowDebugOverlay(!showDebugOverlay)}
          >
            {showDebugOverlay ? "Hide Debug" : "Show Debug"}
          </button>
        </div>

        {/* Marker editing modal */}
        {editingMarker && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black border border-gray-300 p-4 rounded shadow-lg z-50">
            <h3 className="font-bold mb-2">Edit Marker Annotation</h3>
            <textarea
              className="w-64 h-32 bg-gray-800 border border-gray-300 p-2 mb-3"
              value={markerInput}
              onChange={(e) => setMarkerInput(e.target.value)}
              placeholder="Enter annotation text..."
            />
            <div className="flex justify-between">
              <button
                className="px-3 py-1 bg-red-500 text-white rounded"
                onClick={handleRemoveMarker}
              >
                Delete
              </button>
              <div>
                <button
                  className="mr-2 px-3 py-1 bg-gray-300 rounded"
                  onClick={() => {
                    setEditingMarker(null);
                    setMarkerInput("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                  onClick={handleSaveMarkerAnnotation}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug overlay */}
        {currentPanorama && showDebugOverlay && (
          <div className="absolute bottom-4 left-4 bg-black text-white p-4 rounded shadow z-30 max-w-md">
            <h3 className="font-bold">Debug Information</h3>
            <div className="mt-2 text-xs space-y-1">
              <p>
                <strong>Panorama ID:</strong> {currentPanorama.id}
              </p>
              <p>
                <strong>Markers:</strong> {currentPanorama.markers?.length || 0}
              </p>
            </div>

            {currentPanorama.markers && currentPanorama.markers.length > 0 && (
              <div className="mt-2">
                <p className="font-bold text-sm">Marker Data:</p>
                <div className="mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32 text-xs">
                  <pre>{JSON.stringify(currentPanorama.markers, null, 2)}</pre>
                </div>
              </div>
            )}

            <div className="mt-2 flex space-x-2">
              <button
                onClick={async () => {
                  console.log("Current panorama:", currentPanorama);
                  await verifyMarkersInDatabase(currentPanorama.id);
                }}
                className="bg-gray-200 text-black px-2 py-1 rounded text-xs"
              >
                Log Details
              </button>
            </div>
          </div>
        )}

        {currentPanorama ? (
          <div key={`panorama-${currentPanorama.id}`} className="w-full h-full">
            <ReactPhotoSphereViewer
              ref={photoViewerRef}
              src={currentPanorama.url}
              height="100%"
              width="100%"
              plugins={[[MarkersPlugin, { markers: currentPanorama.markers }]]}
              navbar={["zoom", "fullscreen"]}
              minFov={30}
              maxFov={90}
              onReady={(instance) => {
                console.log("Panorama viewer is ready!");
                initializeViewer(instance);
              }}
            />
          </div>
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
                      {assignedPano.markers?.length > 0 && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {assignedPano.markers.length}
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
