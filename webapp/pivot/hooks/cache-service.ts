// cache-service.ts - A central caching mechanism for all project-related data

import { RawImage } from "./useRawImages";
import { Panorama } from "./usePanoramas";
import { Project } from "./useProject";
import { Grid, GridNode } from "./useGrids";

// Interface for the global cache
interface GlobalCache {
  projects: Record<string, Project>;
  rawImages: Record<string, RawImage[]>;
  panoramas: Record<string, Panorama[]>;
  grids: Record<string, Grid>;
  gridNodes: Record<string, Record<string, GridNode>>;
  lastFetched: Record<string, Record<string, number>>;
}

// Initialize the global cache
const globalCache: GlobalCache = {
  projects: {},
  rawImages: {},
  panoramas: {},
  grids: {},
  gridNodes: {},
  lastFetched: {
    projects: {},
    rawImages: {},
    panoramas: {},
    grids: {}
  }
};

// Cache expiration time in milliseconds (e.g., 5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Function to check if cache is valid
export function isCacheValid(type: 'projects' | 'rawImages' | 'panoramas' | 'grids', id: string): boolean {
  const lastFetched = globalCache.lastFetched[type][id];
  if (!lastFetched) return false;
  
  return Date.now() - lastFetched < CACHE_EXPIRATION;
}

// Get project from cache
export function getCachedProject(projectId: string): Project | null {
  return globalCache.projects[projectId] || null;
}

// Set project in cache
export function cacheProject(project: Project): void {
  globalCache.projects[project.id] = project;
  globalCache.lastFetched.projects[project.id] = Date.now();
}

// Get raw images from cache
export function getCachedRawImages(projectId: string): RawImage[] | null {
  if (!isCacheValid('rawImages', projectId)) return null;
  return globalCache.rawImages[projectId] || null;
}

// Set raw images in cache
export function cacheRawImages(projectId: string, images: RawImage[]): void {
  globalCache.rawImages[projectId] = images;
  globalCache.lastFetched.rawImages[projectId] = Date.now();
}

// Add a single raw image to cache
export function addRawImageToCache(projectId: string, image: RawImage): void {
  if (!globalCache.rawImages[projectId]) {
    globalCache.rawImages[projectId] = [];
  }
  
  // Check if image already exists in cache, update it if it does
  const existingIndex = globalCache.rawImages[projectId].findIndex(img => img.id === image.id);
  if (existingIndex >= 0) {
    globalCache.rawImages[projectId][existingIndex] = image;
  } else {
    globalCache.rawImages[projectId].push(image);
  }
  
  globalCache.lastFetched.rawImages[projectId] = Date.now();
}

// Remove a raw image from cache
export function removeRawImageFromCache(projectId: string, imageId: string): void {
  if (!globalCache.rawImages[projectId]) return;
  
  globalCache.rawImages[projectId] = globalCache.rawImages[projectId].filter(img => img.id !== imageId);
}

// Get panoramas from cache
export function getCachedPanoramas(projectId: string): Panorama[] | null {
  if (!isCacheValid('panoramas', projectId)) return null;
  return globalCache.panoramas[projectId] || null;
}

// Set panoramas in cache
export function cachePanoramas(projectId: string, panoramas: Panorama[]): void {
  globalCache.panoramas[projectId] = panoramas;
  globalCache.lastFetched.panoramas[projectId] = Date.now();
}

// Add a single panorama to cache
export function addPanoramaToCache(projectId: string, panorama: Panorama): void {
  if (!globalCache.panoramas[projectId]) {
    globalCache.panoramas[projectId] = [];
  }
  
  // Check if panorama already exists in cache, update it if it does
  const existingIndex = globalCache.panoramas[projectId].findIndex(pano => pano.id === panorama.id);
  if (existingIndex >= 0) {
    globalCache.panoramas[projectId][existingIndex] = panorama;
  } else {
    globalCache.panoramas[projectId].push(panorama);
  }
  
  globalCache.lastFetched.panoramas[projectId] = Date.now();
}

// Remove a panorama from cache
export function removePanoramaFromCache(projectId: string, panoramaId: string): void {
  if (!globalCache.panoramas[projectId]) return;
  
  globalCache.panoramas[projectId] = globalCache.panoramas[projectId].filter(pano => pano.id !== panoramaId);
}

// Update a panorama in cache
export function updatePanoramaInCache(projectId: string, panoramaId: string, updateData: Partial<Panorama>): void {
  if (!globalCache.panoramas[projectId]) return;
  
  const index = globalCache.panoramas[projectId].findIndex(pano => pano.id === panoramaId);
  if (index >= 0) {
    globalCache.panoramas[projectId][index] = {
      ...globalCache.panoramas[projectId][index],
      ...updateData
    };
  }
}

// Update a raw image in cache
export function updateRawImageInCache(projectId: string, imageId: string, updateData: Partial<RawImage>): void {
  if (!globalCache.rawImages[projectId]) return;
  
  const index = globalCache.rawImages[projectId].findIndex(img => img.id === imageId);
  if (index >= 0) {
    globalCache.rawImages[projectId][index] = {
      ...globalCache.rawImages[projectId][index],
      ...updateData
    };
  }
}

// Get grid from cache
export function getCachedGrid(projectId: string): Grid | null {
  if (!isCacheValid('grids', projectId)) return null;
  return globalCache.grids[projectId] || null;
}

// Set grid in cache
export function cacheGrid(projectId: string, grid: Grid): void {
  globalCache.grids[projectId] = grid;
  globalCache.lastFetched.grids[projectId] = Date.now();
}

// Update grid in cache
export function updateGridInCache(projectId: string, gridId: string, updateData: Partial<Grid>): void {
  if (!globalCache.grids[projectId]) return;
  
  globalCache.grids[projectId] = {
    ...globalCache.grids[projectId],
    ...updateData
  };
}

// Get grid nodes from cache
export function getCachedGridNodes(projectId: string): Record<string, GridNode> | null {
  if (!isCacheValid('grids', projectId)) return null;
  return globalCache.gridNodes[projectId] || null;
}

// Set grid nodes in cache
export function cacheGridNodes(projectId: string, nodes: Record<string, GridNode>): void {
  globalCache.gridNodes[projectId] = nodes;
  // Update the timestamp when we last fetched grid data
  globalCache.lastFetched.grids[projectId] = Date.now();
}

// Update a grid node in cache
export function updateGridNodeInCache(projectId: string, posKey: string, node: GridNode): void {
  if (!globalCache.gridNodes[projectId]) {
    globalCache.gridNodes[projectId] = {};
  }
  
  globalCache.gridNodes[projectId][posKey] = node;
}

// Remove a grid node from cache
export function removeGridNodeFromCache(projectId: string, posKey: string): void {
  if (!globalCache.gridNodes[projectId]) return;
  
  const updatedNodes = { ...globalCache.gridNodes[projectId] };
  delete updatedNodes[posKey];
  globalCache.gridNodes[projectId] = updatedNodes;
}

// Clear cache for a specific project
export function clearProjectCache(projectId: string): void {
  delete globalCache.projects[projectId];
  delete globalCache.rawImages[projectId];
  delete globalCache.panoramas[projectId];
  delete globalCache.grids[projectId];
  delete globalCache.gridNodes[projectId];
  delete globalCache.lastFetched.projects[projectId];
  delete globalCache.lastFetched.rawImages[projectId];
  delete globalCache.lastFetched.panoramas[projectId];
  delete globalCache.lastFetched.grids[projectId];
}

// Clear all cache
export function clearAllCache(): void {
  Object.keys(globalCache.projects).forEach(key => delete globalCache.projects[key]);
  Object.keys(globalCache.rawImages).forEach(key => delete globalCache.rawImages[key]);
  Object.keys(globalCache.panoramas).forEach(key => delete globalCache.panoramas[key]);
  Object.keys(globalCache.grids).forEach(key => delete globalCache.grids[key]);
  Object.keys(globalCache.gridNodes).forEach(key => delete globalCache.gridNodes[key]);
  
  globalCache.lastFetched = {
    projects: {},
    rawImages: {},
    panoramas: {},
    grids: {}
  };
}

// Export the cache for debugging purposes
export function getCache(): GlobalCache {
  return globalCache;
}