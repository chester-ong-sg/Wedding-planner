-- Add email and dietary_restrictions columns to guests table
ALTER TABLE guests
ADD COLUMN email TEXT,
ADD COLUMN dietary_restrictions TEXT; 