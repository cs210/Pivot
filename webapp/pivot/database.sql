-- Enable the necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create storage buckets
-- Supabase SQL doesn't directly create buckets, but this can be done via the Supabase UI
-- or API. These comments serve as reminders for what you'll need to create:
-- 1. raw_images bucket (private)
-- 2. panoramas bucket (can be public)

-- Create auth schema tables if not already present
-- Supabase has built-in auth, so we'll just reference the auth.users table

-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_project_name_per_user UNIQUE (name, user_id)
);

-- Folders Table
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_folder_name_per_project_and_parent UNIQUE (name, project_id, parent_folder_id)
);

-- Panoramas Table
CREATE TABLE panoramas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    metadata JSONB,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Raw Images Table (with optional reference to panorama if it was used to generate one)
CREATE TABLE raw_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    metadata JSONB,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    panorama_id UUID REFERENCES panoramas(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Grid Nodes Table (with direct reference to panorama)
CREATE TABLE grid_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    panorama_id UUID REFERENCES panoramas(id) ON DELETE SET NULL,
    grid_x INTEGER NOT NULL,
    grid_y INTEGER NOT NULL,
    name TEXT,
    description TEXT,
    rotation_degrees INTEGER DEFAULT 0,
    scale_factor DECIMAL(10,2) DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_grid_position UNIQUE (project_id, grid_x, grid_y)
);

-- Create RLS (Row Level Security) Policies
-- Projects table policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON projects FOR DELETE
USING (auth.uid() = user_id);

-- Folders table policies
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view folders in their projects"
ON folders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert folders in their projects"
ON folders FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update folders in their projects"
ON folders FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete folders in their projects"
ON folders FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Raw Images table policies
ALTER TABLE raw_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own raw images"
ON raw_images FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own raw images"
ON raw_images FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own raw images"
ON raw_images FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own raw images"
ON raw_images FOR DELETE
USING (auth.uid() = user_id);

-- Panoramas table policies
ALTER TABLE panoramas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own panoramas"
ON panoramas FOR SELECT
USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can insert their own panoramas"
ON panoramas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own panoramas"
ON panoramas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own panoramas"
ON panoramas FOR DELETE
USING (auth.uid() = user_id);

-- Grid Nodes table policies
ALTER TABLE grid_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view grid nodes for their projects"
ON grid_nodes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grid_nodes.project_id
        AND projects.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM panoramas
        WHERE panoramas.id = grid_nodes.panorama_id
        AND panoramas.is_public = TRUE
    )
);

CREATE POLICY "Users can insert grid nodes for their projects"
ON grid_nodes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grid_nodes.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update grid nodes for their projects"
ON grid_nodes FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grid_nodes.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete grid nodes for their projects"
ON grid_nodes FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grid_nodes.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Create functions for updating timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
BEFORE UPDATE ON folders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_raw_images_updated_at
BEFORE UPDATE ON raw_images
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_panoramas_updated_at
BEFORE UPDATE ON panoramas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grid_nodes_updated_at
BEFORE UPDATE ON grid_nodes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_folders_project_id ON folders(project_id);
CREATE INDEX idx_folders_parent_folder_id ON folders(parent_folder_id);
CREATE INDEX idx_raw_images_project_id ON raw_images(project_id);
CREATE INDEX idx_raw_images_folder_id ON raw_images(folder_id);
CREATE INDEX idx_raw_images_panorama_id ON raw_images(panorama_id);
CREATE INDEX idx_raw_images_user_id ON raw_images(user_id);
CREATE INDEX idx_panoramas_project_id ON panoramas(project_id);
CREATE INDEX idx_panoramas_user_id ON panoramas(user_id);
CREATE INDEX idx_panoramas_is_public ON panoramas(is_public);
CREATE INDEX idx_grid_nodes_project_id ON grid_nodes(project_id);
CREATE INDEX idx_grid_nodes_panorama_id ON grid_nodes(panorama_id);
CREATE INDEX idx_grid_nodes_coordinates ON grid_nodes(grid_x, grid_y);

-- Policies for panoramas bucket
-- Allow authenticated users to upload panoramas
CREATE POLICY "Authenticated users can upload panoramas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'panoramas' AND auth.uid() = owner);

-- Allow users to update their own panoramas
CREATE POLICY "Users can update their own panoramas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'panoramas' AND auth.uid() = owner);

-- Allow users to delete their own panoramas
CREATE POLICY "Users can delete their own panoramas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'panoramas' AND auth.uid() = owner);

-- Allow users to view their own panoramas
CREATE POLICY "Users can view their own panoramas"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'panoramas' 
  AND auth.uid() = owner
);

-- Allow anyone to view public panoramas
CREATE POLICY "Anyone can view public panoramas"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (
  bucket_id = 'panoramas'
  AND EXISTS (
    SELECT 1 FROM panoramas
    WHERE panoramas.storage_path = storage.objects.name
    AND panoramas.is_public = TRUE
  )
);

-- Policies for raw-images bucket
-- Allow authenticated users to upload raw images
CREATE POLICY "Authenticated users can upload raw images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'raw-images' AND auth.uid() = owner);

-- Allow users to update their own raw images
CREATE POLICY "Users can update their own raw images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

-- Allow users to delete their own raw images
CREATE POLICY "Users can delete their own raw images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

-- Allow users to view ONLY their own raw images
CREATE POLICY "Users can view only their own raw images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);