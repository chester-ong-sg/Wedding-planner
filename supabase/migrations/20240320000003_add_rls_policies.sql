-- Enable Row Level Security
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- Create policies for tables
CREATE POLICY "Allow public read access to tables"
ON tables FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to insert tables"
ON tables FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update their own tables"
ON tables FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own tables"
ON tables FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create policies for guests
CREATE POLICY "Allow public read access to guests"
ON guests FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to insert guests"
ON guests FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update their own guests"
ON guests FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own guests"
ON guests FOR DELETE
TO authenticated
USING (auth.uid() = user_id); 