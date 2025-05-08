import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import { Panorama } from "./usePanoramas";
import {
  getCachedGrid,
  getCachedGridNodes,
  getCachedPanoramas,
  cacheGrid,
  cacheGridNodes,
  updateGridInCache,
  updateGridNodeInCache,
  removeGridNodeFromCache,
} from "./cache-service";

export interface Grid {
  id: string;
  project_id: string;
  name: string;
  rows: number;
  cols: number;
  is_default: boolean;
  is_public: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface GridNode {
  id: string;
  grid_id: string;
  project_id: string;
  panorama_id: string | null;
  grid_x: number;
  grid_y: number;
  name: string | null;
  description: string | null;
  rotation_degrees: number;
  scale_factor: number;
  created_at: string;
  updated_at: string;
}

// Interface to track pending changes to grid nodes
interface PendingChange {
  type: "assign" | "unassign";
  x: number;
  y: number;
  panoramaId?: string;
  existingNode: GridNode | null;
}

export function useGrids(projectId: string) {
  const supabase = createClient();

  // Current grid
  const [currentGrid, setCurrentGrid] = useState<Grid | null>(null);

  // Grid dimensions (from currentGrid)
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);

  // All panoramas for this project
  const [allPanoramas, setAllPanoramas] = useState<Panorama[]>([]);

  // Grid nodes stored by position
  const [gridNodes, setGridNodes] = useState<Record<string, GridNode>>({});

  // Panoramas not assigned to any grid node
  const [unassignedPanoramas, setUnassignedPanoramas] = useState<Panorama[]>(
    []
  );

  // Track which cell's dropdown is currently open
  const [openDropdownCell, setOpenDropdownCell] = useState<string | null>(null);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Changes made but not saved
  const [hasChanges, setHasChanges] = useState(false);

  // Pending changes to be committed on save
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  // Get position key for lookup
  const getPosKey = (x: number, y: number) => `${x},${y}`;

  // Get grid node at position, or null if none exists
  const getNodeAtPosition = (x: number, y: number) => {
    const posKey = getPosKey(x, y);
    return gridNodes[posKey] || null;
  };

  // Get panorama for a grid node
  const getPanoramaForNode = (node: GridNode | null) => {
    if (!node || !node.panorama_id) return null;
    return allPanoramas.find((p) => p.id === node.panorama_id) || null;
  };

  // Handle grid dimension changes
  const handleChangeRows = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    const newRows = Number.isNaN(value) ? 1 : Math.max(1, value);
    setRows(newRows);
    setHasChanges(true);
  };

  const handleChangeCols = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    const newCols = Number.isNaN(value) ? 1 : Math.max(1, value);
    setCols(newCols);
    setHasChanges(true);
  };

  const fetchData = async (forceRefresh = false) => {
    console.log("Starting fetchData for project:", projectId);

    try {
      // Check if we have cached grid data
      const cachedGrid = getCachedGrid(projectId);
      const cachedGridNodes = getCachedGridNodes(projectId);
      const cachedPanoramas = getCachedPanoramas(projectId);

      if (cachedGrid && cachedGridNodes && cachedPanoramas && !forceRefresh) {
        console.log("Using cached grid data");
        setCurrentGrid(cachedGrid);
        setRows(cachedGrid.rows);
        setCols(cachedGrid.cols);
        setGridNodes(cachedGridNodes);

        // Set the panoramas
        setAllPanoramas(cachedPanoramas);

        // Calculate unassigned panoramas
        const usedPanoramaIds = new Set<string>();
        Object.values(cachedGridNodes).forEach((node) => {
          if (node.panorama_id) {
            usedPanoramaIds.add(node.panorama_id);
          }
        });

        const unassigned = cachedPanoramas.filter(
          (pano) => !usedPanoramaIds.has(pano.id)
        );
        setUnassignedPanoramas(unassigned);

        setLoading(false);
        return;
      }

      // If no cache or force refresh, fetch from database

      // 1. Fetch the default grid for this project
      const { data: gridData, error: gridError } = await supabase
        .from("grids")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_default", true)
        .single();

      console.log("Grid query result:", { data: gridData, error: gridError });

      if (gridError && gridError.code !== "PGRST116") {
        // PGRST116 is "no rows returned"
        throw gridError;
      }

      let grid: Grid;

      if (!gridData) {
        // throw error
        throw new Error("No default grid found for this project");
      }

      grid = gridData;

      // Cache the grid
      cacheGrid(projectId, grid);

      // Set grid data
      setCurrentGrid(grid);
      setRows(grid.rows);
      setCols(grid.cols);

      // 2. Fetch all panoramas for this project
      let panoramasWithUrls: Panorama[] = [];

      // Check if we have cached panoramas even if the grid wasn't cached
      if (cachedPanoramas && !forceRefresh) {
        panoramasWithUrls = cachedPanoramas;
      } else {
        const { data: panoramasData, error: panoramasError } = await supabase
          .from("panoramas")
          .select("*")
          .eq("project_id", projectId);

        if (panoramasError) {
          throw panoramasError;
        }

        // Add signed URLs to panoramas
        panoramasWithUrls = await Promise.all(
          (panoramasData || []).map(async (pano) => {
            let url;
            if (pano.is_public) {
              // For public panoramas, use the public URL
              url = supabase.storage
                .from("panoramas-public")
                .getPublicUrl(pano.storage_path).data.publicUrl;
            } else {
              // For private panoramas, generate a signed URL
              const { data: urlData } = await supabase.storage
                .from("panoramas-private")
                .createSignedUrl(pano.storage_path, 3600); // 1 hour expiration
              url = urlData?.signedUrl || null;
            }
            return { ...pano, url };
          })
        );
      }

      setAllPanoramas(panoramasWithUrls);

      // 3. Fetch all grid nodes for this grid
      console.log("Fetching nodes for grid:", grid.id);
      const { data: nodesData, error: nodesError } = await supabase
        .from("grid_nodes")
        .select("*")
        .eq("grid_id", grid.id);

      console.log("Nodes result:", nodesData);

      if (nodesError) {
        throw nodesError;
      }

      // Create a map of position -> grid node
      const nodesMap: Record<string, GridNode> = {};
      const usedPanoramaIds = new Set<string>();

      if (nodesData && nodesData.length > 0) {
        nodesData.forEach((node) => {
          // Create a position key (x,y)
          const posKey = `${node.grid_x},${node.grid_y}`;
          nodesMap[posKey] = node;

          // Track used panorama IDs
          if (node.panorama_id) {
            usedPanoramaIds.add(node.panorama_id);
          }
        });
      }

      // Cache the grid nodes
      cacheGridNodes(projectId, nodesMap);

      setGridNodes(nodesMap);

      // Determine unassigned panoramas (not used in any grid node)
      const unassigned = panoramasWithUrls.filter(
        (pano) => !usedPanoramaIds.has(pano.id)
      );
      setUnassignedPanoramas(unassigned);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Error loading grid data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [projectId]);

  // Assign a panorama to a grid position (staged until save)
  const handleAssignPanorama = async (
    x: number,
    y: number,
    panoramaId: string
  ) => {
    if (!currentGrid) return;

    const posKey = getPosKey(x, y);
    const existingNode = gridNodes[posKey];

    try {
      // Create a temporary node if none exists
      let tempNode: GridNode;
      if (existingNode) {
        // Update existing node temporarily
        tempNode = {
          ...existingNode,
          panorama_id: panoramaId,
          updated_at: new Date().toISOString(),
        };
      } else {
        // Create a temporary new node
        tempNode = {
          id: `temp-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`,
          grid_id: currentGrid.id,
          project_id: projectId,
          grid_x: x,
          grid_y: y,
          panorama_id: panoramaId,
          rotation_degrees: 0,
          scale_factor: 1,
          name: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      // Update local state
      setGridNodes((prev) => ({
        ...prev,
        [posKey]: tempNode,
      }));

      // Add to pending changes
      setPendingChanges((prev) => [
        ...prev.filter((change) => !(change.x === x && change.y === y)), // Remove any previous change for this cell
        {
          type: "assign",
          x,
          y,
          panoramaId,
          existingNode,
        },
      ]);

      // Update unassigned panoramas list (visual only until saved)
      const oldPanoramaId = existingNode?.panorama_id;

      setUnassignedPanoramas((prev) => {
        // Remove newly assigned panorama from unassigned list
        const filtered = prev.filter((p) => p.id !== panoramaId);

        // If there was a panorama already assigned, add it back to unassigned
        if (oldPanoramaId) {
          const oldPanorama = allPanoramas.find((p) => p.id === oldPanoramaId);
          if (oldPanorama) {
            return [...filtered, oldPanorama];
          }
        }

        return filtered;
      });

      // Mark that changes have been made that need to be saved
      setHasChanges(true);

      setOpenDropdownCell(null);
    } catch (error) {
      console.error("Error staging panorama assignment:", error);
      alert("Failed to assign panorama to grid position");
    }
  };

  // Remove a panorama from a grid position (staged until save)
  const handleUnassignPanorama = async (x: number, y: number) => {
    const posKey = getPosKey(x, y);
    const existingNode = gridNodes[posKey];

    if (!existingNode || !existingNode.panorama_id) return;

    try {
      // Find the panorama that was unassigned
      const unassignedPanorama = allPanoramas.find(
        (p) => p.id === existingNode.panorama_id
      );

      // Update local state with temporary change
      const updatedNode = {
        ...existingNode,
        panorama_id: null,
        updated_at: new Date().toISOString(),
      };

      setGridNodes((prev) => ({
        ...prev,
        [posKey]: updatedNode,
      }));

      // Add to pending changes
      setPendingChanges((prev) => [
        ...prev.filter((change) => !(change.x === x && change.y === y)), // Remove any previous change for this cell
        {
          type: "unassign",
          x,
          y,
          existingNode,
        },
      ]);

      // Add the panorama back to unassigned list (visual only until saved)
      if (unassignedPanorama) {
        setUnassignedPanoramas((prev) => [...prev, unassignedPanorama]);
      }

      // Mark that changes have been made that need to be saved
      setHasChanges(true);
    } catch (error) {
      console.error("Error staging panorama unassignment:", error);
      alert("Failed to remove panorama from grid position");
    }
  };

  // Save grid changes
  const handleSaveGrid = async () => {
    if (!currentGrid) return;

    setLoading(true);

    try {
      // 1. Update the grid dimensions and visibility
      const { error: updateError } = await supabase
        .from("grids")
        .update({
          rows: rows,
          cols: cols,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentGrid.id);

      if (updateError) throw updateError;

      // Update the current grid in state
      const updatedGrid = {
        ...currentGrid,
        rows,
        cols,
        updated_at: new Date().toISOString(),
      };

      setCurrentGrid(updatedGrid);

      // Update the cache
      updateGridInCache(projectId, currentGrid.id, {
        rows,
        cols,
        updated_at: new Date().toISOString(),
      });

      // 2. Process all pending changes
      for (const change of pendingChanges) {
        const { type, x, y, panoramaId, existingNode } = change;
        const posKey = getPosKey(x, y);

        if (type === "assign" && panoramaId) {
          if (existingNode) {
            // Update existing node
            const { error } = await supabase
              .from("grid_nodes")
              .update({ panorama_id: panoramaId })
              .eq("id", existingNode.id);

            if (error) throw error;

            // Update cache
            updateGridNodeInCache(projectId, posKey, {
              ...existingNode,
              panorama_id: panoramaId,
            });
          } else {
            // Create new node
            const { data, error } = await supabase
              .from("grid_nodes")
              .insert({
                grid_id: currentGrid.id,
                project_id: projectId,
                grid_x: x,
                grid_y: y,
                panorama_id: panoramaId,
                rotation_degrees: 0,
                scale_factor: 1,
              })
              .select()
              .single();

            if (error) throw error;

            // Update local state with the real node (instead of temp)
            setGridNodes((prev) => ({
              ...prev,
              [posKey]: data,
            }));

            // Update cache
            updateGridNodeInCache(projectId, posKey, data);
          }
        } else if (type === "unassign" && existingNode) {
          // Update the grid node to remove panorama reference
          const { error } = await supabase
            .from("grid_nodes")
            .update({ panorama_id: null })
            .eq("id", existingNode.id);

          if (error) throw error;

          // Update cache
          updateGridNodeInCache(projectId, posKey, {
            ...existingNode,
            panorama_id: null,
          });
        }
      }

      // 3. Get all existing nodes for this grid
      const { data: existingNodes, error: fetchError } = await supabase
        .from("grid_nodes")
        .select("*")
        .eq("grid_id", currentGrid.id);

      if (fetchError) throw fetchError;

      // 4. Delete nodes that are outside the new grid dimensions
      const nodesToDelete = (existingNodes || []).filter(
        (node) => node.grid_x >= cols || node.grid_y >= rows
      );

      if (nodesToDelete.length > 0) {
        const nodeIds = nodesToDelete.map((node) => node.id);

        const { error: deleteError } = await supabase
          .from("grid_nodes")
          .delete()
          .in("id", nodeIds);

        if (deleteError) throw deleteError;

        // Add any panoramas from deleted nodes back to unassigned
        const panoramasToUnassign = nodesToDelete
          .filter((node) => node.panorama_id)
          .map((node) => allPanoramas.find((p) => p.id === node.panorama_id))
          .filter(Boolean) as Panorama[];

        if (panoramasToUnassign.length > 0) {
          setUnassignedPanoramas((prev) => [...prev, ...panoramasToUnassign]);
        }

        // Remove deleted nodes from local state
        const updatedGridNodes = { ...gridNodes };
        nodesToDelete.forEach((node) => {
          const key = getPosKey(node.grid_x, node.grid_y);
          delete updatedGridNodes[key];

          // Remove from cache as well
          removeGridNodeFromCache(projectId, key);
        });

        setGridNodes(updatedGridNodes);
      }

      // Clear pending changes after successful save
      setPendingChanges([]);
      setHasChanges(false);
      // USED TO BE ALERT()
      console.log("Grid saved successfully!");
    } catch (error) {
      console.error("Error saving grid:", error);
      alert("Failed to save grid changes");
    } finally {
      setLoading(false);
    }
  };

  // Increase/decrease grid dimensions with buttons
  const increaseRows = () => {
    setRows((prev) => prev + 1);
    setHasChanges(true);
  };

  const decreaseRows = () => {
    if (rows > 1) {
      setRows((prev) => prev - 1);
      setHasChanges(true);
    }
  };

  const increaseCols = () => {
    setCols((prev) => prev + 1);
    setHasChanges(true);
  };

  const decreaseCols = () => {
    if (cols > 1) {
      setCols((prev) => prev - 1);
      setHasChanges(true);
    }
  };

  return {
    // State values
    currentGrid,
    rows,
    cols,
    gridNodes,
    allPanoramas,
    unassignedPanoramas,
    openDropdownCell,
    loading,
    hasChanges,
    pendingChanges,

    // Functions
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
  };
}
