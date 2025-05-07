"use client";

import React, { useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { X, Save, Plus, Minus, Eye } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useGrids } from "../../../../hooks/useGrids";

interface EnhancedImageGridProps {
  projectId: string;
  isSharedView?: boolean;
}

export default function EnhancedImageGrid({
  projectId,
  isSharedView = false,
}: EnhancedImageGridProps) {
  const supabase = createClient();

  // Destructure all necessary values and functions from the hook
  const {
    rows,
    cols,
    loading,
    hasChanges,
    unassignedPanoramas,
    openDropdownCell,
    fetchData,
    getPosKey,
    getNodeAtPosition,
    getPanoramaForNode,
    handleChangeRows,
    handleChangeCols,
    handleAssignPanorama,
    handleUnassignPanorama,
    handleSaveGrid,
    increaseRows,
    decreaseRows,
    increaseCols,
    decreaseCols,
    setOpenDropdownCell,
  } = useGrids(projectId);

  // Use this approach to prevent the infinite render loop
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      // Only proceed if component is still mounted
      if (mounted) {
        await fetchData();
      }
    };

    loadData();

    // Cleanup function
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Only depend on projectId

  return (
    <TabsContent value="place-locations" className="p-4 space-y-6">
      <Card className="bg-background/80 backdrop-blur-sm border border-border/50">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold cyber-glow">
                {isSharedView ? "Floor Plan View" : "360° Panorama Grid"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isSharedView
                  ? "Navigate between locations on the floor plan"
                  : "Arrange your panoramas on a grid to create a virtual tour"}
              </p>
            </div>

            {/* Only show editing controls if not in shared view */}
            {!isSharedView && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center space-x-2">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium mb-1">
                      Rows: {rows}
                    </span>
                    <div className="flex items-center">
                      <Button
                        onClick={decreaseRows}
                        variant="outline"
                        size="sm"
                        disabled={rows <= 1}
                        className="px-2 py-0 h-8 w-8 rounded-r-none"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <input
                        type="number"
                        min={1}
                        value={rows}
                        onChange={handleChangeRows}
                        className="w-12 h-8 border border-border/100 px-2 text-center"
                      />
                      <Button
                        onClick={increaseRows}
                        variant="outline"
                        size="sm"
                        className="px-2 py-0 h-8 w-8 rounded-l-none"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium mb-1">
                      Columns: {cols}
                    </span>
                    <div className="flex items-center">
                      <Button
                        onClick={decreaseCols}
                        variant="outline"
                        size="sm"
                        disabled={cols <= 1}
                        className="px-2 py-0 h-8 w-8 rounded-r-none"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <input
                        type="number"
                        min={1}
                        value={cols}
                        onChange={handleChangeCols}
                        className="w-12 h-8 border border-border/100 px-2 text-center"
                      />
                      <Button
                        onClick={increaseCols}
                        variant="outline"
                        size="sm"
                        className="px-2 py-0 h-8 w-8 rounded-l-none"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleSaveGrid}
                    disabled={loading || !hasChanges}
                    className="bg-cyber-gradient hover:opacity-90 transition-colors h-8 self-end"
                  >
                    {loading ? "Saving..." : "Save Grid"}
                    <Save className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Display view-only indicator in shared view */}
            {isSharedView && (
              <div className="flex items-center">
                <div className="flex items-center bg-background/40 px-3 py-1 rounded border border-border/20">
                  <Eye className="h-4 w-4 mr-2 text-primary" />
                  <span className="text-sm">View-only mode</span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Loading grid...</p>
            </div>
          ) : (
            <div className="bg-background/30 border border-border/50 rounded-lg p-6">
              <div className="flex justify-center">
                <div
                  className="grid gap-6 place-items-center"
                  style={{
                    gridTemplateRows: `repeat(${rows}, minmax(150px, 1fr))`,
                    gridTemplateColumns: `repeat(${cols}, minmax(150px, 1fr))`,
                  }}
                >
                  {/* Generate grid cells */}
                  {Array.from({ length: rows }).map(
                    (_, y) =>
                      Array.from({ length: cols })
                        .map((_, x) => {
                          const posKey = getPosKey(x, y);
                          const node = getNodeAtPosition(x, y);
                          const panorama = getPanoramaForNode(node);

                          // In shared view, only show assigned panoramas
                          if (isSharedView && !panorama) {
                            return null; // Skip rendering empty cells in shared view
                          }

                          return (
                            <div key={posKey} className="relative">
                              <div
                                className={`w-32 h-32 rounded-full relative flex items-center justify-center border-2 transition-all ${
                                  panorama
                                    ? "border-primary shadow-md cursor-pointer"
                                    : "border-dashed border-muted-foreground/50 hover:border-muted-foreground hover:bg-background/40 " +
                                      (isSharedView
                                        ? "hidden"
                                        : "cursor-pointer")
                                }`}
                                onClick={() => {
                                  // In shared view, cells aren't clickable for editing
                                  if (!isSharedView) {
                                    setOpenDropdownCell((prev) =>
                                      prev === posKey ? null : posKey
                                    );
                                  }
                                }}
                              >
                                {panorama ? (
                                  <>
                                    <img
                                      src={panorama.thumbnail_url ?? panorama.url ?? ""}
                                      alt={panorama.name}
                                      className="w-full h-full object-cover rounded-full"
                                    />

                                    {/* Only show unassign button in editable mode */}
                                    {!isSharedView && (
                                      <button
                                        className="absolute top-0 right-0 m-1 bg-cyber-gradient text-white rounded-full p-1 hover:bg-red-700 focus:outline-none"
                                        style={{
                                          width: "1.25rem",
                                          height: "1.25rem",
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnassignPanorama(x, y);
                                        }}
                                        aria-label="Unassign panorama"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-400">
                                    Empty
                                  </span>
                                )}
                              </div>

                              {/* Dropdown for panorama selection - only in editable mode */}
                              {!isSharedView && openDropdownCell === posKey && (
                                <div
                                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 
                                        w-64 max-h-96 p-4 bg-white border 
                                        shadow-md z-50 rounded-lg text-base overflow-auto"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <p className="font-semibold mb-2 text-sm">
                                    Assign a panorama to position ({x},{y}):
                                  </p>

                                  {unassignedPanoramas.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-2">
                                      No unassigned panoramas available
                                    </p>
                                  ) : (
                                    <ul className="space-y-2 mt-2">
                                      {unassignedPanoramas.map((pano) => (
                                        <li
                                          key={pano.id}
                                          className="p-2 hover:bg-gray-100 cursor-pointer flex items-center rounded"
                                          onClick={() =>
                                            handleAssignPanorama(x, y, pano.id)
                                          }
                                        >
                                          <div className="w-12 h-12 mr-2 rounded overflow-hidden flex-shrink-0">
                                            <img
                                              src={pano.thumbnail_url ?? pano.url ?? ""}
                                              alt={pano.name}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                          <span className="truncate text-sm">
                                            {pano.name}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                        .filter(Boolean) // Filter out null items
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
