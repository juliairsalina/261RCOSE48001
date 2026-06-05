# ---------------------------------------------------------------------------
# Supabase — managed Postgres + pgvector + Storage
# ---------------------------------------------------------------------------

resource "supabase_project" "reeracify" {
  name             = "reeracify"
  organization_id  = var.supabase_org_id
  database_password = var.supabase_db_password
  region           = "ap-southeast-1" # Singapore — closest to target markets (KR, MY, SG)

  lifecycle {
    # Prevent accidental destruction of the production database
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Storage bucket — resume uploads and exported DOCX files
# ---------------------------------------------------------------------------

resource "supabase_storage_bucket" "resumes" {
  project_ref = supabase_project.reeracify.id
  name        = "resumes"
  public      = true   # public URLs used for resume file access

  allowed_mime_types = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ]

  file_size_limit = 10485760 # 10 MB
}

# ---------------------------------------------------------------------------
# Database schema — applied via SQL migrations
#
# NOTE: Supabase Terraform provider manages project-level resources.
# Table schema, RLS policies, and the pgvector extension are managed
# through Supabase migrations (supabase/migrations/) or the dashboard.
#
# Schema summary:
#   users                  — basic user rows (id, email)
#   resumes                — raw_text, parsed_json, file_url, parse_status
#   resume_chunks          — text + embedding vector(1536) for pgvector RAG
#   candidate_profiles     — target_roles, core_skills, seniority_level
#   applications           — links resume ↔ job_post, tracks pipeline status
#   job_posts              — company, role, job_description, extracted_requirements
#   ats_evaluations        — score 0-100, rank, matched/missing skills
#   rewrite_suggestions    — original_text, suggested_text, reason, status
#   cover_letters          — generated cover letter text per application
#   retrieved_contexts     — top-N pgvector chunks per application run
#   agent_runs             — audit log: input_json, output_json, status, error
# ---------------------------------------------------------------------------
