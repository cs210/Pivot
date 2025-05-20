import { useEffect } from 'react';

export function useProjectView(projectId: string, inOrganization: boolean) {
  useEffect(() => {
    const recordView = async () => {
      if (!inOrganization) return;

      try {
        await fetch(`/api/projects/${projectId}/views`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Error recording project view:', error);
      }
    };

    recordView();
  }, [projectId, inOrganization]);
} 