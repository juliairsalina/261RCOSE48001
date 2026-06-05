variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team ID (leave empty for personal account)"
  type        = string
  default     = ""
}

variable "supabase_access_token" {
  description = "Supabase personal access token"
  type        = string
  sensitive   = true
}

variable "supabase_org_id" {
  description = "Supabase organisation ID"
  type        = string
}

variable "supabase_db_password" {
  description = "Supabase Postgres database password"
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub personal access token (repo + secrets scope)"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key used by the backend"
  type        = string
  sensitive   = true
}

variable "jsearch_api_key" {
  description = "JSearch (RapidAPI) key for job search"
  type        = string
  sensitive   = true
  default     = ""
}

variable "langchain_api_key" {
  description = "LangSmith API key for agent tracing"
  type        = string
  sensitive   = true
  default     = ""
}

variable "render_api_key" {
  description = "Render API key (used for GitHub secret only — Render has no Terraform provider)"
  type        = string
  sensitive   = true
  default     = ""
}
