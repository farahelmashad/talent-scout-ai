-- Create job postings table
CREATE TABLE public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title TEXT NOT NULL,
  career_level TEXT NOT NULL,
  location TEXT NOT NULL,
  department TEXT NOT NULL,
  key_skills TEXT[],
  natural_posting TEXT NOT NULL,
  structured_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
ON public.job_postings
FOR SELECT
TO public
USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert"
ON public.job_postings
FOR INSERT
TO authenticated
WITH CHECK (true);