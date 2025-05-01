// Types for image groups management
export interface ImageGroup {
  id: string;
  name: string;
  description: string;
  imageUris: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ImageItem {
  uri: string;
  filename: string;
  selected: boolean;
  groupIds?: string[]; // Track which groups this image belongs to
}
