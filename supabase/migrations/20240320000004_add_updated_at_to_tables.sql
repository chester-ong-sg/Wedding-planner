-- Add updated_at column to tables table
ALTER TABLE tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows to have updated_at set to created_at
UPDATE tables SET updated_at = created_at WHERE updated_at IS NULL; 