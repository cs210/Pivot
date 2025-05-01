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

/**
 * Defines the parameters expected by each screen in the root stack navigator.
 */
export type RootStackParamList = {
  Home: { projectIds?: string[] }; // Home screen expects an optional array of project IDs
  Auth: undefined; // Auth screen doesn't expect any parameters
  // Add other root stack screens and their parameters here
  // Example: Profile: { userId: string };
};
