-- Add position columns to tables table
ALTER TABLE tables
ADD COLUMN position_x INTEGER NOT NULL DEFAULT 0,
ADD COLUMN position_y INTEGER NOT NULL DEFAULT 0; 