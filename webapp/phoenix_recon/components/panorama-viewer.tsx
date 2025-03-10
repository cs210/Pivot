"use client";

/*
  Below is the full edited code for panorama-viewer.tsx with minimal changes to fix the TypeScript errors.
  Each fix is annotated with comments explaining what was changed and why.

  Note: Some vendor-prefixed fullscreen APIs (e.g., webkitRequestFullscreen) do not exist on standard Document/HTMLElement types,
  so I've added `// @ts-ignore` comments to suppress errors. A more robust solution would be to define custom type declarations,
  but here we aim for minimal changes.
*/

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { Slider } from "@/components/ui/slider";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Maximize,
  Minimize,
  Play,
  Pause,
  Upload,
} from "lucide-react";
import { type ExtractedFrame } from "@/utils/frame-extractor";

// Dynamically import ReactPhotoSphereViewer to avoid SSR issues
const ReactPhotoSphereViewer = dynamic(
  () =>
    import("react-photo-sphere-viewer").then(
      (mod) => mod.ReactPhotoSphereViewer
    ),
  { ssr: false }
);

// Helper function to format timestamp (MM:SS)
// ADDED explicit type for "timestamp" parameter
function formatTimestamp(timestamp: number): string {
  const minutes = Math.floor(timestamp / 60000);
  const seconds = Math.floor((timestamp % 60000) / 1000);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

interface EnhancedPanoramaViewerProps {
  frames?: ExtractedFrame[];
  initialFrameIndex?: number;
  autoRotate?: boolean;
  autoPlayInterval?: number;
}

export default function EnhancedPanoramaViewer({
  frames = [],
  initialFrameIndex = 0,
  autoRotate = false,
  autoPlayInterval = 2000, // milliseconds between auto frame changes
}: EnhancedPanoramaViewerProps) {
  // ADDED explicit state type for uploadedFrames to avoid "never[]" errors
  const [uploadedFrames, setUploadedFrames] = useState<ExtractedFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(initialFrameIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const viewerRef = useRef<any>(null); // ADDED "any" to suppress type errors from external lib
  const containerRef = useRef<HTMLDivElement | null>(null);
  const psvInstanceRef = useRef<any>(null); // ADDED "any" to suppress type errors from external lib
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // Combine uploaded frames with provided frames
  // ADDED explicit param types for "frame" and "index" to avoid "implicitly has any" errors
  const allFrames = useMemo(() => {
    return [...frames, ...uploadedFrames].map(
      (frame: ExtractedFrame, index: number) => ({
        ...frame,
        index,
      })
    );
  }, [frames, uploadedFrames]);

  // Handle when viewer is ready
  // ADDED explicit "instance: any" to avoid "implicitly has any" error
  const handleReady = (instance: any) => {
    psvInstanceRef.current = instance;

    // Start autorotate if enabled
    if (autoRotate) {
      instance.startAutorotate();
    }
  };

  // Handle file drop
  // ADDED type for "e: DragEvent<HTMLDivElement>"
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  // Handle file selection from input
  // ADDED type for "e: ChangeEvent<HTMLInputElement>"
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(e.target.files);
    }
  };

  // Process uploaded files
  // ADDED type for "files: FileList" and for "newFrames"
  const handleFiles = async (files: FileList) => {
    setIsLoading(true);
    const newFrames: ExtractedFrame[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]; // File is well-typed here

      // Check if file is an image
      if (!file.type.match("image.*")) continue;

      try {
        // Read file as data URL
        const dataUrl = await readFileAsDataURL(file);

        newFrames.push({
          dataUrl,
          timestamp: Date.now() + i * 1000, // Simulate timestamps
          fileName: file.name,
          size: file.size,
          type: file.type,
        });
      } catch (error) {
        console.error("Error processing file:", error);
      }
    }

    setUploadedFrames((prev) => [...prev, ...newFrames]);

    // Switch to the first new frame
    if (newFrames.length > 0) {
      setCurrentFrameIndex(allFrames.length);
    }

    setIsLoading(false);
  };

  // Helper function to read file as data URL
  // ADDED explicit types for "file: File" and return Promise<string>
  // ADDED type for "event: ProgressEvent<FileReader>" and "error: ProgressEvent<FileReader>"
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: ProgressEvent<FileReader>) => {
        if (event.target) {
          resolve((event.target.result as string) ?? "");
        } else {
          reject(new Error("File reading failed"));
        }
      };

      reader.onerror = (error: ProgressEvent<FileReader>) => {
        reject(error);
      };

      reader.readAsDataURL(file);
    });
  };

  // Auto-play functionality
  useEffect(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }

    if (isPlaying && allFrames.length > 1) {
      autoPlayRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % allFrames.length);
      }, autoPlayInterval);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isPlaying, allFrames.length, autoPlayInterval]);

  // Control functions
  const goToNextFrame = () => {
    if (allFrames.length <= 1) return;
    setCurrentFrameIndex((prev) => (prev + 1) % allFrames.length);
  };

  const goToPreviousFrame = () => {
    if (allFrames.length <= 1) return;
    setCurrentFrameIndex((prev) =>
      prev === 0 ? allFrames.length - 1 : prev - 1
    );
  };

  const resetView = () => {
    if (psvInstanceRef.current) {
      psvInstanceRef.current.animate({
        longitude: 0,
        latitude: 0,
        zoom: 50,
        speed: "10rpm",
      });
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      const element = containerRef.current;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else {
        // @ts-ignore - vendor-prefixed methods
        if (element.webkitRequestFullscreen) {
          // @ts-ignore
          element.webkitRequestFullscreen();
        } else {
          // @ts-ignore
          if (element.msRequestFullscreen) {
            // @ts-ignore
            element.msRequestFullscreen();
          }
        }
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else {
        // @ts-ignore - vendor-prefixed methods
        if (document.webkitExitFullscreen) {
          // @ts-ignore
          document.webkitExitFullscreen();
        } else {
          // @ts-ignore
          if (document.msExitFullscreen) {
            // @ts-ignore
            document.msExitFullscreen();
          }
        }
      }
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleAutorotate = () => {
    if (!psvInstanceRef.current) return;

    if (psvInstanceRef.current.isAutorotateEnabled()) {
      psvInstanceRef.current.stopAutorotate();
    } else {
      psvInstanceRef.current.startAutorotate();
    }
  };

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement ||
          // @ts-ignore - vendor-prefixed property
          !!document.webkitFullscreenElement ||
          // @ts-ignore
          !!document.msFullscreenElement
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    // @ts-ignore
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    // @ts-ignore
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      // @ts-ignore
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      // @ts-ignore
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Handle drag events
  // ADDED type for "e: DragEvent<HTMLDivElement>"
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  // ADDED type for "e: DragEvent<HTMLDivElement>"
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // No frames placeholder
  if (allFrames.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
        } transition-colors duration-200`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-3" />
        <p className="text-gray-500 dark:text-gray-400 mb-2">
          No panoramic frames available
        </p>
        <label className="cursor-pointer text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
          Upload 360° images
          <input
            type="file"
            accept="image/*"
            className="hidden"
            multiple
            onChange={handleFileSelect}
          />
        </label>
      </div>
    );
  }

  // Main viewer component
  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-lg overflow-hidden shadow-xl ${
        dragActive ? "ring-2 ring-blue-500" : ""
      }`}
      style={{
        height: isFullscreen ? "100vh" : "70vh",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
        </div>
      )}

      {/* Drag overlay */}
      {dragActive && (
        <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl text-center">
            <Upload className="h-10 w-10 mx-auto mb-3 text-blue-500" />
            <p className="text-lg font-medium">Drop to add 360° images</p>
          </div>
        </div>
      )}

      {/* Photo Sphere Viewer */}
      <div className="absolute inset-0 z-0">
        {allFrames[currentFrameIndex]?.dataUrl && (
          <ReactPhotoSphereViewer
            ref={viewerRef}
            src={allFrames[currentFrameIndex].dataUrl}
            height="100%"
            width="100%"
            littlePlanet={false}
            fisheye={false}
            defaultZoomLvl={50}
            minFov={30}
            maxFov={90}
            moveSpeed={1}
            zoomSpeed={1}
            navbar={false}
            onReady={handleReady}
          />
        )}
      </div>

      {/* Top controls */}
      <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
        <div className="flex justify-between items-center text-white">
          <div className="text-sm font-medium">
            {allFrames[currentFrameIndex]?.timestamp
              ? formatTimestamp(allFrames[currentFrameIndex].timestamp)
              : allFrames[currentFrameIndex]?.fileName || ""}
          </div>

          <div className="flex items-center gap-2">
            <label className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors cursor-pointer">
              <Upload className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
            </label>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent z-10">
        {/* Frame timeline */}
        {allFrames.length > 1 && (
          <div className="px-6 pt-12 pb-2">
            <Slider
              // ADDED explicit type for "value"
              onValueChange={(value: number[]) =>
                setCurrentFrameIndex(value[0])
              }
              value={[currentFrameIndex]}
              min={0}
              max={allFrames.length - 1}
              step={1}
              className="[&>span:first-child]:h-1 [&>span:first-child]:bg-gray-600 [&_[role=slider]]:bg-white [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-blue-500"
            />
          </div>
        )}

        {/* Controls bar */}
        <div className="flex items-center justify-between text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousFrame}
              disabled={allFrames.length <= 1}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous frame"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {allFrames.length > 1 && (
              <button
                onClick={togglePlay}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>
            )}

            <button
              onClick={goToNextFrame}
              disabled={allFrames.length <= 1}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next frame"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="text-sm font-medium">
            {allFrames.length > 1
              ? `${currentFrameIndex + 1} / ${allFrames.length}`
              : ""}
          </div>

          <button
            onClick={resetView}
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
            aria-label="Reset view"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Thumbnails */}
        {allFrames.length > 1 && (
          <div className="flex overflow-x-auto p-3 gap-2 bg-black/80 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-black/20">
            {allFrames.map(
              // ADDED explicit types for "frame" and "index"
              (frame: ExtractedFrame & { index: number }, index: number) => (
                <button
                  key={index}
                  onClick={() => setCurrentFrameIndex(index)}
                  className={`flex-shrink-0 cursor-pointer w-16 h-12 overflow-hidden rounded ${
                    currentFrameIndex === index
                      ? "ring-2 ring-blue-500"
                      : "opacity-70 hover:opacity-100"
                  } transition-all duration-200`}
                  aria-label={`Frame ${index + 1}`}
                >
                  <img
                    src={frame.dataUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
