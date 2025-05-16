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
 * Represents a project from the web app
 */
export interface Project {
  id: string;
  name: string;
}

/**
 * Defines the parameters expected by each screen in the root stack navigator.
 */
export type RootStackParamList = {
  Home: { projectIds?: string[] }; // Home screen expects an optional array of project IDs
  Auth: undefined; // Auth screen doesn't expect any parameters
  Profile: undefined; // Add profile screen route
  GroupDetail: { groupId: string; projects?: Project[] }; // GroupDetail screen expects a groupId and optional projects array
  Camera: undefined; // Camera screen doesn't expect any parameters
  SignUp: undefined; // SignUp screen doesn't expect any parameters
  // Add other root stack screens and their parameters here
  // Example: Profile: { userId: string };
};
