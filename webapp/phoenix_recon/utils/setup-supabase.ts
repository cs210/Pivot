import { createClient } from "@/utils/supabase/client";

export async function ensureImageStorageBucket() {
  const supabase = createClient();
  try {
    // Instead of checking bucket existence through listBuckets (which might have permission issues),
    // try to list objects from the bucket directly
    const { data, error } = await supabase.storage
      .from("images")
      .list("", { limit: 1 });

    // If we can list objects (even if there are none), then the bucket exists
    if (!error) {
      console.log("Images bucket exists and is accessible");
      return true;
    }

    // If it's a specific error that indicates the bucket doesn't exist
    if (error && error.message && error.message.includes("bucket not found")) {
      console.warn(
        "Images bucket doesn't exist. Please create it in the Supabase dashboard."
      );
      return false;
    }

    // If it's a permissions error, but the bucket might still exist
    if (error && error.message && error.message.includes("permission")) {
      console.warn(
        "Cannot verify bucket existence due to permissions. Assuming it exists."
      );
      return true;
    }

    console.error("Error checking bucket:", error);
    // If we're not sure, assume the bucket exists to prevent unnecessary warnings
    return true;
  } catch (error) {
    console.error("Error checking storage bucket:", error);
    // Assume the bucket exists if we have an unexpected error
    return true;
  }
}
