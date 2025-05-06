import { supabase } from "../supabaseClient"; // client-side Supabase instance

export async function toggleProjectPublic(projectId: string, setProject: (project: any) => void) {
  console.log("[toggleProjectPublic] Toggling visibility for projectId:", projectId);

  // Step 0: Check auth session (Supabase v2)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[toggleProjectPublic] User not signed in:", authError);
    return {
      success: false,
      error: "You must be signed in to toggle project visibility.",
    };
  }

  console.log("[toggleProjectPublic] Signed in as user:", user.id);

  // Step 1: Fetch the project (RLS must allow it)
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("id, is_public")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchError) {
    console.error("[toggleProjectPublic] Error fetching project:", fetchError);
    return {
      success: false,
      error: fetchError.message || "Error fetching project",
    };
  }

  if (!project) {
    console.error("[toggleProjectPublic] No project found or access denied:", projectId);
    return {
      success: false,
      error: "Project not found or access denied (check RLS)",
    };
  }

  const newIsPublic = !project.is_public;
  const sourceBucket = newIsPublic ? "panoramas-private" : "panoramas-public";
  const targetBucket = newIsPublic ? "panoramas-public" : "panoramas-private";

  // Step 2: Fetch panoramas
  const { data: panoramas, error: panoError } = await supabase
    .from("panoramas")
    .select("id, storage_path")
    .eq("project_id", projectId);

  if (panoError || !panoramas) {
    console.error("[toggleProjectPublic] Error fetching panoramas:", panoError);
    return {
      success: false,
      error: panoError?.message || "Could not fetch panoramas",
    };
  }

  // Step 3: Move each file
  for (const pano of panoramas) {
    const filePath = pano.storage_path;

    const copyRes = await supabase.storage
      .from(sourceBucket)
      .copy(filePath, filePath); // same path in new bucket

    if (copyRes.error) {
      console.error(`[toggleProjectPublic] Failed to copy ${filePath}:`, copyRes.error);
      return {
        success: false,
        error: `Copy failed for ${filePath}: ${copyRes.error.message}`,
      };
    }

    const deleteRes = await supabase.storage
      .from(sourceBucket)
      .remove([filePath]);

    if (deleteRes.error) {
      console.error(`[toggleProjectPublic] Failed to delete ${filePath}:`, deleteRes.error);
      return {
        success: false,
        error: `Delete failed for ${filePath}: ${deleteRes.error.message}`,
      };
    }
  }

  // Step 4: Update project visibility
  const { data: updated, error: updateError } = await supabase
    .from("projects")
    .update({ is_public: newIsPublic })
    .eq("id", projectId)
    .select()
    .maybeSingle();

  if (updateError || !updated) {
    console.error("[toggleProjectPublic] Failed to update project:", updateError);
    return {
      success: false,
      error: updateError?.message || "Could not update project",
    };
  }

  console.log("[toggleProjectPublic] Visibility toggled successfully");
  setProject(updated);

  return {
    success: true,
    isNowPublic: newIsPublic,
    project: updated,
  };
}
