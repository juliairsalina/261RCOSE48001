"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import {
  Upload,
  Link as LinkIcon,
  ArrowRight,
  X,
  UploadCloud,
  ScanSearch,
  Wand2,
  Download,
  UserCircle,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

export default function HomePage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");

  const [showProfile, setShowProfile] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [vacancyLink, setVacancyLink] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [parsedName, setParsedName] = useState("");
  const [parsedResumeData, setParsedResumeData] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

useEffect(() => {
  if (!supabase) {
    setShowLogin(true);
    setMounted(true);
    return;
  }

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
    setIsLoggedIn(!!user);
    if (!user) setShowLogin(true);
    setMounted(true);
  };

  checkUser();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
    setIsLoggedIn(!!session?.user);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

  if (!mounted) return null;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoginMessage("");

    if (authMode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginMessage(error.message);
        return;
      }

      setUser(data.user);
      setIsLoggedIn(true);
      setShowLogin(false);
      setEmail("");
      setPassword("");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoginMessage(error.message);
      return;
    }

    setLoginMessage("Account created! Please check your email to confirm your account.");
    setAuthMode("login");
    setPassword("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("reeracifyUserId");
    localStorage.removeItem("reeracifyResumeId");
    localStorage.removeItem("reeracifyApplicationId");
    localStorage.removeItem("reeracifyVacancyLink");
    localStorage.removeItem("reeracifyParsedResume");
    localStorage.removeItem("reeracifyCandidateProfile");
    setUser(null);
    setIsLoggedIn(false);
    setShowProfile(false);
    setResumeFile(null);
    setParsedName("");
    setParsedResumeData(null);
    setAuthMode("login");
    setLoginMessage("");
    setShowLogin(true);
  };

  const handleResumeUpload = async (e) => {
    if (!isLoggedIn) {
      e.target.value = "";
      setAuthMode("login");
      setLoginMessage("Please log in first before uploading your resume.");
      setShowLogin(true);
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setUploading(true);
    setUploadError("");
    setParsedName("");

    // Clear stale data from any previous resume session (preserve vacancyLink)
    localStorage.removeItem("reeracifyApplicationId");
    localStorage.removeItem("reeracifyParsedResume");
    localStorage.removeItem("reeracifyCandidateProfile");

    let userId = localStorage.getItem("reeracifyUserId");
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("reeracifyUserId", userId);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", userId);

      const res = await fetch(`${API_BASE_URL}/resumes/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }

      const data = await res.json();

      localStorage.setItem(
        "reeracifyResumeId",
        data.resume_id
      );

      localStorage.setItem(
        "reeracifyParsedResume",
        JSON.stringify(data.parsed_json)
      );

      const name = data.parsed_json?.name || "";
      setParsedName(name);
      console.log("BACKEND PARSED JSON:", data.parsed_json);
      setParsedResumeData(data.parsed_json || null);

      if (data.parse_status === "failed") {
        setUploadError("Parsed with limited data — AI parsing failed. Evaluation will use raw text.");
      } else if (!data.chunks_ok) {
        setUploadError("Uploaded, but embedding storage failed. Context retrieval may be limited.");
      } else {
        setShowReviewModal(true);
      }
    } catch (error) {
      console.error(error);
      setUploadError(error.message);
      setResumeFile(null);
    } finally {
      setUploading(false);
    }
  };


  const handleContinue = () => {
    if (!resumeFile) {
      alert("Please upload your resume first.");
      return;
    }
    if (parsedResumeData) {
      setShowReviewModal(true);
    } else {
      if (vacancyLink.trim()) {
        localStorage.setItem("reeracifyVacancyLink", vacancyLink.trim());
      }
      router.push("/edit-resume");
    }
  };

  const handleConfirmAndContinue = () => {
    if (vacancyLink.trim()) {
      localStorage.setItem("reeracifyVacancyLink", vacancyLink.trim());
    }
    setShowReviewModal(false);
    router.push("/edit-resume");
  };

  const handleContactUs = () => {
    router.push("/contact");
  };

  return (

    <main
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        }}
        className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_8%,rgba(144,171,188,0.95)_0%,rgba(95,126,137,0.72)_22%,transparent_42%),radial-gradient(circle_at_72%_22%,rgba(184,190,137,0.72)_0%,rgba(118,137,92,0.58)_30%,transparent_56%),radial-gradient(circle_at_35%_88%,rgba(38,82,61,0.95)_0%,rgba(43,74,55,0.88)_35%,transparent_62%),linear-gradient(135deg,#425f6f_0%,#536f66_28%,#69794e_55%,#263f33_100%)] text-white"
      >

      <div className="relative z-10 flex min-h-screen flex-col">

      {/* Top header */}
      <header className="relative z-10 flex w-full items-center justify-between px-3 pt-3 md:px-4 md:pt-4">
        {/* LinkedIn Button */}
        <button
          onClick={() => setShowLinkedIn(true)}
          className="rounded-full border border-white/25 bg-white/15 px-5 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
        >
          LinkedIn
        </button>

        {/* Right Buttons */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <button
              onClick={() => setShowProfile((p) => !p)}
              className="flex items-center gap-2 rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
            >
              <UserCircle size={18} />
              Profile
            </button>
          ) : (
            <button
              onClick={() => { setAuthMode("login"); setLoginMessage(""); setShowLogin(true); }}
              className="flex items-center gap-2 rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
            >
              <UserCircle size={18} />
              Sign In
            </button>
          )}

          <button
            onClick={handleContactUs}
            className="rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
          >
            Contact Us
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[90vh] flex-col items-center px-4 pb-8 pt-1 text-center md:px-8">
        {/* Logo image */}
        <div className="mt-1 flex justify-center">
          <Image
            src="/logo.svg"
            alt="Reeracify"
            width={900}
            height={270}
            priority
            className="h-auto w-[min(92vw,560px)] drop-shadow-2xl"
          />
        </div>

        <p className="text-[10px] text-white/90 sm:text-[10px] md:text-[15px]">
          Tailor resume to desired positions in seconds, powered by AI.
        </p>

        {/* Upload + link */}
        <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Upload Resume Box */}
          <label
            onClick={(e) => {
              if (!isLoggedIn) {
                e.preventDefault();
                setAuthMode("login");
                setLoginMessage("");
                setShowLogin(true);
              }
            }}
            className={`flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-full border px-5 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:scale-[1.01] ${
              parsedName
                ? "border-green-300/60 bg-[#243026]"
                : uploading
                ? "border-white/25 bg-[#243026] cursor-wait"
                : "border-white/25 bg-[#243026]"
            }`}>
            {uploading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
                <span>Parsing resume…</span>
              </>
            ) : parsedName ? (
              <>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                <span className="truncate">{parsedName} — parsed</span>
              </>
            ) : (
              <>
                <Upload size={18} />
                <span className="truncate">
                  {resumeFile ? resumeFile.name : "Upload your resume"}
                </span>
              </>
            )}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              disabled={uploading}
              onChange={handleResumeUpload}
            />
          </label>

          {/* Paste Vacancy Link Box */}
          <div className="flex h-11 w-full items-center gap-3 rounded-full bg-white/15 px-5 text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28">
            <LinkIcon size={18} className="shrink-0 text-white/85" />

            <input
              type="url"
              value={vacancyLink}
              onChange={(e) => setVacancyLink(e.target.value)}
              placeholder="Paste job vacancy URL"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/70"
            />

            <button
              onClick={() => {
                if (!isLoggedIn) { setAuthMode("login"); setLoginMessage(""); setShowLogin(true); return; }
                handleContinue();
              }}
              disabled={uploading || !resumeFile}
              className="flex h-9 w-11 shrink-0 items-center justify-center rounded-full bg-[#243026] text-white transition hover:scale-105 disabled:cursor-not-allowed"
            >
              <ArrowRight size={18} strokeWidth={2.8}/>
            </button>
          </div>

          </div>

        {/* Upload feedback */}
        <div className="mt-4 w-full max-w-2xl">
          {uploadError && (
            <p className="rounded-2xl border border-yellow-300/40 bg-yellow-400/20 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur-xl">
              ⚠ {uploadError}
            </p>
          )}
          {parsedName && !uploadError && (
            <button
              onClick={handleContinue}
              className="w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-sm font-bold text-white shadow-xl backdrop-blur-xl transition hover:bg-white/30"
            >
              Continue to resume editor →
            </button>
          )}
        </div>

        <p className="-mt-55 mb-70 text-center text-sm text-white/75"></p>
      </section>

      {/* Bottom section */}
      <section className="relative z-10 px-4 pb-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 text-center">
            <h3 className="text-2xl font-bold text-white md:text-3xl">
              How Reeracify Works
            </h3>
            <p className="mt-2 text-sm text-white/80 md:text-base">
              A simple flow to help users understand what happens next.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <ProcessCard
              icon={<UploadCloud size={24} />}
              title="Upload"
              desc="Submit your resume in PDF, DOC, or DOCX format."
            />
            <ProcessCard
              icon={<ScanSearch size={24} />}
              title="Analyze"
              desc="We review structure, missing sections, and job fit."
            />
            <ProcessCard
              icon={<Wand2 size={24} />}
              title="Optimize"
              desc="Receive rewrite suggestions and improvement guidance."
            />
            <ProcessCard
              icon={<Download size={24} />}
              title="Download"
              desc="Get a cleaner, stronger, ATS-ready resume."
            />
          </div>
        </div>
      </section>

      {/* Profile dropdown — rendered at root level to escape overflow-hidden */}
      {showProfile && (
        <>
          {/* invisible backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-[1999]"
            onClick={() => setShowProfile(false)}
          />
          <div
            className="fixed right-4 top-14 z-[2000] w-72 rounded-[1.4rem] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            style={{
              background: "linear-gradient(160deg,rgba(80,100,88,0.95) 0%,rgba(40,58,46,0.98) 100%)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(32px)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-base font-black text-white">My Account</p>
              <button
                onClick={() => setShowProfile(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/28"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 rounded-[1rem] border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Signed in as</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">
                {user?.email || "—"}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 w-full rounded-[1rem] bg-white px-4 py-3 text-sm font-black text-[#1e2e23] shadow-sm transition hover:bg-white/92 active:scale-[0.98]"
            >
              Log Out
            </button>
          </div>
        </>
      )}

      {/* Login / Register modal */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-md"
          style={{ backgroundColor: "rgba(20,30,25,0.60)" }}
          onClick={(e) => { if (e.target === e.currentTarget && isLoggedIn) setShowLogin(false); }}
        >
          <div
            className="relative w-full max-w-[420px] rounded-[2rem] p-8 text-white shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
            style={{
              background:
                "linear-gradient(160deg,rgba(80,100,88,0.82) 0%,rgba(50,68,56,0.88) 100%)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(32px)",
            }}
          >
            {/* Close — only shown when user is already logged in (manually opened) */}
            {isLoggedIn && (
              <button
                onClick={() => setShowLogin(false)}
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/18 text-white transition hover:bg-white/28"
              >
                <X size={17} />
              </button>
            )}

            <h2 className="text-[2rem] font-black leading-tight tracking-tight">
              {authMode === "login" ? "Log In" : "Sign Up"}
            </h2>

            {loginMessage && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold leading-5 ${
                loginMessage.toLowerCase().includes("check your email")
                  ? "bg-green-400/20 text-green-200"
                  : "bg-red-400/20 text-red-200"
              }`}>
                {loginMessage}
              </p>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-3">
              <input
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/18 bg-white/14 px-5 py-3.5 text-sm font-medium text-white outline-none placeholder:text-white/50 focus:border-white/40 focus:bg-white/20 transition"
              />

              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/18 bg-white/14 px-5 py-3.5 text-sm font-medium text-white outline-none placeholder:text-white/50 focus:border-white/40 focus:bg-white/20 transition"
              />

              <button
                type="submit"
                className="w-full rounded-2xl bg-white px-5 py-3.5 text-[15px] font-black text-[#1e2e23] shadow-sm transition hover:scale-[1.01] hover:bg-white/92 active:scale-[0.99]"
              >
                {authMode === "login" ? "Continue" : "Create Account"}
              </button>
            </form>

            <p className="mt-4 text-center text-[13px] text-white/70">
              {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => { setLoginMessage(""); setAuthMode(authMode === "login" ? "register" : "login"); }}
                className="font-black text-white underline decoration-white/50 underline-offset-3 transition hover:decoration-white"
              >
                {authMode === "login" ? "Register Now" : "Log In"}
              </button>
            </p>

            <p className="mt-6 text-center text-[11px] leading-[1.7] text-white/45">
              By signing up or logging in, you consent to Reeracify&apos;s{" "}
              <button
                type="button"
                onClick={() => router.push("/terms")}
                className="underline decoration-white/30 underline-offset-2 hover:text-white/70"
              >
                Terms of Use
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => router.push("/privacy")}
                className="underline decoration-white/30 underline-offset-2 hover:text-white/70"
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        </div>
      )}

      {/* LinkedIn popup */}
      {showLinkedIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-[2rem] border border-white/30 bg-white/20 p-8 text-center text-white shadow-2xl backdrop-blur-2xl">
            <button
              onClick={() => setShowLinkedIn(false)}
              className="absolute right-5 top-5 rounded-full bg-white/15 p-2 transition hover:bg-white/25"
            >
              <X size={18} />
            </button>

            <h2 className="text-2xl font-bold">
              Connect with LinkedIn?
            </h2>

            <p className="mt-3 text-sm text-white/75">
              Do you want to connect your LinkedIn profile with Reeracify?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLinkedIn(false)}
                className="flex-1 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/20"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowLinkedIn(false);
                  alert("LinkedIn connection coming soon.");
                }}
                className="flex-1 rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 transition hover:scale-[1.01]"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review & Confirm modal */}
      {showReviewModal && parsedResumeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-white/30 bg-white/20 p-8 text-white shadow-2xl backdrop-blur-2xl">
            <button
              onClick={() => setShowReviewModal(false)}
              className="absolute right-5 top-5 rounded-full bg-white/15 p-2 transition hover:bg-white/25"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <CheckCircle size={22} className="shrink-0 text-green-300" />
              <h2 className="text-2xl font-bold">Resume Parsed</h2>
            </div>
            <p className="mt-1 text-sm text-white/70">
              Review what we extracted before evaluation begins.
            </p>

            <div className="mt-5 space-y-3">
              {/* Name / contact */}
              <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Identity</p>
                <p className="mt-1 text-base font-bold">{parsedResumeData.name || "—"}</p>
                <p className="text-sm text-white/75">{parsedResumeData.email || ""}{parsedResumeData.phone ? ` · ${parsedResumeData.phone}` : ""}</p>
              </div>

              {/* Skills */}
              {parsedResumeData.skills?.length > 0 && (
                <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Skills ({parsedResumeData.skills.length})</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/90">
                    {parsedResumeData.skills.slice(0, 10).join(", ")}
                    {parsedResumeData.skills.length > 10 && ` +${parsedResumeData.skills.length - 10} more`}
                  </p>
                </div>
              )}

              {/* Counts row */}
              <div className="grid grid-cols-3 gap-2">
                <CountBadge
                  label="Education"
                  count={(parsedResumeData.education || []).length}
                />
                <CountBadge
                  label="Experience"
                  count={(parsedResumeData.work_experience || []).length}
                />
                <CountBadge
                  label="Projects"
                  count={(parsedResumeData.projects || []).length}
                />
              </div>

              {/* Summary snippet */}
              {parsedResumeData.summary && (
                <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Summary</p>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-white/85">
                    {parsedResumeData.summary}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/20"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmAndContinue}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-bold text-slate-900 transition hover:scale-[1.01]"
              >
                Confirm & Continue
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

function CountBadge({ label, count }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/15 px-3 py-3 text-center">
      <p className="text-2xl font-black">{count}</p>
      <p className="text-xs text-white/65">{label}</p>
    </div>
  );
}

function ProcessCard({ icon, title, desc }) {
  return (
    <div className="rounded-[1.6rem] border border-white/25 bg-white/15 p-5 text-center shadow-xl backdrop-blur-2xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
        {icon}
      </div>
      <h4 className="mt-4 text-xl font-bold text-white">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-white/80">{desc}</p>
    </div>
  );
}