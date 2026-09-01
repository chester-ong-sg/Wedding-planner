-- Free-floating text annotations on the seating planner canvas.
CREATE TABLE IF NOT EXISTS text_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  x real NOT NULL,
  y real NOT NULL,
  text text NOT NULL DEFAULT '',
  font_size real NOT NULL DEFAULT 16,
  color text NOT NULL DEFAULT '#374151',
  width real NOT NULL DEFAULT 220,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS text_notes_user_id_idx ON text_notes (user_id);

ALTER TABLE text_notes ENABLE ROW LEVEL SECURITY;

-- Mirrors the policies on `tables` / `guests` in 20240320000003_add_rls_policies.sql
CREATE POLICY "Allow public read access to text_notes"
ON text_notes FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to insert text_notes"
ON text_notes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update their own text_notes"
ON text_notes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own text_notes"
ON text_notes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
