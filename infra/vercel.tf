# ---------------------------------------------------------------------------
# Vercel — Next.js 16 frontend (App Router, React 19)
# ---------------------------------------------------------------------------

resource "vercel_project" "frontend" {
  name      = "reeracify"
  framework = "nextjs"

  git_repository = {
    type              = "github"
    repo              = "juliairsalina/reeracify"
    production_branch = "main"
  }

  root_directory = "frontend"

  # Vercel build settings
  build_command    = "npm run build"
  output_directory = ".next"
  install_command  = "npm install"

  # Environment: node version matches CI
  node_version = "20.x"
}

# ---------------------------------------------------------------------------
# Environment variables injected at build + runtime
# ---------------------------------------------------------------------------

resource "vercel_project_environment_variable" "api_base_url" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_API_BASE_URL"
  value      = "https://reeracify-backend.onrender.com"
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "supabase_url" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_SUPABASE_URL"
  value      = supabase_project.reeracify.api_url
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "supabase_anon_key" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  value      = supabase_project.reeracify.anon_key
  target     = ["production", "preview"]
  sensitive  = true
}

# ---------------------------------------------------------------------------
# Custom domain
# ---------------------------------------------------------------------------

resource "vercel_project_domain" "main" {
  project_id = vercel_project.frontend.id
  domain     = "reeracify.vercel.app"
}
