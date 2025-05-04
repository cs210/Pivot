"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { useGrids, GridNode } from "../../../../hooks/useGrids";
import { usePanoramas, Panorama } from "../../../../hooks/usePanoramas";

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
    yaw?: number;
    pitch?: number;
    longitude?: number;
    latitude?: number;
  };
  tooltip?:
    | string
    | {
        content: string;
        position?: string;
      };
  content?: string;
  image?: string;
  size?: {
    width: number;
    height: number;
  };
  anchor?: string;
  html?: string;
}

interface PanoramaViewerPageProps {
  projectId: string;
  isSharedView?: boolean;
}

export default function PanoramaViewerPage({
  projectId,
  isSharedView = false,
}: PanoramaViewerPageProps) {
  const supabase = createClient();
  const USE_HTML_MARKER = true;

  // Use our custom hooks
  const { currentGrid, rows, cols, gridNodes, fetchData, getNodeAtPosition } =
    useGrids(projectId);

  const {
    panoramas,
    loading: panoramasLoading,
    updatePanorama,
  } = usePanoramas(projectId);

  // State variables - ALL HOOKS MUST BE INSIDE THE COMPONENT FUNCTION
  const [currentPanorama, setCurrentPanorama] = useState<Panorama | null>(null);
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [markerInput, setMarkerInput] = useState<string>("");
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);  // MOVE THIS INSIDE

  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  const photoViewerRef = useRef<any>(null);
  const markersPluginRef = useRef<any>(null);

  // ALL EFFECTS MUST BE INSIDE THE COMPONENT FUNCTION
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      console.log("Fullscreen status changed:", isCurrentlyFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Cleanup viewer when component unmounts
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

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      await fetchData();
    };

    loadData();
  }, [projectId]);

  // Add this effect after your initial data fetch effect:
  useEffect(() => {
    // Automatically select the node at position (0,0) if it exists
    const autoSelectFirstNode = () => {
      if (rows > 0 && cols > 0) {
        const originNode = getNodeAtPosition(0, 0);
        if (originNode && originNode.panorama_id) {
          // Find the panorama that belongs to this node
          const pano = panoramas.find((p) => p.id === originNode.panorama_id);
          if (pano) {
            console.log("Auto-selecting origin panorama at (0,0):", pano.id);
            setCurrentPanorama(pano);
          }
        }
      }
    };

    // Only attempt to select a node if we have grid data and panoramas,
    // and no panorama is currently selected
    if (rows > 0 && cols > 0 && panoramas.length > 0 && !currentPanorama) {
      autoSelectFirstNode();
    }
  }, [rows, cols, panoramas, currentPanorama, getNodeAtPosition]);

  const handleCellClick = (x: number, y: number) => {
    const node = getNodeAtPosition(x, y);
    if (!node || !node.panorama_id) return;

    const pano = panoramas.find((p) => p.id === node.panorama_id);
    if (pano) {
      console.log("Selected panorama:", pano.id);
      console.log(
        "Panorama has markers:",
        pano.metadata?.annotations
          ? `Yes (${pano.metadata.annotations.length})`
          : "No"
      );
      setEditingMarker(null);
      setMarkerInput("");

      if (photoViewerRef.current?.viewer) {
        try {
          console.log("Cleaning up existing viewer");
          markersPluginRef.current = null;
          photoViewerRef.current.viewer.destroy();
        } catch (error) {
          console.error("Error cleaning up viewer:", error);
        }
      }

      setCurrentPanorama(pano);
    } else {
      console.warn("No panorama found for ID:", node.panorama_id);
    }
  };

  const initializeViewer = (instance) => {
    if (!instance || !currentPanorama) return;

    console.log("Initializing viewer with instance:", instance);

    try {
      markersPluginRef.current = instance.getPlugin(MarkersPlugin);

      if (!markersPluginRef.current) {
        console.error("Could not get MarkersPlugin!");
        return;
      }

      console.log(
        "MarkersPlugin initialized successfully:",
        markersPluginRef.current
      );

      const annotations = currentPanorama.metadata?.annotations || [];
      console.log("Current annotations in metadata:", annotations);

      if (annotations.length > 0) {
        try {
          markersPluginRef.current.clearMarkers();
        } catch (e) {
          console.error("Error clearing markers:", e);
        }

        const markersToAdd = annotations
          .map((anno) => {
            // Ensure we have all the marker properties needed for display
            if (anno.html) {
              return {
                ...anno,
                html:
                  anno.html ||
                  '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>',
                anchor: anno.anchor || "center center",
              };
            } else {
              return {
                ...anno,
                image: anno.image || "/assets/pin-red.png",
                size: anno.size || { width: 32, height: 32 },
                anchor: anno.anchor || "bottom center",
              };
            }
          })
          .filter(Boolean);

        console.log("Adding processed markers to viewer:", markersToAdd);

        markersToAdd.forEach((marker) => {
          try {
            markersPluginRef.current.addMarker(marker);
          } catch (e) {
            console.error("Error adding marker:", e, marker);
          }
        });
      }

      // Only add click handlers if not in shared (read-only) view
      if (!isSharedView) {
        instance.addEventListener("click", (e) => {
          if (!e.data.rightClick) {
            console.log("Click detected at:", e.data);
            const timestamp = Date.now();
            const markerId = `marker-${timestamp}`;

            // Create a full marker object with correct position
            const markerData = {
              id: markerId,
              position: {
                yaw: e.data.yaw,
                pitch: e.data.pitch,
              },
              tooltip: { content: "" },
            };

            if (USE_HTML_MARKER) {
              markerData.html =
                '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>';
              markerData.anchor = "center center";
            } else {
              markerData.image = "/assets/pin-red.png";
              markerData.size = { width: 32, height: 32 };
              markerData.anchor = "bottom center";
            }

            // Add the marker to the viewer
            markersPluginRef.current.addMarker(markerData);

            // Use a function update form to ensure we have the latest state
            setCurrentPanorama((prevPanorama) => {
              if (!prevPanorama) return prevPanorama;

              // Get the latest annotations from the current state
              const latestAnnotations =
                prevPanorama.metadata?.annotations || [];

              // Create updated metadata with the new marker added to existing annotations
              const updatedMetadata = {
                ...(prevPanorama.metadata || {}),
                annotations: [...latestAnnotations, markerData],
              };

              // Return updated panorama object
              return {
                ...prevPanorama,
                metadata: updatedMetadata,
              };
            });

            // Set editing state
            setEditingMarker(markerId);
            setMarkerInput("");
          }
        });
      }

      // For shared view, allow viewing marker info but not editing
      markersPluginRef.current.addEventListener("select-marker", (e) => {
        console.log("Marker select event:", e);
        console.log("Marker data keys:", Object.keys(e));
        
        if (!isSharedView) {
          // Different ways the marker data might be structured
          let markerId;
          let marker;
          
          // If e has a marker property
          if (e.marker) {
            marker = e.marker;
            markerId = marker.id;
          }
          // If e has an id property directly
          else if (e.id) {
            markerId = e.id;
            marker = e;
          }
          // If e has a data property
          else if (e.data && e.data.id) {
            markerId = e.data.id;
            marker = e.data;
          }
          
          console.log("Found marker ID:", markerId);
          console.log("Marker object:", marker);
          
          if (markerId) {
            // Find the actual marker object from our annotations
            const actualMarker = currentPanorama?.metadata?.annotations?.find(
              (anno) => anno.id === markerId
            );
            
            if (actualMarker) {
              console.log("Using actual marker from annotations:", actualMarker);
              handleMarkerClick(actualMarker);
            } else if (marker) {
              console.log("Using marker from event:", marker);
              handleMarkerClick(marker);
            } else {
              console.warn("No marker data found");
            }
          }
        }
      });
    } catch (error) {
      console.error("Error in initializeViewer:", error);
    }
  };

  const handleMarkerClick = (marker: Marker) => {
    if (isSharedView) return; // Don't allow editing in shared view
    
    // Safety check for marker object
    if (!marker || !marker.id) {
      console.error("Invalid marker object:", marker);
      return;
    }
  
    console.log("handleMarkerClick called for", marker);
    console.log("Raw marker object:", marker); // Debug log
    setEditingMarker(marker.id);
  
    // Extract content from tooltip
    let content = "";
    
    // Check if tooltip exists and process it
    if (marker.tooltip) {
      if (typeof marker.tooltip === "string") {
        content = marker.tooltip;
      } else if (typeof marker.tooltip === "object" && marker.tooltip.content) {
        content = marker.tooltip.content;
      } else if (typeof marker.tooltip === "object") {
        content = "";
        console.warn("Unexpected tooltip format:", marker.tooltip);
      }
    } else if (marker.content) {
      content = marker.content;
    }
  
    console.log("Extracted content:", content); // Debug log
    setMarkerInput(content);
  };

  // Save marker annotation
  const handleSaveMarkerAnnotation = async () => {
    if (
      isSharedView ||
      !currentPanorama ||
      !editingMarker ||
      !markersPluginRef.current
    )
      return;

    try {
      console.log("Updating marker with ID:", editingMarker);

      // Update the marker in the viewer with the new tooltip text
      const tooltipData = markerInput ? { content: markerInput } : { content: "" };
      markersPluginRef.current.updateMarker({
        id: editingMarker,
        tooltip: tooltipData,
      });

      // Always work with the latest state from currentPanorama
      const existingAnnotations = currentPanorama.metadata?.annotations || [];

      // Update the specific marker's tooltip
      const updatedAnnotations = existingAnnotations.map((marker) => {
        if (marker.id === editingMarker) {
          return {
            ...marker,
            tooltip: markerInput ? { content: markerInput } : { content: "" },
          };
        }
        return marker;
      });

      console.log(
        "About to save annotations:",
        JSON.stringify(updatedAnnotations, null, 2)
      );
      console.log("Total annotations count:", updatedAnnotations.length);

      // Prepare updated metadata
      const updatedMetadata = {
        ...(currentPanorama.metadata || {}),
        annotations: updatedAnnotations,
      };

      console.log(
        "Full metadata being saved:",
        JSON.stringify(updatedMetadata, null, 2)
      );

      // Save to database
      await updatePanorama(currentPanorama.id, {
        metadata: updatedMetadata,
      });

      // Update local state
      setCurrentPanorama({
        ...currentPanorama,
        metadata: updatedMetadata,
      });

      setEditingMarker(null);
      setMarkerInput("");
      console.log("Marker updated successfully");
    } catch (err) {
      console.error("Error saving marker:", err);
    }
  };

  // Handle marker removal
  const handleRemoveMarker = async () => {
    if (
      isSharedView ||
      !currentPanorama ||
      !editingMarker ||
      !markersPluginRef.current
    )
      return;

    try {
      console.log("Removing marker with ID:", editingMarker);

      // Remove from viewer
      markersPluginRef.current.removeMarker(editingMarker);

      // Get existing annotations and filter out the one to remove
      const existingAnnotations = currentPanorama.metadata?.annotations || [];
      const updatedAnnotations = existingAnnotations.filter(
        (marker) => marker.id !== editingMarker
      );

      // Prepare updated metadata
      const updatedMetadata = {
        ...(currentPanorama.metadata || {}),
        annotations: updatedAnnotations,
      };

      // Save to database
      await updatePanorama(currentPanorama.id, {
        metadata: updatedMetadata,
      });

      // Update local state
      setCurrentPanorama({
        ...currentPanorama,
        metadata: updatedMetadata,
      });

      setEditingMarker(null);
      setMarkerInput("");
      console.log("Marker removed successfully");
    } catch (err) {
      console.error("Error removing marker:", err);
    }
  };

  return (
    <>
      <style jsx global>{`
        .psv-tooltip,
        .psv-tooltip * {
          color: #fff !important;
        }
      `}</style>
      <div className="flex flex-col h-screen">
        {/* TOP: Panorama Viewer */}
        <div ref={viewerRef} className="flex-1 p-4 relative bg-gray-50">
          {/* Only show help button in editable mode */}
          {!isSharedView && (
            <div className="absolute top-2 right-2 z-10 flex space-x-2">
              <button
                className="bg-cyber-gradient text-white hover:opacity-90 px-3 py-1 rounded"
                onClick={() => setShowHelpModal(true)}
              >
                How to Annotate
              </button>
            </div>
          )}

          {showHelpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
                <h2 className="text-xl font-bold mb-4">How to Annotate</h2>
                <p className="mb-4">
                  Click anywhere on the image to drop a pin at that location. A
                  pop-up will let you add a text label for each pin, allowing
                  you to annotate specific parts of the image.
                </p>
                <p className="mb-4">
                  Hover over any existing pin to see its text label.
                </p>
                <p className="mb-4">
                  Click on any existing pin to edit the text label or delete the
                  pin.
                </p>
                <div className="flex justify-end">
                  <button
                    className="bg-cyber-gradient hover:bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={() => setShowHelpModal(false)}
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}

            {editingMarker && !isSharedView && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white border border-gray-300 p-4 rounded shadow-lg z-50 text-white">
              <h3 className="font-bold mb-2">Edit Marker Annotation</h3>
              <textarea
                className="w-64 h-32 bg-gray-100 border border-gray-300 p-2 mb-3 !text-black !placeholder-gray-500"
                value={markerInput}
                onChange={(e) => setMarkerInput(e.target.value)}
                placeholder="Enter annotation text..."
              />
              <div className="flex justify-between">
                <button
                  className="px-3 py-1 bg-[#bd7581] !text-white rounded"
                  onClick={handleRemoveMarker}
                >
                  Delete
                </button>
                <div>
                  <button
                    className="mr-2 px-3 py-1 bg-gray-300 hover:opacity-90 rounded"
                    onClick={() => {
                      // Check if this is a new marker that was just added
                      const isNewMarker =
                        editingMarker &&
                        editingMarker.startsWith("marker-") &&
                        !currentPanorama?.metadata?.annotations?.some(
                          (m) => m.id === editingMarker && m.tooltip?.content
                        );

                      if (isNewMarker) {
                        // If it's a new marker, remove it from the viewer
                        if (markersPluginRef.current) {
                          try {
                            markersPluginRef.current.removeMarker(
                              editingMarker
                            );
                          } catch (e) {
                            console.error(
                              "Error removing marker on cancel:",
                              e
                            );
                          }
                        }

                        // Also remove it from the panorama metadata
                        setCurrentPanorama((prevPanorama) => {
                          if (!prevPanorama) return prevPanorama;

                          const existingAnnotations =
                            prevPanorama.metadata?.annotations || [];
                          const updatedAnnotations = existingAnnotations.filter(
                            (marker) => marker.id !== editingMarker
                          );

                          return {
                            ...prevPanorama,
                            metadata: {
                              ...(prevPanorama.metadata || {}),
                              annotations: updatedAnnotations,
                            },
                          };
                        });
                      }

                      // Clear the editing state regardless
                      setEditingMarker(null);
                      setMarkerInput("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 bg-cyber-gradient hover:opacity-90 text-white rounded"
                    onClick={handleSaveMarkerAnnotation}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentPanorama ? (
            <div
              key={`panorama-${currentPanorama.id}`}
              className="w-full h-full text-w"
            >
              <ReactPhotoSphereViewer
                ref={photoViewerRef}
                src={currentPanorama.url}
                height="100%"
                width="100%"
                plugins={[
                  [
                    MarkersPlugin,
                    { markers: currentPanorama.metadata?.annotations || [] },
                  ],
                ]}
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
              {isSharedView
                ? "Loading panorama view..."
                : "Select a grid location to view its panorama"}
            </div>
          )}
        </div>

        {/* BOTTOM: Grid - Show simpler version in shared view */}
        <div className="p-4 border-t border-gray-300 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">
            {isSharedView ? "Navigation Map" : "Locations Grid"}
          </h2>
          {rows > 0 && cols > 0 ? (
            <div
              className="grid gap-3 place-items-center w-max mx-auto"
              style={{
                gridTemplateRows: `repeat(${rows}, 120px)`,
                gridTemplateColumns: `repeat(${cols}, 120px)`,
              }}
            >
              {Array.from({ length: rows }).map(
                (_, y) =>
                  Array.from({ length: cols })
                    .map((_, x) => {
                      const node = getNodeAtPosition(x, y);
                      const isAssigned = Boolean(node?.panorama_id);
                      const assignedPano = isAssigned
                        ? panoramas.find((p) => p.id === node?.panorama_id)
                        : null;

                      // In shared view, only show assigned panoramas
                      if (isSharedView && !isAssigned) {
                        return null; // Don't render unassigned cells in shared view
                      }

                      return (
                        <div
                          key={`${x}-${y}`}
                          onClick={() => isAssigned && handleCellClick(x, y)}
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
                                alt={`Panorama at (${x},${y})`}
                                className="w-full h-full object-cover rounded-full"
                              />
                              {assignedPano.metadata?.annotations?.length >
                                0 && (
                                <div className="absolute -top-2 -right-2 bg-[#bd7581] !text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                  {assignedPano.metadata.annotations.length}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">
                              Unassigned
                            </span>
                          )}
                        </div>
                      );
                    })
                    .filter(Boolean) // Filter out null values for shared view
              )}
            </div>
          ) : (
            <p className="text-gray-500">
              {isSharedView
                ? "Navigation map is not available."
                : "No grid data found. Check if panorama_grid is set up for this project."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
