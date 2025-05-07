import * as FileSystem from "expo-file-system";
import { Project } from "../types";

/**
 * Helper class to manage project storage
 */
export class ProjectStorage {
  private static readonly STORAGE_DIRECTORY = `${FileSystem.documentDirectory}projects/`;
  private static readonly PROJECTS_FILE = `${ProjectStorage.STORAGE_DIRECTORY}projects.json`;

  /**
   * Initialize the storage - create directories if they don't exist
   */
  private static async initStorage(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(
        ProjectStorage.STORAGE_DIRECTORY
      );
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(ProjectStorage.STORAGE_DIRECTORY, {
          intermediates: true,
        });
      }

      const fileInfo = await FileSystem.getInfoAsync(
        ProjectStorage.PROJECTS_FILE
      );
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(
          ProjectStorage.PROJECTS_FILE,
          JSON.stringify([])
        );
      }
    } catch (error) {
      console.error("Error initializing project storage:", error);
      throw new Error("Failed to initialize project storage");
    }
  }

  /**
   * Save projects to storage
   */
  public static async saveProjects(projects: Project[]): Promise<void> {
    try {
      await ProjectStorage.initStorage();
      await FileSystem.writeAsStringAsync(
        ProjectStorage.PROJECTS_FILE,
        JSON.stringify(projects)
      );
      console.log(`Saved ${projects.length} projects to storage`);
    } catch (error) {
      console.error("Error saving projects:", error);
      throw new Error("Failed to save projects");
    }
  }

  /**
   * Load all projects from storage
   */
  public static async loadProjects(): Promise<Project[]> {
    try {
      await ProjectStorage.initStorage();

      const content = await FileSystem.readAsStringAsync(
        ProjectStorage.PROJECTS_FILE
      );
      const projects = JSON.parse(content) as Project[];
      console.log(`Loaded ${projects.length} projects from storage`);
      return projects;
    } catch (error) {
      console.error("Error loading projects:", error);
      return [];
    }
  }

  /**
   * Get a specific project by ID
   */
  public static async getProjectById(id: string): Promise<Project | null> {
    try {
      const projects = await ProjectStorage.loadProjects();
      return projects.find((project) => project.id === id) || null;
    } catch (error) {
      console.error("Error getting project by ID:", error);
      return null;
    }
  }

  /**
   * Clear all projects from storage
   */
  public static async clearProjects(): Promise<void> {
    try {
      await ProjectStorage.saveProjects([]);
      console.log("Cleared all projects from storage");
    } catch (error) {
      console.error("Error clearing projects:", error);
      throw new Error("Failed to clear projects");
    }
  }
}
