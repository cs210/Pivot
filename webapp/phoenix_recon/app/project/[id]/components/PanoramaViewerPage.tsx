"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";

// Dynamically import ReactPhotoSphereViewer
const ReactPhotoSphereViewer = dynamic(
  () =>
    import("react-photo-sphere-viewer").then(
      (mod) => mod.ReactPhotoSphereViewer
    ),
  { ssr: false }
);

interface Marker {
  id: string;
  longitude: number; // in radians
  latitude: number; // in radians
  note: string;
}

interface PanoramaImage {
  id: string;
  project_id: string;
  name: string;
  url: string;
  annotations: any; // This will store our markers
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

  // State for marker creation
  const [isMarkerMode, setIsMarkerMode] = useState<boolean>(false);
  const [showMarkerDialog, setShowMarkerDialog] = useState<boolean>(false);
  const [markerNote, setMarkerNote] = useState<string>("");
  const [pendingMarkerPosition, setPendingMarkerPosition] = useState<any>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(true);

  // Keep track of DOM markers
  const [markerElements, setMarkerElements] = useState<React.ReactNode[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);

  // Refs
  const viewerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom CSS for markers
  useEffect(() => {
    // Add CSS for markers if it doesn't exist
    if (!document.getElementById("marker-styles")) {
      const style = document.createElement("style");
      style.id = "marker-styles";
      style.innerHTML = `
        .psv-marker {
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        .psv-marker:hover {
          opacity: 1;
        }
        .psv-marker--pin {
          width: 30px;
          height: 30px;
          background-color: rgba(0, 170, 0, 0.5);
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
        }
        .psv-marker--selected {
          background-color: rgba(255, 0, 0, 0.5);
        }
      `;
      document.head.appendChild(style);
    }
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
          // Process the images - we'll parse the markers from the annotations field
          setAllPanoramas(imagesData);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    };

    fetchGridAndImages();
  }, [projectId, supabase]);

  // Parse markers from annotations when current panorama changes
  useEffect(() => {
    if (!currentPanorama) {
      setMarkers([]);
      return;
    }

    try {
      // Extract markers from the annotations field
      let panoramaMarkers: Marker[] = [];

      // Handle different possible formats of the annotations field
      if (Array.isArray(currentPanorama.annotations)) {
        // If annotations is already an array of markers
        panoramaMarkers = currentPanorama.annotations.filter(
          (item) =>
            item &&
            typeof item === "object" &&
            "longitude" in item &&
            "latitude" in item
        );
      } else if (
        currentPanorama.annotations &&
        typeof currentPanorama.annotations === "object"
      ) {
        // If annotations is an object with markers property
        if (Array.isArray(currentPanorama.annotations.markers)) {
          panoramaMarkers = currentPanorama.annotations.markers;
        }
      }

      // Ensure each marker has an id
      panoramaMarkers = panoramaMarkers.map((marker, index) => ({
        ...marker,
        id: marker.id || `marker-${index}-${Date.now()}`,
      }));

      console.log("Parsed markers:", panoramaMarkers);
      setMarkers(panoramaMarkers);

      // Create marker elements when markers change
      createMarkerElements(panoramaMarkers);
    } catch (err) {
      console.error("Error parsing markers:", err);
      setMarkers([]);
    }
  }, [currentPanorama]);

  // Position markers whenever the view changes
  useEffect(() => {
    if (viewerRef.current && markers.length > 0) {
      const intervalId = setInterval(() => {
        positionMarkers();
      }, 100);

      return () => clearInterval(intervalId);
    }
  }, [viewerRef.current, markers]);

  // Handle clicking a cell in the grid
  const handleCellClick = (cellIndex: number) => {
    const imageId = gridItems[String(cellIndex)];
    if (!imageId) return; // unassigned => do nothing

    // Find the corresponding panorama in allPanoramas
    const pano = allPanoramas.find((p) => p.id === imageId);
    if (pano) {
      console.log("Selected panorama:", pano.id);

      // Reset state when selecting a new panorama
      setIsMarkerMode(false);
      setShowMarkerDialog(false);
      setPendingMarkerPosition(null);

      // Set the new panorama
      setCurrentPanorama(pano);
    } else {
      console.warn("No panorama found for imageId:", imageId);
    }
  };

  // Create DOM marker elements from markers data
  const createMarkerElements = (markersData: Marker[]) => {
    if (!markersData?.length) {
      setMarkerElements([]);
      return;
    }

    const elements = markersData.map((marker, index) => {
      return (
        <div
          key={`marker-${marker.id}-${index}`}
          className="psv-marker psv-marker--pin"
          data-marker-id={marker.id}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            // These will be positioned by the positioning function
            display: "none",
          }}
          onClick={(e) => {
            e.stopPropagation();
            alert(`Marker: ${marker.note || "No description"}`);
          }}
          title={marker.note || "No description"}
        />
      );
    });

    setMarkerElements(elements);
  };

  // Position marker elements based on their spherical coordinates
  const positionMarkers = () => {
    if (!markers.length || !viewerRef.current || !containerRef.current) {
      return;
    }

    try {
      // Get the container dimensions
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // Get the current position from the viewer
      let position;
      try {
        position = viewerRef.current.getPosition();
      } catch (e) {
        console.warn("Could not get viewer position:", e);
        return;
      }

      if (!position) return;

      // Current camera position in radians
      const cameraLong = position.longitude;
      const cameraLat = position.latitude;

      // Update each marker's position
      markers.forEach((marker) => {
        const markerElement = container.querySelector(
          `[data-marker-id="${marker.id}"]`
        ) as HTMLElement;
        if (!markerElement) return;

        // Calculate position difference between marker and camera
        const diffLong = marker.longitude - cameraLong;
        const diffLat = marker.latitude - cameraLat;

        // Normalize longitude difference to handle wrap-around (-PI to PI)
        const normalizedDiffLong =
          ((diffLong + Math.PI) % (2 * Math.PI)) - Math.PI;

        // Calculate if marker is in view (simplified approach)
        const inView =
          Math.abs(normalizedDiffLong) < Math.PI / 2 &&
          Math.abs(diffLat) < Math.PI / 2;

        if (inView) {
          // Convert spherical coordinates to screen position
          const relX = 0.5 + normalizedDiffLong / Math.PI;
          const relY = 0.5 - diffLat / Math.PI;

          // Apply to the marker element
          markerElement.style.left = `${relX * 100}%`;
          markerElement.style.top = `${relY * 100}%`;
          markerElement.style.display = "block";
        } else {
          // Hide if not in view
          markerElement.style.display = "none";
        }
      });
    } catch (err) {
      console.error("Error positioning markers:", err);
    }
  };

  // Save a new marker
  const saveMarker = async () => {
    if (!currentPanorama || !pendingMarkerPosition) return;

    try {
      // Create new marker object
      const newMarker: Marker = {
        id: `marker-${Date.now()}`,
        longitude: pendingMarkerPosition.longitude,
        latitude: pendingMarkerPosition.latitude,
        note: markerNote,
      };

      // Add to current markers
      const updatedMarkers = [...markers, newMarker];

      // Prepare annotations object - preserve existing annotations structure but update markers
      let updatedAnnotations;
      if (
        typeof currentPanorama.annotations === "object" &&
        !Array.isArray(currentPanorama.annotations)
      ) {
        // If annotations is an object with other properties, preserve them
        updatedAnnotations = {
          ...currentPanorama.annotations,
          markers: updatedMarkers,
        };
      } else {
        // Otherwise just use the markers array directly
        updatedAnnotations = updatedMarkers;
      }

      // Update current panorama in state
      const updatedPanorama = {
        ...currentPanorama,
        annotations: updatedAnnotations,
      };

      // Save to database
      const { error } = await supabase
        .from("panorama_images")
        .update({ annotations: updatedAnnotations })
        .eq("id", currentPanorama.id);

      if (error) {
        console.error("Error saving marker:", error);
        alert("Failed to save marker: " + error.message);
        return;
      }

      // Update state
      setCurrentPanorama(updatedPanorama);
      setAllPanoramas((prev) =>
        prev.map((p) => (p.id === currentPanorama.id ? updatedPanorama : p))
      );

      // Update markers
      setMarkers(updatedMarkers);
      createMarkerElements(updatedMarkers);

      console.log("Marker saved successfully:", newMarker);

      // Reset UI
      setMarkerNote("");
      setShowMarkerDialog(false);
      setPendingMarkerPosition(null);
    } catch (err) {
      console.error("Error saving marker:", err);
      alert("An error occurred while saving the marker: " + err.message);
    }
  };

  // Toggle marker creation mode
  const toggleMarkerMode = () => {
    setIsMarkerMode((prev) => !prev);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* TOP: Panorama Viewer */}
      <div
        ref={containerRef}
        className="flex-1 p-4 relative bg-gray-50"
        style={{
          cursor: isMarkerMode ? "crosshair" : "grab",
        }}
      >
        {/* Panorama Viewer */}
        {currentPanorama ? (
          <ReactPhotoSphereViewer
            ref={viewerRef}
            src={currentPanorama.url}
            height="100%"
            width="100%"
            navbar={["zoom", "fullscreen"]}
            minFov={30}
            maxFov={90}
            onClick={(e) => {
              // Only handle clicks in marker mode
              if (!isMarkerMode) return;

              try {
                // Get click position - should be in spherical coordinates
                const position = e.data.viewer.getPosition();
                const clickPosition = e.data.texture;

                if (!clickPosition) {
                  console.error("No click position data available");
                  return;
                }

                console.log("Click position:", clickPosition);

                // Prepare to add a new marker
                setPendingMarkerPosition({
                  longitude: clickPosition.longitude,
                  latitude: clickPosition.latitude,
                });
                setShowMarkerDialog(true);
              } catch (err) {
                console.error("Error handling click:", err);
              }
            }}
            onPositionUpdate={(position) => {
              // Update marker positions when the view changes
              positionMarkers();
            }}
            onReady={(instance) => {
              console.log("Panorama viewer ready");
              viewerRef.current = instance;

              // Position markers initially
              setTimeout(() => {
                positionMarkers();
              }, 500);
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-500">
            Select a grid location to view its panorama
          </div>
        )}

        {/* Markers overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* This div is just a container - markers will be positioned absolutely */}
          {markerElements.map((marker) => marker)}
        </div>

        {/* Controls */}
        <div className="absolute top-2 right-2 z-50 flex space-x-2">
          {currentPanorama && (
            <button
              className="bg-blue-500 text-white px-3 py-1 rounded pointer-events-auto"
              onClick={toggleMarkerMode}
            >
              {isMarkerMode ? "Exit Marker Mode" : "Add Markers"}
            </button>
          )}

          <button
            className="bg-gray-500 text-white px-3 py-1 rounded pointer-events-auto"
            onClick={() => setShowDebugOverlay((prev) => !prev)}
          >
            {showDebugOverlay ? "Hide Debug" : "Show Debug"}
          </button>
        </div>

        {/* Marker Dialog */}
        {showMarkerDialog && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black border border-gray-300 p-4 z-50 rounded shadow-lg pointer-events-auto">
            <h3 className="text-white font-bold mb-2">Add Marker</h3>
            <textarea
              className="w-64 h-24 border bg-gray-800 text-white p-2 mb-2 rounded"
              value={markerNote}
              onChange={(e) => setMarkerNote(e.target.value)}
              placeholder="Enter marker note..."
            />
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 bg-gray-600 text-white rounded"
                onClick={() => {
                  setShowMarkerDialog(false);
                  setMarkerNote("");
                  setPendingMarkerPosition(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded"
                onClick={saveMarker}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Marker Mode Indicator */}
        {isMarkerMode && (
          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded z-40">
            Marker Mode: Click anywhere to add a marker
          </div>
        )}

        {/* Debug overlay */}
        {currentPanorama && showDebugOverlay && (
          <div className="absolute bottom-4 left-4 bg-black p-4 rounded shadow z-50 max-w-md text-white pointer-events-auto">
            <h3 className="font-bold">Debug Information</h3>
            <div className="mt-2 text-xs space-y-1">
              <p>
                <strong>Panorama ID:</strong> {currentPanorama.id}
              </p>
              <p>
                <strong>Markers:</strong> {markers?.length || 0}
              </p>
              <p>
                <strong>Marker Mode:</strong> {isMarkerMode ? "Yes" : "No"}
              </p>
              <p>
                <strong>Show Dialog:</strong> {showMarkerDialog ? "Yes" : "No"}
              </p>
            </div>

            {markers && markers.length > 0 && (
              <div className="mt-2">
                <p className="font-bold text-sm">Marker Data:</p>
                <div className="mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32 text-xs">
                  <pre className="text-white">
                    {JSON.stringify(markers.slice(0, 3), null, 2)}
                    {markers.length > 3 && "... (more markers)"}
                  </pre>
                </div>
              </div>
            )}

            <div className="mt-2">
              <p className="font-bold text-sm">Raw Annotations:</p>
              <div className="mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32 text-xs">
                <pre className="text-white">
                  {JSON.stringify(currentPanorama.annotations, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-2 flex space-x-2">
              <button
                onClick={() => {
                  // Force marker update
                  positionMarkers();
                }}
                className="bg-blue-200 px-2 py-1 rounded text-xs text-black"
              >
                Refresh Markers
              </button>
            </div>
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

              // Count markers
              let markerCount = 0;
              if (assignedPano?.annotations) {
                if (Array.isArray(assignedPano.annotations)) {
                  markerCount = assignedPano.annotations.length;
                } else if (
                  assignedPano.annotations.markers &&
                  Array.isArray(assignedPano.annotations.markers)
                ) {
                  markerCount = assignedPano.annotations.markers.length;
                }
              }

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
                      {markerCount > 0 && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {markerCount}
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
