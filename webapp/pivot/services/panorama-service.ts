// Service layer for panorama operations
import { supabase } from '../supabaseClient'

/**
 * Moves a file between storage buckets
 */
async function moveFileBetweenBuckets(
    sourceBucket: string,
    destBucket: string,
    filePath: string,
    contentType: string
  ) {
    try {
      // Download the file from source bucket
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from(sourceBucket)
        .download(filePath);
      
      if (downloadError || !fileData) {
        console.error('Error downloading file:', downloadError);
        return { 
          success: false, 
          error: `Failed to download file: ${downloadError?.message || 'Unknown error'}` 
        };
      }
      
      // Upload the file to destination bucket
      const { error: uploadError } = await supabase
        .storage
        .from(destBucket)
        .upload(filePath, fileData, {
          contentType: contentType,
          upsert: true
        });
      
      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return { 
          success: false, 
          error: `Failed to upload file: ${uploadError.message}` 
        };
      }
      
      // Delete the file from source bucket
      const { error: deleteError } = await supabase
        .storage
        .from(sourceBucket)
        .remove([filePath]);
      
      if (deleteError) {
        console.warn('Warning: Failed to delete original file:', deleteError);
        return {
          success: true,
          warning: `File copied successfully, but failed to delete the original: ${deleteError.message}`
        };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error moving file:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred moving the file'
      };
    }
  }
  
  /**
   * Moves all panorama files associated with a project between public/private buckets
   */
  export async function moveProjectPanoramaFiles(
    projectId: string, 
    isPublic: boolean
  ) {
    try {
      // 1. Fetch all panoramas belonging to this project
      const { data: panoramas, error: fetchError } = await supabase
        .from('panoramas')
        .select('id, storage_path, content_type')
        .eq('project_id', projectId);
      
      if (fetchError) {
        console.error('Error fetching panoramas:', fetchError);
        return {
          success: false,
          error: `Failed to fetch panoramas: ${fetchError.message}`
        };
      }
      
      // Filter out panoramas without storage_path
      const panoramasWithFiles = panoramas?.filter(p => p.storage_path) || [];
      
      if (panoramasWithFiles.length === 0) {
        return { 
          success: true, 
          message: 'No panorama files to move'
        };
      }
      
      // 2. Determine source and destination buckets
      const sourceBucket = isPublic ? 'panoramas-private' : 'panoramas-public';
      const destBucket = isPublic ? 'panoramas-public' : 'panoramas-private';
      
      // 3. Move each panorama file
      const moveResults = await Promise.all(
        panoramasWithFiles.map(panorama => 
          moveFileBetweenBuckets(
            sourceBucket,
            destBucket,
            panorama.storage_path,
            panorama.content_type
          )
        )
      );
      
      // 4. Check for any failures
      const failures = moveResults.filter(result => !result.success);
      
      if (failures.length > 0) {
        console.error('Some files failed to move:', failures);
        return {
          success: false,
          error: `Failed to move ${failures.length} out of ${panoramasWithFiles.length} files`,
          details: failures
        };
      }
      
      // 5. Check for any warnings
      const warnings = moveResults.filter(result => result.warning);
      
      return {
        success: true,
        message: `Successfully moved ${panoramasWithFiles.length} files`,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error: any) {
      console.error('Error moving project panorama files:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }
  
  /**
   * Updates a project's public status and moves all associated panorama files
   */
  export async function toggleProjectPublic(
    id: string, 
    currentProjects: any[], 
    setProjects: (projects: any[]) => void
  ) {
    try {
      // Get the current project
      const project = currentProjects.find(p => p.id === id);
      if (!project) {
        throw new Error("Project not found");
      }
      
      const newPublicState = !project.is_public;
      
      // First move the files - do this BEFORE updating the database
      const moveResult = await moveProjectPanoramaFiles(id, newPublicState);
      
      if (!moveResult.success) {
        console.error('Failed to move panorama files:', moveResult.error);
        return { 
          success: false, 
          error: moveResult.error || 'Failed to move files' 
        };
      }
      
      // Then update the database
      const { error } = await supabase
        .from("projects")
        .update({ is_public: newPublicState })
        .eq("id", id);
  
      if (error) {
        console.error('Database update error:', error);
        throw error;
      }
  
      // Update local state
      setProjects(currentProjects.map(p => 
        p.id === id ? { ...p, is_public: newPublicState } : p
      ));
      
      return { 
        success: true, 
        project: { ...project, is_public: newPublicState },
        isNowPublic: newPublicState,
        fileMessage: moveResult.message,
        warnings: moveResult.warnings
      };
    } catch (error: any) {
      console.error("Error updating project visibility:", error);
      throw error;
    }
  }
  
  // Also update panorama is_public status when the associated project changes
  export async function updatePanoramasPublicStatus(projectId: string, isPublic: boolean) {
    try {
      const { error } = await supabase
        .from('panoramas')
        .update({ is_public: isPublic })
        .eq('project_id', projectId);
        
      if (error) {
        console.error('Error updating panoramas public status:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating panoramas public status:', error);
      return { success: false, error: error.message };
    }
  }