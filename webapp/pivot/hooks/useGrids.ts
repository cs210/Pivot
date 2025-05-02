import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import { Panorama } from "./usePanoramas";

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

export function useGrids(projectId: string) {
  const supabase = createClient();
  
  // Current grid
  const [currentGrid, setCurrentGrid] = useState<Grid | null>(null);
  
  // Grid dimensions (from currentGrid)
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);
  
  // Public visibility
  const [isPublic, setIsPublic] = useState<boolean>(false);
  
  // All panoramas for this project
  const [allPanoramas, setAllPanoramas] = useState<Panorama[]>([]);
  
  // Grid nodes stored by position
  const [gridNodes, setGridNodes] = useState<Record<string, GridNode>>({});
  
  // Panoramas not assigned to any grid node
  const [unassignedPanoramas, setUnassignedPanoramas] = useState<Panorama[]>([]);
  
  // Track which cell's dropdown is currently open
  const [openDropdownCell, setOpenDropdownCell] = useState<string | null>(null);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  
  // Changes made but not saved
  const [hasChanges, setHasChanges] = useState(false);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch the default grid for this project
      const { data: gridData, error: gridError } = await supabase
        .from("grids")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_default", true)
        .single();

      console.log("Grid query result:", { data: gridData, error: gridError });

      if (gridError && gridError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw gridError;
      }

      let grid: Grid;
      
      if (!gridData) {
        // throw error
        throw new Error("No default grid found for this project");
      }

      grid = gridData;
      
      // Set grid data
      setCurrentGrid(grid);
      setRows(grid.rows);
      setCols(grid.cols);
      setIsPublic(grid.is_public);

      // 2. Fetch all panoramas for this project
      const { data: panoramasData, error: panoramasError } = await supabase
        .from("panoramas")
        .select("*")
        .eq("project_id", projectId);

      if (panoramasError) {
        throw panoramasError;
      }

      // Add signed URLs to panoramas
      const panoramasWithUrls = await Promise.all(
        (panoramasData || []).map(async (pano) => {
          let url;
          if (pano.is_public) {
            // For public panoramas, use the public URL
            url = supabase.storage
              .from("panoramas")
              .getPublicUrl(pano.storage_path).data.publicUrl;
          } else {
            // For private panoramas, generate a signed URL
            const { data: urlData } = await supabase.storage
              .from("panoramas")
              .createSignedUrl(pano.storage_path, 3600); // 1 hour expiration
            url = urlData?.signedUrl || null;
          }
          return { ...pano, url };
        })
      );
      
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

  // Assign a panorama to a grid position
  const handleAssignPanorama = async (x: number, y: number, panoramaId: string) => {
    if (!currentGrid) return;
    
    const posKey = getPosKey(x, y);
    const existingNode = gridNodes[posKey];
    
    try {
      if (existingNode) {
        // Update existing node
        const { error } = await supabase
          .from("grid_nodes")
          .update({ panorama_id: panoramaId })
          .eq("id", existingNode.id);
          
        if (error) throw error;
        
        // Update local state
        setGridNodes(prev => ({
          ...prev,
          [posKey]: { ...existingNode, panorama_id: panoramaId }
        }));
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
          })
          .select()
          .single();
          
        if (error) throw error;
        
        // Update local state
        setGridNodes(prev => ({
          ...prev,
          [posKey]: data
        }));
      }
      
      // Update unassigned panoramas list
      const oldPanoramaId = existingNode?.panorama_id;
      
      setUnassignedPanoramas(prev => {
        // Remove newly assigned panorama from unassigned list
        const filtered = prev.filter(p => p.id !== panoramaId);
        
        // If there was a panorama already assigned, add it back to unassigned
        if (oldPanoramaId) {
          const oldPanorama = allPanoramas.find(p => p.id === oldPanoramaId);
          if (oldPanorama) {
            return [...filtered, oldPanorama];
          }
        }
        
        return filtered;
      });
      
      setOpenDropdownCell(null);
    } catch (error) {
      console.error("Error assigning panorama:", error);
      alert("Failed to assign panorama to grid position");
    }
  };

  // Remove a panorama from a grid position
  const handleUnassignPanorama = async (x: number, y: number) => {
    const posKey = getPosKey(x, y);
    const existingNode = gridNodes[posKey];
    
    if (!existingNode || !existingNode.panorama_id) return;
    
    try {
      // Update the grid node to remove panorama reference
      const { error } = await supabase
        .from("grid_nodes")
        .update({ panorama_id: null })
        .eq("id", existingNode.id);
        
      if (error) throw error;
      
      // Find the panorama that was unassigned
      const unassignedPanorama = allPanoramas.find(
        p => p.id === existingNode.panorama_id
      );
      
      // Update local state
      setGridNodes(prev => ({
        ...prev,
        [posKey]: { ...existingNode, panorama_id: null }
      }));
      
      // Add the panorama back to unassigned list
      if (unassignedPanorama) {
        setUnassignedPanoramas(prev => [...prev, unassignedPanorama]);
      }
    } catch (error) {
      console.error("Error unassigning panorama:", error);
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
          is_public: isPublic,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentGrid.id);
        
      if (updateError) throw updateError;
      
      // Update the current grid in state
      setCurrentGrid({
        ...currentGrid,
        rows,
        cols,
        is_public: isPublic,
        updated_at: new Date().toISOString()
      });
      
      // 2. Get all existing nodes for this grid
      const { data: existingNodes, error: fetchError } = await supabase
        .from("grid_nodes")
        .select("*")
        .eq("grid_id", currentGrid.id);
        
      if (fetchError) throw fetchError;
      
      // 3. Delete nodes that are outside the new grid dimensions
      const nodesToDelete = (existingNodes || []).filter(
        node => node.grid_x >= cols || node.grid_y >= rows
      );
      
      if (nodesToDelete.length > 0) {
        const nodeIds = nodesToDelete.map(node => node.id);
        
        const { error: deleteError } = await supabase
          .from("grid_nodes")
          .delete()
          .in("id", nodeIds);
          
        if (deleteError) throw deleteError;
        
        // Add any panoramas from deleted nodes back to unassigned
        const panoramasToUnassign = nodesToDelete
          .filter(node => node.panorama_id)
          .map(node => allPanoramas.find(p => p.id === node.panorama_id))
          .filter(Boolean) as Panorama[];
          
        if (panoramasToUnassign.length > 0) {
          setUnassignedPanoramas(prev => [...prev, ...panoramasToUnassign]);
        }
        
        // Remove deleted nodes from local state
        const updatedGridNodes = { ...gridNodes };
        nodesToDelete.forEach(node => {
          const key = getPosKey(node.grid_x, node.grid_y);
          delete updatedGridNodes[key];
        });
        
        setGridNodes(updatedGridNodes);
      }
      
      setHasChanges(false);
      alert("Grid saved successfully!");
    } catch (error) {
      console.error("Error saving grid:", error);
      alert("Failed to save grid changes");
    } finally {
      setLoading(false);
    }
  };

  // Increase/decrease grid dimensions with buttons
  const increaseRows = () => {
    setRows(prev => prev + 1);
    setHasChanges(true);
  };
  
  const decreaseRows = () => {
    if (rows > 1) {
      setRows(prev => prev - 1);
      setHasChanges(true);
    }
  };
  
  const increaseCols = () => {
    setCols(prev => prev + 1);
    setHasChanges(true);
  };
  
  const decreaseCols = () => {
    if (cols > 1) {
      setCols(prev => prev - 1);
      setHasChanges(true);
    }
  };

  return {
    // State values
    currentGrid,
    rows,
    cols,
    isPublic,
    gridNodes,
    allPanoramas,
    unassignedPanoramas,
    openDropdownCell,
    loading,
    hasChanges,
    
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
    setOpenDropdownCell
  };
}