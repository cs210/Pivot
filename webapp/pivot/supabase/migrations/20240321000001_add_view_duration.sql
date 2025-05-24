-- Add view_duration column to project_views table
ALTER TABLE project_views
ADD COLUMN view_duration INTEGER DEFAULT 0; -- Duration in seconds 