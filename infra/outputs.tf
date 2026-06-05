output "frontend_url" {
  description = "Live Vercel deployment URL"
  value       = "https://${vercel_project_domain.main.domain}"
}

output "backend_url" {
  description = "Render backend URL (managed outside Terraform)"
  value       = "https://reeracify-backend.onrender.com"
}

output "supabase_api_url" {
  description = "Supabase project API URL"
  value       = supabase_project.reeracify.api_url
}

output "supabase_dashboard_url" {
  description = "Supabase dashboard link"
  value       = "https://supabase.com/dashboard/project/${supabase_project.reeracify.id}"
}

output "storage_bucket" {
  description = "Supabase Storage bucket for resume files"
  value       = supabase_storage_bucket.resumes.name
}
