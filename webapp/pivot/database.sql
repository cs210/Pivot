-- Add a trigger to also handle when an organization's domain_restriction changes
CREATE OR REPLACE FUNCTION handle_organization_domain_change()
RETURNS TRIGGER AS $
BEGIN
    -- If domain_restriction was changed to NULL (organization became public)
    IF OLD.domain_restriction IS NOT NULL AND NEW.domain_restriction IS NULL THEN
        -- Update all projects in this organization to be public
        UPDATE projects SET is_public = TRUE 
        WHERE organization_id = NEW.id AND is_public = FALSE;
    END IF;
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER organization_domain_change_trigger
AFTER UPDATE OF domain_restriction ON organizations
FOR EACH ROW
WHEN (OLD.domain_restriction IS DISTINCT FROM NEW.domain_restriction)
EXECUTE FUNCTION handle_organization_domain_change();-- Enable the necessary extensions
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

-- Trigger to enforce that projects in public organizations are public
CREATE TRIGGER enforce_project_public_status
BEFORE INSERT OR UPDATE OF organization_id ON projects
FOR EACH ROW
EXECUTE FUNCTION enforce_organization_public_status();

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
CREATE POLICY "organizations_select_policy" ON organizations
    FOR SELECT
    USING (
        -- Public organizations are visible to everyone
        (domain_restriction IS NULL) OR
        -- Or the user's email matches the organization's domain
        (
            domain_restriction IS NOT NULL AND
            auth.email() LIKE '%@' || domain_restriction
        )
    );

-- Projects RLS Policies
CREATE POLICY "projects_select_policy" ON projects
    FOR SELECT
    USING (
        -- User owns the project
        user_id = auth.uid() OR
        -- Project is public (regardless of organization)
        is_public = TRUE OR
        -- User's email matches the organization's domain restriction
        (
            organization_id IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM organizations 
                WHERE id = projects.organization_id 
                AND domain_restriction IS NOT NULL
                AND auth.email() LIKE '%@' || domain_restriction
            )
        )
    );

CREATE POLICY "projects_update_policy" ON projects
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "projects_insert_policy" ON projects
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_delete_policy" ON projects
    FOR DELETE
    USING (auth.uid() = user_id);

-- Folders RLS Policies
CREATE POLICY "folders_select_policy"
ON folders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND (projects.user_id = auth.uid() OR projects.is_public = TRUE)
    )
);

CREATE POLICY "folders_insert_policy"
ON folders FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "folders_update_policy"
ON folders FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "folders_delete_policy"
ON folders FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = folders.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Raw Images RLS Policies
CREATE POLICY "raw_images_select_policy"
ON raw_images FOR SELECT
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = raw_images.project_id
        AND projects.is_public = TRUE
    )
);

CREATE POLICY "raw_images_insert_policy"
ON raw_images FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "raw_images_update_policy"
ON raw_images FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "raw_images_delete_policy"
ON raw_images FOR DELETE
USING (auth.uid() = user_id);

-- Panoramas RLS Policies
CREATE POLICY "panoramas_select_policy"
ON panoramas FOR SELECT
USING (
    -- User owns the panorama
    auth.uid() = user_id 
    -- OR the panorama belongs to a public project
    OR EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = panoramas.project_id 
        AND projects.is_public = TRUE
    )
    -- OR the user belongs to the same organization as the project
    OR EXISTS (
        SELECT 1 FROM projects
        JOIN organizations ON organizations.id = projects.organization_id
        WHERE projects.id = panoramas.project_id 
        AND organizations.domain_restriction IS NOT NULL
        AND auth.email() LIKE '%@' || organizations.domain_restriction
    )
);

CREATE POLICY "panoramas_insert_policy"
ON panoramas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "panoramas_update_policy"
ON panoramas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "panoramas_delete_policy"
ON panoramas FOR DELETE
USING (auth.uid() = user_id);

-- Grids RLS Policies
CREATE POLICY "grids_select_policy"
ON grids FOR SELECT
USING (
  -- User owns the grid
  auth.uid() = user_id
  -- OR the grid belongs to a public project
  OR EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = grids.project_id 
    AND projects.is_public = TRUE
  )
  -- OR the user belongs to the same organization as the project
  OR EXISTS (
    SELECT 1 FROM projects
    JOIN organizations ON organizations.id = projects.organization_id
    WHERE projects.id = grids.project_id 
    AND organizations.domain_restriction IS NOT NULL
    AND auth.email() LIKE '%@' || organizations.domain_restriction
  )
);

CREATE POLICY "grids_insert_policy" 
ON grids FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "grids_update_policy"
ON grids FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "grids_delete_policy"
ON grids FOR DELETE
USING (auth.uid() = user_id);

-- Grid Nodes RLS Policies
CREATE POLICY "grid_nodes_select_policy"
ON grid_nodes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = grid_nodes.project_id
        AND (
            -- User owns the project
            projects.user_id = auth.uid() 
            -- OR the project is public
            OR projects.is_public = TRUE
            -- OR the user belongs to the same organization as the project
            OR EXISTS (
                SELECT 1 FROM organizations
                WHERE organizations.id = projects.organization_id
                AND organizations.domain_restriction IS NOT NULL
                AND auth.email() LIKE '%@' || organizations.domain_restriction
            )
        )
    )
);

CREATE POLICY "grid_nodes_insert_policy"
ON grid_nodes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM grids
        WHERE grids.id = grid_nodes.grid_id
        AND grids.user_id = auth.uid()
    )
);

CREATE POLICY "grid_nodes_update_policy"
ON grid_nodes FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM grids
        WHERE grids.id = grid_nodes.grid_id
        AND grids.user_id = auth.uid()
    )
);

CREATE POLICY "grid_nodes_delete_policy"
ON grid_nodes FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM grids
        WHERE grids.id = grid_nodes.grid_id
        AND grids.user_id = auth.uid()
    )
);

-- Storage Bucket Policies for 'panoramas' bucket
CREATE POLICY "panoramas_storage_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'panoramas' AND auth.uid() = owner);

CREATE POLICY "panoramas_storage_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'panoramas' AND auth.uid() = owner);

CREATE POLICY "panoramas_storage_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'panoramas' AND auth.uid() = owner);

-- Combined policy for viewing panoramas - either as owner, from public projects, or same organization
CREATE POLICY "panoramas_storage_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'panoramas'
  AND (
    -- User owns the file
    auth.uid() = owner
    -- OR file belongs to a panorama in a public project
    OR EXISTS (
      SELECT 1 FROM panoramas
      JOIN projects ON projects.id = panoramas.project_id
      WHERE panoramas.storage_path = storage.objects.name
      AND projects.is_public = TRUE
    )
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

-- Separate policy specifically for anonymous access to public panoramas
CREATE POLICY "panoramas_storage_select_anon_policy"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'panoramas'
  AND EXISTS (
    SELECT 1 FROM panoramas
    JOIN projects ON projects.id = panoramas.project_id
    WHERE panoramas.storage_path = storage.objects.name
    AND projects.is_public = TRUE
  )
);

-- Storage Bucket Policies for 'raw-images' bucket
CREATE POLICY "raw_images_storage_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'raw-images' AND auth.uid() = owner);

CREATE POLICY "raw_images_storage_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

CREATE POLICY "raw_images_storage_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

CREATE POLICY "raw_images_storage_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'raw-images' AND auth.uid() = owner);

-- Storage Bucket Policies for 'raw-thumbnails' bucket
CREATE POLICY "raw_thumbnails_storage_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'raw-thumbnails' AND auth.uid() = owner);

CREATE POLICY "raw_thumbnails_storage_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'raw-thumbnails' AND auth.uid() = owner);

CREATE POLICY "raw_thumbnails_storage_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'raw-thumbnails' AND auth.uid() = owner);

CREATE POLICY "raw_thumbnails_storage_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'raw-thumbnails' AND auth.uid() = owner);

-- Storage Bucket Policies for 'panorama-thumbnails' bucket
CREATE POLICY "panorama_thumbnails_storage_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'panorama-thumbnails' AND auth.uid() = owner);

CREATE POLICY "panorama_thumbnails_storage_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'panorama-thumbnails' AND auth.uid() = owner);

CREATE POLICY "panorama_thumbnails_storage_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'panorama-thumbnails' AND auth.uid() = owner);

CREATE POLICY "panorama_thumbnails_storage_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'panorama-thumbnails'
  AND (
    -- User owns the file
    auth.uid() = owner
    -- OR file belongs to a panorama in a public project
    OR EXISTS (
      SELECT 1 FROM panoramas
      JOIN projects ON projects.id = panoramas.project_id
      WHERE 
        -- Match thumbnails to panoramas (with a naming convention like 'thumb_' + panorama_storage_path)
        storage.objects.name LIKE 'thumb_%' AND
        SUBSTRING(storage.objects.name FROM 7) = panoramas.storage_path AND
        projects.is_public = TRUE
    )
    -- OR user belongs to the same organization as the project
    OR EXISTS (
      SELECT 1 FROM panoramas
      JOIN projects ON projects.id = panoramas.project_id
      JOIN organizations ON organizations.id = projects.organization_id
      WHERE 
        -- Match thumbnails to panoramas (with a naming convention like 'thumb_' + panorama_storage_path)
        storage.objects.name LIKE 'thumb_%' AND
        SUBSTRING(storage.objects.name FROM 7) = panoramas.storage_path AND
        organizations.domain_restriction IS NOT NULL AND
        auth.email() LIKE '%@' || organizations.domain_restriction
    )
  )
);

CREATE POLICY "panorama_thumbnails_storage_select_anon_policy"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'panorama-thumbnails'
  AND EXISTS (
    SELECT 1 FROM panoramas
    JOIN projects ON projects.id = panoramas.project_id
    WHERE 
      -- Match thumbnails to panoramas (with a naming convention like 'thumb_' + panorama_storage_path)
      storage.objects.name LIKE 'thumb_%' AND
      SUBSTRING(storage.objects.name FROM 7) = panoramas.storage_path AND
      projects.is_public = TRUE
  )
);