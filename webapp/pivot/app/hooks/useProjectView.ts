import { useEffect, useRef } from 'react';

export function useProjectView(
  projectId: string,
  inOrganization: boolean,
  onViewRecorded?: (viewId: string) => void
) {
  const hasRecordedView = useRef(false);

  useEffect(() => {
    const recordView = async () => {
      // Prevent double counting in development mode
      if (hasRecordedView.current) return;
      hasRecordedView.current = true;

      try {
        const response = await fetch(`/api/projects/${projectId}/views`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recordTotalView: true,
            recordUniqueView: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          onViewRecorded?.(data.viewId);
        }
      } catch (error) {
        console.error('Error recording project view:', error);
        // Reset the flag if there's an error so we can try again
        hasRecordedView.current = false;
      }
    };

    recordView();
  }, [projectId, onViewRecorded]);
} 