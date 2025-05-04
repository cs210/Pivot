-- Enable the necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table and insert first organization
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    domain_restriction TEXT, -- e.g. 'stanford.edu' for Stanford
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Stanford as the first organization
INSERT INTO organizations (name, description, domain_restriction) 
VALUES ('Stanford University', 'Stanford University Housing Projects', 'stanford.edu');

-- Projects Table with final structure
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_project_name_per_user UNIQUE (name, user_id)
);

-- Folders Table
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_folder_name_per_project_and_parent UNIQUE (name, project_id, parent_id)
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
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Raw Images Table
CREATE TABLE raw_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    metadata JSONB,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    panorama_id UUID REFERENCES panoramas(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Grid Configuration Table
CREATE TABLE grids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rows INTEGER NOT NULL DEFAULT 2,
    cols INTEGER NOT NULL DEFAULT 2,
    is_default BOOLEAN DEFAULT TRUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_grid_name_per_project UNIQUE (name, project_id)
);

-- Grid Nodes Table
CREATE TABLE grid_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grid_id UUID NOT NULL REFERENCES grids(id) ON DELETE CASCADE,
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
    CONSTRAINT unique_grid_position UNIQUE (grid_id, grid_x, grid_y)
);

-- Create function for updating timestamps automatically
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

CREATE TRIGGER update_grids_updated_at
BEFORE UPDATE ON grids
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION enforce_image_user_matches_project_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure raw_images.user_id = projects.user_id
  IF NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id
    AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'raw_images.user_id must match the user_id of its associated project';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_user_id_matches_project
BEFORE INSERT OR UPDATE ON raw_images
FOR EACH ROW
EXECUTE FUNCTION enforce_image_user_matches_project_user();

CREATE OR REPLACE FUNCTION enforce_panorama_user_matches_project_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure panoramas.user_id = projects.user_id
  IF NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id
    AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'panoramas.user_id must match the user_id of its associated project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_panorama_user_matches_project
BEFORE INSERT OR UPDATE ON panoramas
FOR EACH ROW
EXECUTE FUNCTION enforce_panorama_user_matches_project_user();

CREATE OR REPLACE FUNCTION enforce_grid_user_matches_project_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure grids.user_id = projects.user_id
  IF NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id
    AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'grids.user_id must match the user_id of its associated project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_grid_user_matches_project
BEFORE INSERT OR UPDATE ON grids
FOR EACH ROW
EXECUTE FUNCTION enforce_grid_user_matches_project_user();

CREATE OR REPLACE FUNCTION enforce_grid_node_project_matches_grid()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure the grid node's project_id matches the grid's project_id
  IF NOT EXISTS (
    SELECT 1 FROM grids
    WHERE id = NEW.grid_id AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'grid_nodes.project_id must match the project_id of the associated grid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_grid_node_project_id_matches_grid
BEFORE INSERT OR UPDATE ON grid_nodes
FOR EACH ROW
EXECUTE FUNCTION enforce_grid_node_project_matches_grid();

-- Create indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_metadata ON projects USING GIN (metadata);
CREATE INDEX idx_projects_is_public ON projects(is_public);
CREATE INDEX idx_folders_project_id ON folders(project_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_raw_images_project_id ON raw_images(project_id);
CREATE INDEX idx_raw_images_folder_id ON raw_images(folder_id);
CREATE INDEX idx_raw_images_panorama_id ON raw_images(panorama_id);
CREATE INDEX idx_raw_images_user_id ON raw_images(user_id);
CREATE INDEX idx_panoramas_project_id ON panoramas(project_id);
CREATE INDEX idx_panoramas_user_id ON panoramas(user_id);
CREATE INDEX idx_grids_project_id ON grids(project_id);
CREATE INDEX idx_grids_user_id ON grids(user_id);
CREATE INDEX idx_grids_is_default ON grids(is_default);
CREATE INDEX idx_grid_nodes_project_id ON grid_nodes(project_id);
CREATE INDEX idx_grid_nodes_panorama_id ON grid_nodes(panorama_id);
CREATE INDEX idx_grid_nodes_coordinates ON grid_nodes(grid_x, grid_y);
CREATE INDEX idx_grid_nodes_grid_id ON grid_nodes(grid_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE panoramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE grids ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_nodes ENABLE ROW LEVEL SECURITY;

-- Organizations RLS Policies
CREATE POLICY "Organizations Select: Anyone can see public organizations"
ON organizations
FOR SELECT
USING (domain_restriction IS NULL);

CREATE POLICY "Organizations Select: Users can see their own organizations (domain restricted)"
ON organizations
FOR SELECT
USING (
    domain_restriction IS NOT NULL AND
    auth.email() LIKE '%@' || domain_restriction
);

-- Projects RLS Policies
CREATE POLICY "Projects Select: Users can see their own projects"
ON projects
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Projects Select: Anyone can see public projects"
ON projects
FOR SELECT
USING (is_public = TRUE);

CREATE POLICY "Projects Select: Users can see projects in their organizations"
ON projects
FOR SELECT
USING (
    organization_id IS NOT NULL AND
    EXISTS (
        SELECT 1 FROM organizations 
        WHERE id = projects.organization_id 
        AND domain_restriction IS NOT NULL
        AND auth.email() LIKE '%@' || domain_restriction
    )
);

CREATE POLICY "Projects Update: Users can update their own projects"
ON projects
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Projects Insert: All authenticated users can create projects"
ON projects
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Projects Delete: Users can delete their own projects"
ON projects
FOR DELETE
USING (auth.uid() = user_id);

-- Folders RLS Policies
CREATE POLICY "Folders Select: Users can see folders in their own projects"
ON folders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Folders Insert: Users can create folders in their own projects"
ON folders FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Folders Update: Users can update folders in their own projects"
ON folders FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Folders Delete: Users can delete folders in their own projects"
ON folders FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Raw Images RLS Policies
CREATE POLICY "Raw Images Select: Users can see raw images in their own projects"
ON raw_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = raw_images.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Raw Images Insert: Only project owner can upload"
ON raw_images FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = raw_images.project_id
        AND projects.user_id = auth.uid()
    )
    AND raw_images.user_id = auth.uid()
);

CREATE POLICY "Raw Images Update: Users can update their own raw images"
ON raw_images FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = raw_images.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Raw Images Delete: Users can delete their own raw images"
ON raw_images FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = raw_images.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Panoramas RLS Policies
CREATE POLICY "Panoramas Select: Users can see their own panoramas"
ON panoramas FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = panoramas.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Panoramas Select: Anyone can see public panoramas"
ON panoramas FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = panoramas.project_id 
        AND projects.is_public = TRUE
    )
);

CREATE POLICY "Panoramas Select: Users can see panoramas in their organizations"
ON panoramas FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        JOIN organizations ON organizations.id = projects.organization_id
        WHERE projects.id = panoramas.project_id 
        AND organizations.domain_restriction IS NOT NULL
        AND auth.email() LIKE '%@' || organizations.domain_restriction
    )
);

CREATE POLICY "Panoramas Insert: Users can create panoramas in their own projects"
ON panoramas FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = panoramas.project_id
        AND projects.user_id = auth.uid()
    )
    AND auth.uid() = user_id  -- Ensure the authenticated user is set as the owner
);

CREATE POLICY "Panoramas Update: Users can update their own panoramas"
ON panoramas FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = panoramas.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Panoramas Delete: Users can delete their own panoramas"
ON panoramas FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = panoramas.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Grids RLS Policies
CREATE POLICY "Grids Select: Users can see their own grids"
ON grids FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grids.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Grids Select: Anyone can see public grids"
ON grids FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = grids.project_id 
        AND projects.is_public = TRUE
    )
);

CREATE POLICY "Grids Select: Users can see grids in their organizations"
ON grids FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        JOIN organizations ON organizations.id = projects.organization_id
        WHERE projects.id = grids.project_id 
        AND organizations.domain_restriction IS NOT NULL
        AND auth.email() LIKE '%@' || organizations.domain_restriction
    )
);

CREATE POLICY "Grids Insert: Users can create grids in their own projects"
ON grids FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grids.project_id
        AND projects.user_id = auth.uid()
    )
    AND auth.uid() = user_id  -- Ensure the authenticated user is set as the owner
);

CREATE POLICY "Grids Update: Users can update their own grids"
ON grids FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grids.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Grids Delete: Users can delete their own grids"
ON grids FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grids.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Grid Nodes RLS Policies
CREATE POLICY "Grid Nodes Select: Users can see their own grid nodes"
ON grid_nodes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grid_nodes.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Grid Nodes Select: Anyone can see grid nodes in public projects"
ON grid_nodes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grid_nodes.project_id
        AND projects.is_public = TRUE
    )
);

CREATE POLICY "Grid Nodes Select: Users can see grid nodes in their organizations"
ON grid_nodes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        JOIN organizations ON organizations.id = projects.organization_id
        WHERE projects.id = grid_nodes.project_id
        AND organizations.domain_restriction IS NOT NULL
        AND auth.email() LIKE '%@' || organizations.domain_restriction
    )
);

CREATE POLICY "Grid Nodes Insert: Users can create grid nodes in their own projects"
ON grid_nodes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM grids
        WHERE grids.id = grid_nodes.grid_id
        AND grids.user_id = auth.uid()
    )
);

CREATE POLICY "Grid Nodes Update: Users can update their own grid nodes"
ON grid_nodes FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM grids
        WHERE grids.id = grid_nodes.grid_id
        AND grids.user_id = auth.uid()
    )
);

CREATE POLICY "Grid Nodes Delete: Users can delete their own grid nodes"
ON grid_nodes FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM grids
        WHERE grids.id = grid_nodes.grid_id
        AND grids.user_id = auth.uid()
    )
);

-- Storage Bucket Policies for 'panoramas-private' bucket
CREATE POLICY "Panoramas Private Storage Insert: Authenticated users can upload panoramas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'panoramas-private' AND auth.uid() = owner);

CREATE POLICY "Panoramas Private Storage Update: Users can update their own panoramas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'panoramas-private' AND auth.uid() = owner);

CREATE POLICY "Panoramas Private Storage Delete: Users can delete their own panoramas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'panoramas-private' AND auth.uid() = owner);

CREATE POLICY "Panoramas Private Storage Select: Users can view their own panos or panos in their org"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'panoramas-private'
    AND (
        -- User owns the file
        auth.uid() = owner
        -- OR user belongs to the same organization as the project
        OR EXISTS (
            SELECT 1 FROM panoramas
            JOIN projects ON projects.id = panoramas.project_id
            JOIN organizations ON organizations.id = projects.organization_id
            WHERE panoramas.storage_path = storage.objects.name
            AND organizations.domain_restriction IS NOT NULL
            AND auth.email() LIKE '%@' || organizations.domain_restriction
        )
    )
);

-- Storage Bucket Policies for 'panoramas-public' bucket
CREATE POLICY "Panoramas Public Storage Insert: Authenticated users can upload panoramas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'panoramas-public' AND auth.uid() = owner);

CREATE POLICY "Panoramas Public Storage Update: Users can update their own panoramas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'panoramas-public' AND auth.uid() = owner);

CREATE POLICY "Panoramas Public Storage Delete: Users can delete their own panoramas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'panoramas-public' AND auth.uid() = owner);

CREATE POLICY "Panoramas Public Storage Select: Users can view public panos"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (
    bucket_id = 'panoramas-public'
    AND (
        EXISTS (
            SELECT 1 FROM panoramas
            JOIN projects ON projects.id = panoramas.project_id
            WHERE panoramas.storage_path = storage.objects.name
            AND projects.is_public = TRUE
        )
    )
);

-- Storage Bucket Policies for 'raw-images' bucket
CREATE POLICY "Raw Images Storage Insert: Users can upload raw images as themselves"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'raw-images' AND auth.uid() = owner);

CREATE POLICY "Raw Images Storage Update: Users can update their own raw images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

CREATE POLICY "Raw Images Storage Delete: Users can delete their own raw images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

CREATE POLICY "Raw Images Storage Select: Users can access their own images"
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

-- Storage Bucket Policies for 'thumbnails-private' bucket
CREATE POLICY "Thumbnails Private Storage Insert: Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails-private' AND auth.uid() = owner);

CREATE POLICY "Thumbnails Private Storage Update: Users can update their own thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails-private' AND auth.uid() = owner);

CREATE POLICY "Thumbnails Private Storage Delete: Users can delete their own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'thumbnails-private' AND auth.uid() = owner);

CREATE POLICY "Thumbnails Private Storage Select: Users can view their own thumbnails or panorama thumbnails in their org"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'thumbnails-private'
    AND (
        -- User owns the file
        auth.uid() = owner
        -- OR user belongs to the same organization as the project and it's a panorama thumbnail
        OR EXISTS (
            SELECT 1 FROM panoramas
            JOIN projects ON projects.id = panoramas.project_id
            JOIN organizations ON organizations.id = projects.organization_id
            WHERE panoramas.storage_path = storage.objects.name
            AND organizations.domain_restriction IS NOT NULL
            AND auth.email() LIKE '%@' || organizations.domain_restriction
        )
    )
);

-- Storage Bucket Policies for 'thumbnails-public' bucket
CREATE POLICY "Thumbnails Public Storage Insert: Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails-public' AND auth.uid() = owner);

CREATE POLICY "Thumbnails Public Storage Update: Users can update their own thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails-public' AND auth.uid() = owner);

CREATE POLICY "Thumbnails Public Storage Delete: Users can delete their own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'thumbnails-public' AND auth.uid() = owner);

CREATE POLICY "Thumbnails Public Storage Select: Users can view thumbnails for public panos"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (
    bucket_id = 'thumbnails-public'
    AND (
        EXISTS (
            SELECT 1 FROM panoramas
            JOIN projects ON projects.id = panoramas.project_id
            WHERE panoramas.storage_path = storage.objects.name
            AND projects.is_public = TRUE
        )
    )
);