"use client";
import { useRouter } from "next/navigation";

export default function TermsPage() {
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

        <h1 className="text-4xl font-black text-white">Terms of Use</h1>
        <p className="mt-2 text-sm text-white/55">Last updated: June 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-white/80">
          <section>
            <h2 className="text-lg font-black text-white">1. Acceptance of Terms</h2>
            <p className="mt-2">By accessing or using Reeracify, you agree to be bound by these Terms of Use. If you do not agree, please do not use the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">2. Use of Service</h2>
            <p className="mt-2">Reeracify is an AI-powered resume optimization platform. You may use the service to upload, analyze, and improve your resume for personal, non-commercial job application purposes.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">3. User Data</h2>
            <p className="mt-2">You retain ownership of your resume content. By uploading your resume, you grant Reeracify a limited license to process and analyze it solely for the purpose of providing the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">4. Prohibited Conduct</h2>
            <p className="mt-2">You agree not to misuse the service, attempt to reverse-engineer the AI systems, or use the platform for any unlawful purpose.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">5. Disclaimer</h2>
            <p className="mt-2">Reeracify provides AI-generated suggestions for informational purposes only. We do not guarantee job placement or ATS success. Results may vary.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-white">6. Contact</h2>
            <p className="mt-2">Questions? Reach us at the Contact Us page.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
