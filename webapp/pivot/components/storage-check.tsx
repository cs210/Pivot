"use client";

import { useEffect, useState } from "react";
import { ensureImageStorageBucket } from "@/utils/setup-supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function StorageCheck() {
  const [bucketMissing, setBucketMissing] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Only check once on component mount
    if (!checked) {
      const checkBucket = async () => {
        try {
          const exists = await ensureImageStorageBucket();
          setBucketMissing(!exists);
        } catch (error) {
          console.error("Error during bucket check:", error);
          // If there's an error checking, don't show warning - assume it exists
          setBucketMissing(false);
        } finally {
          setChecked(true);
        }
      };

      checkBucket();
    }
  }, [checked]);

  // If we haven't checked yet or if the bucket exists, don't show anything
  if (!checked || !bucketMissing) return null;

  return (
    <Alert variant="destructive" className="mb-4 max-w-3xl mx-auto">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Storage Setup Required</AlertTitle>
      <AlertDescription>
        <p>The "images" storage bucket is missing. To use image upload:</p>
        <ol className="list-decimal pl-4 mt-2">
          <li>
            Go to your{" "}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Supabase Dashboard
            </a>
          </li>
          <li>Select your project</li>
          <li>Navigate to Storage section</li>
          <li>Create a new bucket named "images"</li>
          <li>Set bucket permissions to public</li>
        </ol>
      </AlertDescription>
    </Alert>
  );
}
