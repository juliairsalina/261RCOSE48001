# ---------------------------------------------------------------------------
# GitHub — repository secrets for CI/CD
#
# NOTE: Render (backend hosting) has no official Terraform provider.
# Backend deploys are triggered automatically by Render watching
# the julia/backend-new branch. Secrets below cover CI + future use.
# ---------------------------------------------------------------------------

resource "github_actions_secret" "openai_api_key" {
  repository      = "reeracify"
  secret_name     = "OPENAI_API_KEY"
  plaintext_value = var.openai_api_key
}

resource "github_actions_secret" "supabase_url" {
  repository      = "reeracify"
  secret_name     = "SUPABASE_URL"
  plaintext_value = supabase_project.reeracify.api_url
}

resource "github_actions_secret" "supabase_service_role_key" {
  repository      = "reeracify"
  secret_name     = "SUPABASE_SERVICE_ROLE_KEY"
  plaintext_value = supabase_project.reeracify.service_role_key
}

resource "github_actions_secret" "supabase_anon_key" {
  repository      = "reeracify"
  secret_name     = "SUPABASE_ANON_KEY"
  plaintext_value = supabase_project.reeracify.anon_key
}

resource "github_actions_secret" "jsearch_api_key" {
  repository      = "reeracify"
  secret_name     = "JSEARCH_API_KEY"
  plaintext_value = var.jsearch_api_key
}

resource "github_actions_secret" "langchain_api_key" {
  repository      = "reeracify"
  secret_name     = "LANGCHAIN_API_KEY"
  plaintext_value = var.langchain_api_key
}
