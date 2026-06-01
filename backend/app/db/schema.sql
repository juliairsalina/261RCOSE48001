-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- users
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- resumes
CREATE TABLE resumes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    file_url text,
    file_name text,
    file_type text,
    raw_text text,
    parsed_json jsonb,
    created_at timestamptz DEFAULT now()
);

-- resume_chunks (pgvector)
CREATE TABLE resume_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    chunk_text text NOT NULL,
    section text,
    embedding vector(1536),
    created_at timestamptz DEFAULT now()
);

-- candidate_profiles
CREATE TABLE candidate_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,
    profile_json jsonb,
    search_queries jsonb,
    created_at timestamptz DEFAULT now()
);

-- job_posts
CREATE TABLE job_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    source text,
    job_url text,
    company_name text,
    role_title text,
    location text,
    job_description text,
    extracted_requirements jsonb,
    company_background jsonb,
    created_at timestamptz DEFAULT now()
);

-- job_recommendations
CREATE TABLE job_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,
    job_post_id uuid REFERENCES job_posts(id) ON DELETE CASCADE,
    match_score int,
    confidence_label text CHECK (confidence_label IN ('high', 'medium', 'low')),
    match_reasons jsonb,
    missing_requirements jsonb,
    created_at timestamptz DEFAULT now()
);

-- applications
CREATE TABLE applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,
    job_post_id uuid REFERENCES job_posts(id) ON DELETE CASCADE,
    status text DEFAULT 'created' CHECK (status IN (
        'created','resume_parsed','candidate_profile_created',
        'jobs_discovered','job_selected','job_analyzed',
        'rag_completed','evaluated','rewrite_pending',
        'rewrite_approved','resume_exported','cover_letter_generated','completed'
    )),
    created_at timestamptz DEFAULT now()
);

-- retrieved_contexts
CREATE TABLE retrieved_contexts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
    resume_chunk_ids jsonb,
    retrieved_text jsonb,
    query text,
    created_at timestamptz DEFAULT now()
);

-- ats_evaluations
CREATE TABLE ats_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
    score int,
    rank text CHECK (rank IN ('상', '중', '하')),
    matched_skills jsonb,
    missing_skills jsonb,
    strengths jsonb,
    weaknesses jsonb,
    evidence jsonb,
    created_at timestamptz DEFAULT now()
);

-- rewrite_suggestions
CREATE TABLE rewrite_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
    section text,
    original_text text,
    suggested_text text,
    reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at timestamptz DEFAULT now()
);

-- cover_letters
CREATE TABLE cover_letters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
    content text,
    created_at timestamptz DEFAULT now()
);

-- agent_runs
CREATE TABLE agent_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
    agent_name text,
    input_json jsonb,
    output_json jsonb,
    status text DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- Index for vector similarity search
CREATE INDEX ON resume_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- Supabase RPC function for resume chunk similarity search
-- Run this in the Supabase SQL editor after running the schema:
-- ============================================================
CREATE OR REPLACE FUNCTION match_resume_chunks(
  query_embedding vector(1536),
  resume_id_filter uuid,
  match_count int
)
RETURNS TABLE (
  id uuid, chunk_text text, section text, similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT id, chunk_text, section,
         1 - (embedding <=> query_embedding) AS similarity
  FROM resume_chunks
  WHERE resume_id = resume_id_filter
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
