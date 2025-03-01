-- Create videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  size BIGINT,
  type TEXT,
  thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for videos table
-- Only allow users to see their own videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own videos" 
  ON videos FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos" 
  ON videos FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" 
  ON videos FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" 
  ON videos FOR DELETE 
  USING (auth.uid() = user_id);

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);

-- Set up RLS policies for storage
CREATE POLICY "Users can upload their own videos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own videos" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own videos" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

