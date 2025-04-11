"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { Card } from "@/components/ui/card";

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

interface PanoramaImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  markers?: Marker[];
  annotations?: any[]; // This column now stores the marker data (position, tooltip, etc.)
}

/** The shape of grid_items: index => imageId or null */
type GridItemMap = Record<string, string | null>;

export default function PanoramaViewerPage({
  projectId,
}: {
  projectId: string;
}) {
  const supabase = createClient();
  // We'll always work with the "annotations" column now.
  const USE_HTML_MARKER = true;

  const [rows, setRows] = useState<number>(0);
  const [cols, setCols] = useState<number>(0);
  const [gridItems, setGridItems] = useState<GridItemMap>({});

  const [allPanoramas, setAllPanoramas] = useState<PanoramaImage[]>([]);
  const [currentPanorama, setCurrentPanorama] = useState<PanoramaImage | null>(
    null
  );
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [markerInput, setMarkerInput] = useState<string>("");

  const viewerRef = useRef<HTMLDivElement>(null);
  const photoViewerRef = useRef<any>(null);
  const markersPluginRef = useRef<any>(null);

  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

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
          const processedImages = imagesData.map((img) => {
            let markersData = null;

            // Use the annotations column to store marker data
            if (
              img.hasOwnProperty("annotations") &&
              Array.isArray(img.annotations)
            ) {
              markersData = img.annotations
                .map((anno) => {
                  // Use the existing annotation id if available
                  const markerId =
                    anno.id ||
                    `marker-${Date.now()}-${Math.random()
                      .toString(36)
                      .substr(2, 9)}`;

                  // Determine position:
                  // If anno.position exists, use that; otherwise fall back to legacy fields.
                  let position;
                  if (anno.position && typeof anno.position === "object") {
                    position = {
                      yaw:
                        anno.position.yaw !== undefined ? anno.position.yaw : 0,
                      pitch:
                        anno.position.pitch !== undefined
                          ? anno.position.pitch
                          : 0,
                    };
                  } else {
                    position = {
                      yaw: anno.longitude !== undefined ? anno.longitude : 0,
                      pitch: anno.latitude !== undefined ? anno.latitude : 0,
                    };
                  }

                  // Determine tooltip: use anno.tooltip (if provided) or fall back to anno.note.
                  const tooltip = anno.tooltip
                    ? typeof anno.tooltip === "object"
                      ? anno.tooltip
                      : { content: anno.tooltip }
                    : { content: anno.note || "No description" };

                  return {
                    id: markerId,
                    position,
                    tooltip,
                    html:
                      anno.html ||
                      '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>',
                    anchor: anno.anchor || "center center",
                  };
                })
                .map(processMarker)
                .filter(Boolean);
            } else if (
              img.hasOwnProperty("markers") &&
              Array.isArray(img.markers)
            ) {
              markersData = img.markers;
            }

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

  // Process and validate marker data to ensure proper position formatting
  const processMarker = (marker) => {
    if (!marker) return null;
    const processedMarker = { ...marker };

    if (!processedMarker.id) {
      processedMarker.id = `marker-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    }

    if (
      !processedMarker.position ||
      (typeof processedMarker.position === "object" &&
        processedMarker.position.yaw === undefined &&
        processedMarker.position.pitch === undefined &&
        processedMarker.position.longitude === undefined &&
        processedMarker.position.latitude === undefined)
    ) {
      console.warn("Marker missing position data:", marker);
      processedMarker.position = { yaw: 0, pitch: 0 };
    } else if (typeof processedMarker.position === "object") {
      const position = { ...processedMarker.position };
      processedMarker.position = {
        yaw:
          position.yaw !== undefined
            ? position.yaw
            : position.longitude !== undefined
            ? position.longitude
            : 0,
        pitch:
          position.pitch !== undefined
            ? position.pitch
            : position.latitude !== undefined
            ? position.latitude
            : 0,
      };
    }

    if (!processedMarker.html && !processedMarker.image) {
      processedMarker.html =
        '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>';
      processedMarker.anchor = processedMarker.anchor || "center center";
    }

    if (
      processedMarker.tooltip &&
      typeof processedMarker.tooltip === "object" &&
      processedMarker.tooltip.content
    ) {
      // Tooltip is already correctly formatted.
    } else if (
      processedMarker.tooltip &&
      typeof processedMarker.tooltip === "string"
    ) {
      processedMarker.tooltip = { content: processedMarker.tooltip };
    } else if (!processedMarker.tooltip) {
      processedMarker.tooltip = { content: "No description" };
    }

    return processedMarker;
  };

  // Directly verify markers stored in the annotations column
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
            console.log(
              `  Has position:`,
              !!anno.position || !!anno.longitude || !!anno.latitude
            );
            console.log(`  Has tooltip:`, !!anno.tooltip || !!anno.note);
            console.log(`  Has html:`, !!anno.html);
            console.log(`  Has image:`, !!anno.image);
          });
        }
      }
      return data;
    } catch (err) {
      console.error("Error verifying markers:", err);
      return null;
    }
  };

  const handleCellClick = (cellIndex: number) => {
    const imageId = gridItems[String(cellIndex)];
    if (!imageId) return;
    const pano = allPanoramas.find((p) => p.id === imageId);
    if (pano) {
      console.log("Selected panorama:", pano.id);
      console.log(
        "Panorama has markers:",
        pano.markers ? `Yes (${pano.markers.length})` : "No"
      );

      verifyMarkersInDatabase(pano.id);
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
      console.warn("No panorama found for imageId:", imageId);
    }
  };

  const handleMarkerClick = (marker) => {
    console.log("handleMarkerClick called for", marker);
    setEditingMarker(marker.id);

    let content = "";

    // Check if tooltip is a string or an object with content property
    if (typeof marker.tooltip === "string") {
      content = marker.tooltip;
    } else if (marker.tooltip && typeof marker.tooltip === "object") {
      // If it's an object, try to extract content property
      if (typeof marker.tooltip.content === "string") {
        content = marker.tooltip.content;
      } else if (marker.tooltip.content && marker.tooltip.content.textContent) {
        // If content is an HTML element, get its text content
        content = marker.tooltip.content.textContent;
      } else if (marker.tooltip.content) {
        // If it's something else try to stringify it safely
        try {
          content = String(marker.tooltip.content);
        } catch (e) {
          console.error("Could not convert tooltip content to string:", e);
          content = "";
        }
      }
    }

    // Clean up the content if it contains "[object HTMLDivElement]"
    if (content.includes("[object HTMLDivElement]")) {
      content = "";
    }

    setMarkerInput(content);
  };

  const handleSaveMarkerAnnotation = async () => {
    if (!currentPanorama || !editingMarker) return;

    try {
      if (!markersPluginRef.current) {
        console.error("MarkersPlugin reference not found!");
        return;
      }

      console.log("Updating marker with ID:", editingMarker);

      // Update the marker in the viewer with the new tooltip text.
      markersPluginRef.current.updateMarker({
        id: editingMarker,
        tooltip: { content: markerInput },
      });

      // Update the marker data in our state.
      const updatedMarkers = currentPanorama.markers.map((marker) => {
        if (marker.id === editingMarker) {
          const position = marker.position || {};
          const formattedPosition = {
            yaw:
              position.yaw !== undefined
                ? position.yaw
                : position.longitude !== undefined
                ? position.longitude
                : 0,
            pitch:
              position.pitch !== undefined
                ? position.pitch
                : position.latitude !== undefined
                ? position.latitude
                : 0,
          };

          return {
            ...marker,
            position: formattedPosition,
            tooltip: { content: markerInput },
          };
        }
        return marker;
      });

      console.log(
        "Updated marker:",
        updatedMarkers.find((m) => m.id === editingMarker)
      );

      // Always use the "annotations" column for saving marker data.
      const updateColumn = "annotations";
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

      const updatedPanorama = { ...currentPanorama, markers: updatedMarkers };
      setCurrentPanorama(updatedPanorama);
      setAllPanoramas((prev) =>
        prev.map((p) => (p.id === currentPanorama.id ? updatedPanorama : p))
      );

      setEditingMarker(null);
      setMarkerInput("");
      console.log("Marker updated successfully");
    } catch (err) {
      console.error("Error saving marker:", err);
    }
  };

  const handleRemoveMarker = async () => {
    if (!currentPanorama || !editingMarker) return;

    try {
      if (!markersPluginRef.current) {
        console.error("MarkersPlugin reference not found!");
        return;
      }

      console.log("Removing marker with ID:", editingMarker);
      markersPluginRef.current.removeMarker(editingMarker);

      const updatedMarkers = currentPanorama.markers.filter(
        (marker) => marker.id !== editingMarker
      );

      const updateColumn = "annotations";
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

      const updatedPanorama = { ...currentPanorama, markers: updatedMarkers };
      setCurrentPanorama(updatedPanorama);
      setAllPanoramas((prev) =>
        prev.map((p) => (p.id === currentPanorama.id ? updatedPanorama : p))
      );

      setEditingMarker(null);
      setMarkerInput("");
      console.log("Marker removed successfully");
    } catch (err) {
      console.error("Error removing marker:", err);
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
      console.log("Current markers in state:", currentPanorama.markers);

      if (currentPanorama.markers && currentPanorama.markers.length > 0) {
        try {
          markersPluginRef.current.clearMarkers();
        } catch (e) {
          console.error("Error clearing markers:", e);
        }

        const markersToAdd = currentPanorama.markers
          .map(processMarker)
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

      instance.addEventListener("click", (e) => {
        if (!e.data.rightClick) {
          console.log("Click detected at:", e.data);
          // Use a timestamp prefix that's consistent and can be checked later
          const timestamp = Date.now();
          const markerId = `marker-${timestamp}`;
          const newMarker = processMarker(
            USE_HTML_MARKER
              ? {
                  id: markerId,
                  position: {
                    yaw: e.data.yaw,
                    pitch: e.data.pitch,
                  },
                  html: '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: red; border: 2px solid white;"></div>',
                  anchor: "center center",
                  tooltip: { content: "" },
                }
              : {
                  id: markerId,
                  position: {
                    yaw: e.data.yaw,
                    pitch: e.data.pitch,
                  },
                  image: "/assets/pin-red.png",
                  size: { width: 32, height: 32 },
                  anchor: "bottom center",
                  tooltip: { content: "" },
                }
          );

          console.log("Adding new marker:", newMarker);
          markersPluginRef.current.addMarker(newMarker);

          setEditingMarker(markerId);
          setMarkerInput("");

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

      markersPluginRef.current.addEventListener("select-marker", (event) => {
        console.log("Marker selected:", event.marker);
        handleMarkerClick(event.marker);
      });
    } catch (error) {
      console.error("Error in initializeViewer:", error);
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
          <div className="absolute top-2 right-2 z-10 flex space-x-2">
            <button
              className="bg-gray-500 text-white px-3 py-1 rounded"
              onClick={() => setShowDebugOverlay(!showDebugOverlay)}
            >
              {showDebugOverlay ? "Hide Debug" : "Show Debug"}
            </button>
            <button
              className="bg-cyber-gradient text-white hover:opacity-90 px-3 py-1 rounded"
              onClick={() => setShowHelpModal(true)}
            >
              How to Annotate
            </button>
          </div>
          {showHelpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
                <h2 className="text-xl font-bold mb-4">How to Annotate</h2>
                <p className="mb-4">
                  Click anywhere on the image to drop a pin at that location. A
                  pop-up will let you a text label for each pin, allowing you to
                  annotate specific parts of the image.
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
          {editingMarker && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black border border-gray-300 p-4 rounded shadow-lg z-50 text-white">
              <h3 className="!text-white font-bold mb-2">
                Edit Marker Annotation
              </h3>
              <textarea
                className="w-64 h-32 bg-gray-800 border border-gray-300 p-2 mb-3 !text-white !placeholder-grey"
                value={markerInput}
                onChange={(e) => setMarkerInput(e.target.value)}
                placeholder="Enter annotation text..."
              />
              <div className="flex justify-between">
                {/* Only show Delete button for existing markers (not for new ones) */}
                {currentPanorama?.markers.some(
                  (marker) =>
                    marker.id === editingMarker &&
                    // Check if this marker existed before the current editing session
                    !editingMarker.startsWith(
                      `marker-${Date.now().toString().slice(0, 8)}`
                    )
                ) && (
                  <button
                    className="px-3 py-1 bg-red-500 text-white rounded"
                    onClick={handleRemoveMarker}
                  >
                    Delete
                  </button>
                )}
                <div
                  className={
                    currentPanorama?.markers.some(
                      (marker) =>
                        marker.id === editingMarker &&
                        !editingMarker.startsWith(
                          `marker-${Date.now().toString().slice(0, 8)}`
                        )
                    )
                      ? ""
                      : "ml-auto"
                  }
                >
                  <button
                    className="mr-2 px-3 py-1 bg-gray-300 rounded"
                    onClick={() => {
                      // For new markers, also remove the marker
                      if (
                        currentPanorama &&
                        editingMarker &&
                        editingMarker.startsWith(
                          `marker-${Date.now().toString().slice(0, 8)}`
                        )
                      ) {
                        handleRemoveMarker();
                      } else {
                        setEditingMarker(null);
                        setMarkerInput("");
                      }
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

          {currentPanorama && showDebugOverlay && (
            <div className="absolute bottom-4 left-4 bg-black text-white p-4 rounded shadow z-30 max-w-md">
              <h3 className="font-bold">Debug Information</h3>
              <div className="mt-2 text-xs space-y-1">
                <p>
                  <strong>Panorama ID:</strong> {currentPanorama.id}
                </p>
                <p>
                  <strong>Markers:</strong>{" "}
                  {currentPanorama.markers?.length || 0}
                </p>
              </div>

              {currentPanorama.markers &&
                currentPanorama.markers.length > 0 && (
                  <div className="mt-2">
                    <p className="font-bold text-sm">Marker Data:</p>
                    <div className="mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32 text-xs">
                      <pre>
                        {JSON.stringify(currentPanorama.markers, null, 2)}
                      </pre>
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
                  [MarkersPlugin, { markers: currentPanorama.markers }],
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
    </>
  );
}
