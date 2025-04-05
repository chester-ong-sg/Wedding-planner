-- Add contact column to guests table
ALTER TABLE guests
ADD COLUMN contact TEXT;

-- Update existing records to have a default value
UPDATE guests
SET contact = ''
WHERE contact IS NULL; 