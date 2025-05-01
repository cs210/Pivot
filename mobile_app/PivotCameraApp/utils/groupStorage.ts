import * as FileSystem from "expo-file-system";
import { Alert } from "react-native";
import { ImageGroup } from "../types";

/**
 * Generate a simple UUID that works in React Native
 * This avoids the crypto.getRandomValues() dependency issues
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Helper class to manage image groups storage
 */
export class GroupStorage {
  private static readonly GROUPS_DIRECTORY = `${FileSystem.documentDirectory}image_groups/`;
  private static readonly GROUPS_FILE = `${GroupStorage.GROUPS_DIRECTORY}groups.json`;

  /**
   * Initialize the storage - create directories if they don't exist
   */
  private static async initStorage(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(
        GroupStorage.GROUPS_DIRECTORY
      );
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(GroupStorage.GROUPS_DIRECTORY, {
          intermediates: true,
        });
      }

      const fileInfo = await FileSystem.getInfoAsync(GroupStorage.GROUPS_FILE);
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(
          GroupStorage.GROUPS_FILE,
          JSON.stringify([])
        );
      }
    } catch (error) {
      console.error("Error initializing group storage:", error);
      throw new Error("Failed to initialize storage");
    }
  }

  /**
   * Load all groups from storage
   */
  public static async loadGroups(): Promise<ImageGroup[]> {
    try {
      await GroupStorage.initStorage();

      const content = await FileSystem.readAsStringAsync(
        GroupStorage.GROUPS_FILE
      );
      return JSON.parse(content) as ImageGroup[];
    } catch (error) {
      console.error("Error loading groups:", error);
      return [];
    }
  }

  /**
   * Get a specific group by ID
   */
  public static async getGroupById(id: string): Promise<ImageGroup | null> {
    try {
      const groups = await GroupStorage.loadGroups();
      return groups.find((group) => group.id === id) || null;
    } catch (error) {
      console.error("Error getting group by ID:", error);
      return null;
    }
  }

  /**
   * Save groups to storage
   */
  private static async saveGroups(groups: ImageGroup[]): Promise<void> {
    try {
      await GroupStorage.initStorage();
      await FileSystem.writeAsStringAsync(
        GroupStorage.GROUPS_FILE,
        JSON.stringify(groups)
      );
    } catch (error) {
      console.error("Error saving groups:", error);
      throw new Error("Failed to save groups");
    }
  }

  /**
   * Create a new group
   */
  public static async createGroup(
    name: string,
    description: string = "",
    imageUris: string[] = []
  ): Promise<ImageGroup> {
    try {
      const groups = await GroupStorage.loadGroups();

      const newGroup: ImageGroup = {
        id: generateUUID(),
        name,
        description,
        imageUris,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      groups.push(newGroup);
      await GroupStorage.saveGroups(groups);

      return newGroup;
    } catch (error) {
      console.error("Error creating group:", error);
      throw new Error("Failed to create group");
    }
  }

  /**
   * Update an existing group
   */
  public static async updateGroup(
    updatedGroup: ImageGroup
  ): Promise<ImageGroup> {
    try {
      const groups = await GroupStorage.loadGroups();

      const index = groups.findIndex((g) => g.id === updatedGroup.id);
      if (index === -1) {
        throw new Error(`Group with ID ${updatedGroup.id} not found`);
      }

      updatedGroup.updatedAt = Date.now();
      groups[index] = updatedGroup;

      await GroupStorage.saveGroups(groups);
      return updatedGroup;
    } catch (error) {
      console.error("Error updating group:", error);
      throw new Error("Failed to update group");
    }
  }

  /**
   * Delete a group by ID
   */
  public static async deleteGroup(id: string): Promise<boolean> {
    try {
      const groups = await GroupStorage.loadGroups();
      const filteredGroups = groups.filter((group) => group.id !== id);

      if (filteredGroups.length === groups.length) {
        return false; // No group was deleted
      }

      await GroupStorage.saveGroups(filteredGroups);
      return true;
    } catch (error) {
      console.error("Error deleting group:", error);
      throw new Error("Failed to delete group");
    }
  }

  /**
   * Add images to a group
   */
  public static async addImagesToGroup(
    groupId: string,
    imageUris: string[]
  ): Promise<ImageGroup> {
    try {
      const groups = await GroupStorage.loadGroups();

      const groupIndex = groups.findIndex((g) => g.id === groupId);
      if (groupIndex === -1) {
        throw new Error(`Group with ID ${groupId} not found`);
      }

      // Add images, avoiding duplicates
      const group = groups[groupIndex];
      const existingUris = new Set(group.imageUris);

      imageUris.forEach((uri) => existingUris.add(uri));
      group.imageUris = Array.from(existingUris);
      group.updatedAt = Date.now();

      await GroupStorage.saveGroups(groups);
      return group;
    } catch (error) {
      console.error("Error adding images to group:", error);
      throw new Error("Failed to add images to group");
    }
  }

  /**
   * Remove images from a group
   */
  public static async removeImagesFromGroup(
    groupId: string,
    imageUris: string[]
  ): Promise<ImageGroup> {
    try {
      const groups = await GroupStorage.loadGroups();

      const groupIndex = groups.findIndex((g) => g.id === groupId);
      if (groupIndex === -1) {
        throw new Error(`Group with ID ${groupId} not found`);
      }

      // Remove specified images
      const group = groups[groupIndex];
      const urisToRemove = new Set(imageUris);

      group.imageUris = group.imageUris.filter((uri) => !urisToRemove.has(uri));
      group.updatedAt = Date.now();

      await GroupStorage.saveGroups(groups);
      return group;
    } catch (error) {
      console.error("Error removing images from group:", error);
      throw new Error("Failed to remove images from group");
    }
  }
}
