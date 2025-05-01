/**
 * Types for the Pivot Camera App
 */

/**
 * Represents a group of images created by the user
 */
export interface ImageGroup {
  id: string;
  name: string;
  description: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  imageUris: string[];
}
