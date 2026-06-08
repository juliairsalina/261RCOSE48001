"use client";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <main
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
      className="relative min-h-screen bg-[radial-gradient(circle_at_15%_8%,rgba(144,171,188,0.95)_0%,rgba(95,126,137,0.72)_22%,transparent_42%),radial-gradient(circle_at_72%_22%,rgba(184,190,137,0.72)_0%,rgba(118,137,92,0.58)_30%,transparent_56%),radial-gradient(circle_at_35%_88%,rgba(38,82,61,0.95)_0%,rgba(43,74,55,0.88)_35%,transparent_62%),linear-gradient(135deg,#425f6f_0%,#536f66_28%,#69794e_55%,#263f33_100%)] text-white"
    >
      <div className="mx-auto max-w-3xl px-6 py-16">
        <button
          onClick={() => router.back()}
          className="mb-8 rounded-full border border-white/25 bg-white/15 px-5 py-2 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/25"
        >
          ← Back
        </button>

        <h1 className="text-4xl font-black text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-white/55">Last updated: June 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-white/80">
          <section>
            <h2 className="text-lg font-black text-white">1. Information We Collect</h2>
            <p className="mt-2">We collect the resume files you upload, your email address for authentication, and usage data necessary to operate the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">2. How We Use Your Information</h2>
            <p className="mt-2">Your data is used solely to provide resume analysis, ATS scoring, rewrite suggestions, and cover letter generation. We do not sell your personal data to third parties.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">3. Data Storage</h2>
            <p className="mt-2">Resume data is stored securely using Supabase. Authentication is handled via Supabase Auth. We apply industry-standard security measures to protect your data.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">4. Third-Party Services</h2>
            <p className="mt-2">We use OpenAI APIs to process resume content for AI analysis. Data sent to OpenAI is governed by their privacy policy. We do not store your data on OpenAI's servers.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">5. Data Deletion</h2>
            <p className="mt-2">You may request deletion of your account and associated data at any time by contacting us through the Contact Us page.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">6. Contact</h2>
            <p className="mt-2">For privacy-related questions, please visit the Contact Us page.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
