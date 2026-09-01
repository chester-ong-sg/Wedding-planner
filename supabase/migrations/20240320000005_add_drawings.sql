-- Freehand pencil strokes drawn on the seating planner canvas.
-- `points` is a flat JSON array of [x, y, pressure] triples in canvas coordinates.
CREATE TABLE IF NOT EXISTS drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points jsonb NOT NULL,
  color text NOT NULL DEFAULT '#374151',
  width real NOT NULL DEFAULT 4,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawings_user_id_idx ON drawings (user_id);

ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

-- Mirrors the policies on `tables` / `guests` in 20240320000003_add_rls_policies.sql
CREATE POLICY "Allow public read access to drawings"
ON drawings FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to insert drawings"
ON drawings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update their own drawings"
ON drawings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own drawings"
ON drawings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
