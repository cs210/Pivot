import * as FileSystem from "expo-file-system";
import { ImageGroup } from "../types";

const GROUP_STORAGE_PATH = `${FileSystem.documentDirectory}room_scanner/groups.json`;

export const GroupStorage = {
  // Save all groups
  saveGroups: async (groups: ImageGroup[]): Promise<void> => {
    try {
      const dirPath = `${FileSystem.documentDirectory}room_scanner/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      await FileSystem.writeAsStringAsync(
        GROUP_STORAGE_PATH,
        JSON.stringify(groups)
      );
    } catch (error) {
      console.error("Error saving groups:", error);
      throw error;
    }
  },

  // Load all groups
  loadGroups: async (): Promise<ImageGroup[]> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(GROUP_STORAGE_PATH);

      if (!fileInfo.exists) {
        return [];
      }

      const contents = await FileSystem.readAsStringAsync(GROUP_STORAGE_PATH);
      return JSON.parse(contents) as ImageGroup[];
    } catch (error) {
      console.error("Error loading groups:", error);
      return [];
    }
  },

  // Create a new group
  createGroup: async (
    name: string,
    description: string,
    imageUris: string[] = []
  ): Promise<ImageGroup> => {
    const groups = await GroupStorage.loadGroups();

    const newGroup: ImageGroup = {
      id: Date.now().toString(),
      name,
      description,
      imageUris,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await GroupStorage.saveGroups([...groups, newGroup]);
    return newGroup;
  },

  // Update an existing group
  updateGroup: async (updatedGroup: ImageGroup): Promise<ImageGroup> => {
    const groups = await GroupStorage.loadGroups();
    const index = groups.findIndex((g) => g.id === updatedGroup.id);

    if (index === -1) {
      throw new Error(`Group with id ${updatedGroup.id} not found`);
    }

    updatedGroup.updatedAt = Date.now();
    groups[index] = updatedGroup;

    await GroupStorage.saveGroups(groups);
    return updatedGroup;
  },

  // Delete a group
  deleteGroup: async (groupId: string): Promise<void> => {
    const groups = await GroupStorage.loadGroups();
    const filteredGroups = groups.filter((g) => g.id !== groupId);

    await GroupStorage.saveGroups(filteredGroups);
  },

  // Add images to a group
  addImagesToGroup: async (
    groupId: string,
    imageUris: string[]
  ): Promise<ImageGroup> => {
    const groups = await GroupStorage.loadGroups();
    const index = groups.findIndex((g) => g.id === groupId);

    if (index === -1) {
      throw new Error(`Group with id ${groupId} not found`);
    }

    // Add only unique images
    const uniqueUris = [...new Set([...groups[index].imageUris, ...imageUris])];
    groups[index].imageUris = uniqueUris;
    groups[index].updatedAt = Date.now();

    await GroupStorage.saveGroups(groups);
    return groups[index];
  },

  // Remove images from a group
  removeImagesFromGroup: async (
    groupId: string,
    imageUris: string[]
  ): Promise<ImageGroup> => {
    const groups = await GroupStorage.loadGroups();
    const index = groups.findIndex((g) => g.id === groupId);

    if (index === -1) {
      throw new Error(`Group with id ${groupId} not found`);
    }

    groups[index].imageUris = groups[index].imageUris.filter(
      (uri) => !imageUris.includes(uri)
    );
    groups[index].updatedAt = Date.now();

    await GroupStorage.saveGroups(groups);
    return groups[index];
  },
};
