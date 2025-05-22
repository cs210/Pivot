import { useEffect, useRef } from 'react';

export function useProjectView(projectId: string, inOrganization: boolean) {
  const hasRecordedView = useRef(false);

  useEffect(() => {
    const recordView = async () => {
      // Prevent double counting in development mode
      if (hasRecordedView.current) return;
      hasRecordedView.current = true;

      try {
        await fetch(`/api/projects/${projectId}/views`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recordTotalView: true,
            recordUniqueView: true,
          }),
        });
      } catch (error) {
        console.error('Error recording project view:', error);
        // Reset the flag if there's an error so we can try again
        hasRecordedView.current = false;
      }
    };

    recordView();
  }, [projectId]);
} 