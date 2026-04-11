-- Create vocabulary table
CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expression TEXT NOT NULL,
  definition TEXT NOT NULL,
  part_of_speech TEXT,
  phonetic TEXT,
  verb_forms TEXT,
  examples TEXT[] NOT NULL DEFAULT '{}',
  scenario TEXT NOT NULL,
  synonyms JSONB,
  collocations JSONB,
  created_at BIGINT NOT NULL,
  
  -- SRS Properties
  next_review_date BIGINT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 0,
  repetition INTEGER NOT NULL DEFAULT 0,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5
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

-- Create scenarios table
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Set up RLS for scenarios
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scenarios" 
ON scenarios FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenarios" 
ON scenarios FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios" 
ON scenarios FOR DELETE 
USING (auth.uid() = user_id);

-- Create scenario_vocabulary table
CREATE TABLE scenario_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expression TEXT NOT NULL,
  definition TEXT NOT NULL,
  part_of_speech TEXT,
  phonetic TEXT,
  verb_forms TEXT,
  examples TEXT[] NOT NULL DEFAULT '{}',
  synonyms JSONB,
  collocations JSONB,
  created_at BIGINT NOT NULL,
  
  -- SRS Properties
  next_review_date BIGINT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 0,
  repetition INTEGER NOT NULL DEFAULT 0,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5
);

-- Set up RLS for scenario_vocabulary
ALTER TABLE scenario_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scenario_vocabulary" 
ON scenario_vocabulary FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenario_vocabulary" 
ON scenario_vocabulary FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenario_vocabulary" 
ON scenario_vocabulary FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenario_vocabulary" 
ON scenario_vocabulary FOR DELETE 
USING (auth.uid() = user_id);
