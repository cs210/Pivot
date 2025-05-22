-- Add is_unique_view column to project_views table
ALTER TABLE project_views
ADD COLUMN is_unique_view BOOLEAN DEFAULT false;

-- Update existing records to mark first views as unique
WITH first_views AS (
  SELECT DISTINCT ON (project_id, user_id) id
  FROM project_views
  ORDER BY project_id, user_id, viewed_at ASC
)
UPDATE project_views
SET is_unique_view = true
WHERE id IN (SELECT id FROM first_views); 