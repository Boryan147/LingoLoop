-- Create vocabulary table
CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expression TEXT NOT NULL,
  definition TEXT NOT NULL,
  examples TEXT[] NOT NULL DEFAULT '{}',
  scenario TEXT NOT NULL,
  createdAt BIGINT NOT NULL,
  
  -- SRS Properties
  nextReviewDate BIGINT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 0,
  repetition INTEGER NOT NULL DEFAULT 0,
  easeFactor DOUBLE PRECISION NOT NULL DEFAULT 2.5
);

-- Set up Row Level Security (RLS)
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own items
CREATE POLICY "Users can view their own vocabulary" 
ON vocabulary FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can only insert their own items
CREATE POLICY "Users can insert their own vocabulary" 
ON vocabulary FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own items
CREATE POLICY "Users can update their own vocabulary" 
ON vocabulary FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own items
CREATE POLICY "Users can delete their own vocabulary" 
ON vocabulary FOR DELETE 
USING (auth.uid() = user_id);
