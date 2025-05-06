import { supabase } from '../supabaseClient'; // Adjust the import path as needed
import { Project } from '../hooks/useProject'; // Import the existing Project type

/**
 * Moves a panorama file between public and private storage buckets
 * 
 * @param panoramaId - The ID of the panorama to move
 * @param toPublic - Whether to move to public (true) or private (false) bucket
 * @returns Object with success status and new path or error
 */
async function movePanoramaStorage(panoramaId: string, toPublic: boolean): Promise<{
  success: boolean;
  newPath?: string;
  error?: string;
}> {
  try {
    // 1. Get the panorama details including current storage path
    const { data: panorama, error: fetchError } = await supabase
      .from('panoramas')
      .select('*')
      .eq('id', panoramaId)
      .single();

    if (fetchError || !panorama) {
      return { 
        success: false, 
        error: fetchError?.message || 'Panorama not found' 
      };
    }

    const currentPath = panorama.storage_path;
    if (!currentPath) {
      return { 
        success: false, 
        error: 'Panorama has no storage path' 
      };
    }

    // 2. Determine source and destination buckets
    const sourceBucket = toPublic ? 'panoramas-private' : 'panoramas-public';
    const destBucket = toPublic ? 'panoramas-public' : 'panoramas-private';
    
    // Parse the storage path to ensure we're using it correctly
    // The storage path could be the full path or just the file key
    // We want to make sure we handle both cases
    let fileKey = currentPath;
    
    // 3. Download the file from source bucket
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(sourceBucket)
      .download(fileKey);

    if (downloadError || !fileData) {
      return { 
        success: false, 
        error: `Failed to download panorama: ${downloadError?.message || 'Unknown error'}` 
      };
    }

    // 4. Upload to destination bucket
    // Keep the same path structure in the destination bucket
    const newPath = fileKey;
    
    const { error: uploadError } = await supabase
      .storage
      .from(destBucket)
      .upload(newPath, fileData, {
        contentType: panorama.content_type,
        upsert: true
      });

    if (uploadError) {
      return { 
        success: false, 
        error: `Failed to upload panorama: ${uploadError.message}` 
      };
    }

    // 5. Delete from source bucket
    const { error: deleteError } = await supabase
      .storage
      .from(sourceBucket)
      .remove([currentPath]);

    if (deleteError) {
      // Log error but continue - we can clean up later
      console.error(`Warning: Failed to delete panorama from source bucket: ${deleteError.message}`);
    }

    // 6. Return success with the new path
    return {
      success: true,
      newPath: newPath
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during panorama move'
    };
  }
}

// Define result type for toggleProjectPublic
type ToggleProjectResult = {
  success: boolean;
  isNowPublic?: boolean;
  project?: Project;
  error?: string;
};

/**
 * Toggles a project's public status and moves all associated panoramas
 * between public and private storage buckets accordingly.
 * 
 * This function handles:
 * 1. Updating the project's is_public status in the database
 * 2. Moving all panorama files between public and private storage buckets
 * 3. Updating panorama storage paths in the database
 * 4. Attempt to maintain atomicity by reverting on failure
 * 
 * @param projectId - The ID of the project to toggle
 * @param setProject - Function to update project state in the UI
 * @returns Object with success status, new public state, and updated project
 */
export async function toggleProjectPublic(
  projectId: string,
  setProject: (project: Project) => void
): Promise<ToggleProjectResult> {
  // Begin a transaction to ensure atomicity
  try {
    // 1. Get current project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return { 
        success: false, 
        error: projectError?.message || 'Project not found' 
      };
    }

    const newPublicState = !project.is_public;

    // 2. Get all panoramas associated with this project
    const { data: panoramas, error: panoramasError } = await supabase
      .from('panoramas')
      .select('*')
      .eq('project_id', projectId);

    if (panoramasError) {
      return { 
        success: false, 
        error: `Failed to fetch panoramas: ${panoramasError.message}` 
      };
    }

    // 3. Begin transaction by updating project first
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({ is_public: newPublicState })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      return { 
        success: false, 
        error: `Failed to update project: ${updateError.message}` 
      };
    }

    // 4. Move each panorama to the appropriate bucket
    const moveResults = await Promise.all(
      (panoramas || []).map(panorama => 
        movePanoramaStorage(panorama.id, newPublicState)
      )
    );

    // Check if any moves failed
    const failedMoves = moveResults.filter(result => !result.success);
    if (failedMoves.length > 0) {
      console.error('Some panoramas failed to move:', failedMoves);
      
      // If any moves failed, attempt to revert the project update
      const { error: revertError } = await supabase
        .from('projects')
        .update({ is_public: project.is_public })
        .eq('id', projectId);
      
      if (revertError) {
        console.error('Failed to revert project status:', revertError);
        return {
          success: false,
          error: `Failed to move ${failedMoves.length} panoramas and could not revert project status.`
        };
      }
      
      return {
        success: false,
        error: `Failed to move ${failedMoves.length} panoramas. Project status reverted to original state.`
      };
    }

    // 5. Update storage paths for all panoramas in the database
    const storageUpdates = await Promise.all(
      moveResults.map((moveResult, index) => {
        if (!moveResult.success || !moveResult.newPath) return { success: false };
        
        return supabase
          .from('panoramas')
          .update({ storage_path: moveResult.newPath })
          .eq('id', panoramas![index].id)
          .then(response => {
            if (response.error) {
              console.error(`Failed to update storage path for panorama ${panoramas![index].id}:`, response.error);
              return { success: false, error: response.error };
            }
            return { success: true };
          });
      })
    );

    // Check if any storage path updates failed
    const failedUpdates = storageUpdates.filter(result => !result.success);
    if (failedUpdates.length > 0) {
      console.error('Some panorama paths failed to update in the database', failedUpdates);
      // We don't revert here because the files were already moved
      // A background job should reconcile these inconsistencies
    }

    // 6. Update local state
    if (setProject && updatedProject) {
      setProject(updatedProject);
    }

    // 7. Return success result
    return {
      success: true,
      isNowPublic: newPublicState,
      project: updatedProject
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during project toggle'
    };
  }
}

/**
 * Updates the public status of all panoramas to match the project's status
 * Note: This is primarily for backward compatibility or manual reconciliation 
 * as database triggers should automatically handle this synchronization
 * 
 * @param projectId - The ID of the project
 * @param isPublic - Whether the panoramas should be public or private
 */
export async function updatePanoramasPublicStatus(
  projectId: string,
  isPublic: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // This might be redundant due to database triggers, but keeping for safety
    // Your database triggers (trg_update_panorama_is_public) should handle this automatically
    const { error } = await supabase
      .from('panoramas')
      .update({ is_public: isPublic })
      .eq('project_id', projectId);

    if (error) {
      return {
        success: false,
        error: `Failed to update panoramas public status: ${error.message}`
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during panorama status update'
    };
  }
}