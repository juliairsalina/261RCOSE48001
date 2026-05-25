"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const PREPROCESS_API_URL = process.env.NEXT_PUBLIC_PREPROCESS_API_URL;

const PROCESS_STEPS = [
  {
    icon: UploadCloud,
    title: "Upload",
    desc: "Submit your resume in PDF, DOC, or DOCX format.",
  },
  {
    icon: ScanSearch,
    title: "Analyze",
    desc: "We review structure, missing sections, and job fit.",
  },
  {
    icon: Wand2,
    title: "Optimize",
    desc: "Receive rewrite suggestions and improvement guidance.",
  },
  {
    icon: Download,
    title: "Download",
    desc: "Get a cleaner, stronger, ATS-ready resume.",
  },
];

export default function HomePage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resumeFile, setResumeFile] = useState(null);
  const [vacancyLink, setVacancyLink] = useState("");

  const [loginMessage, setLoginMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
      setCurrentUser(data.session?.user || null);
    };

    checkSession();
  }, []);

  const openLoginModal = () => {
    setLoginMessage("");
    setShowLogin(true);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginMessage(error.message);
      return;
    }

    setIsLoggedIn(true);
    setCurrentUser(data.user);
    setShowLogin(false);
    setLoginMessage("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setShowProfile(false);
    setResumeFile(null);
    setVacancyLink("");
    setLoginMessage("");
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      setLoginMessage("Please enter your email and password first.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoginMessage(error.message);
      return;
    }

    setLoginMessage("Account created! Please check your email.");
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setUploadMessage("");

    if (!isLoggedIn) {
      setLoginMessage("Please log in for the best service.");
      setShowLogin(true);
    }

    if (!PREPROCESS_API_URL || !API_BASE_URL) {
      setUploadMessage("API URLs are not configured.");
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("resume", file);

      const parseResponse = await fetch(`${PREPROCESS_API_URL}/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (!parseResponse.ok) {
        throw new Error("Resume preprocessing failed.");
      }

      const parsedResume = await parseResponse.json();

      const evaluateResponse = await fetch(`${API_BASE_URL}/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...parsedResume,
          vacancyLink,
        }),
      });

      if (!evaluateResponse.ok) {
        throw new Error("Resume evaluation failed.");
      }

      const result = await evaluateResponse.json();

      console.log("Evaluation result:", result);
      setUploadMessage("Resume uploaded and analyzed successfully.");
    } catch (error) {
      console.error(error);
      setUploadMessage("Cannot connect to backend. Please check your API URL.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleContinue = () => {
    if (!resumeFile) {
      setUploadMessage("Please upload your resume first.");
      return;
    }

    router.push("/edit-resume");
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden text-white">
      <div className="absolute inset-0 bg-[url('/nature-bg.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/55" />

      <div className="absolute left-[-80px] top-16 h-72 w-72 rounded-full bg-blue-200/25 blur-3xl" />
      <div className="absolute bottom-20 right-[-80px] h-80 w-80 rounded-full bg-blue-100/20 blur-3xl" />

      <header className="relative z-10 flex w-full items-center justify-between px-3 pt-3 md:px-4 md:pt-4">
        <button
          type="button"
          onClick={() => setShowLinkedIn(true)}
          className="rounded-full border border-white/25 bg-white/15 px-5 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
        >
          LinkedIn
        </button>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
            >
              <UserCircle size={18} />
              Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={openLoginModal}
              className="rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
            >
              Log In
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push("/contact")}
            className="rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
          >
            Contact Us
          </button>
        </div>
      </header>

      <section className="relative z-10 flex min-h-[78vh] flex-col items-center px-4 pb-8 pt-1 text-center md:px-8">
        <div className="mt-10 flex justify-center">
          <Image
            src="/reeracify-logo.png"
            alt="Reeracify"
            width={900}
            height={270}
            priority
            className="h-auto w-[min(92vw,560px)] drop-shadow-2xl"
          />
        </div>

        <p className="mt-8 text-[10px] font-semibold text-white/90 md:text-[15px]">
          Build a resume that feels clear, confident, and ready.
        </p>

        <div className="mt-18 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-white/25 bg-[#98946a]/85 px-5 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:scale-[1.01]">
            <Upload size={18} />

            <span className="truncate">
              {isUploading
                ? "Uploading..."
                : resumeFile?.name || "Upload your resume"}
            </span>

            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={isUploading}
            />
          </label>

          <div className="flex h-11 w-full items-center gap-3 rounded-full border border-white/25 bg-white/18 px-5 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl">
            <LinkIcon size={18} className="shrink-0 text-white/85" />

            <input
              type="url"
              value={vacancyLink}
              onChange={(event) => setVacancyLink(event.target.value)}
              placeholder="Paste Vacancy Link"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/70"
            />

            <button
              type="button"
              onClick={handleContinue}
              className="flex h-8 w-11 shrink-0 items-center justify-center rounded-full bg-white/72 text-slate-900 transition hover:scale-105"
              aria-label="Continue"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {uploadMessage && (
          <p className="mt-4 text-sm font-semibold text-white/85">
            {uploadMessage}
          </p>
        )}
      </section>

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
            {PROCESS_STEPS.map(({ icon: Icon, title, desc }) => (
              <ProcessCard
                key={title}
                icon={<Icon size={24} />}
                title={title}
                desc={desc}
              />
            ))}
          </div>
        </div>
      </section>

      {showLogin && (
        <Modal onClose={() => setShowLogin(false)}>
          <div className="text-white">
            

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-300" />
              <p className="text-sm text-slate-500"> Log in with email and password</p>
              <div className="h-px flex-1 bg-slate-300" />
            </div>

            {loginMessage && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {loginMessage}
              </p>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="mb-2 block text-base font-semibold">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-4 text-black outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-base font-semibold">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-4 text-black outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                className="mt-6 h-12 w-full rounded-full border border-white/35 bg-[#98946a]/85 text-sm font-bold text-white shadow-xl backdrop-blur-2xl transition hover:bg-[#98946a]/95 hover:scale-[1.01]"
              >
                Log in
              </button>
            </form>

            <button
              type="button"
              className="text-sm font-semibold text-white/80 hover:text-white hover:underline"
            >
              Reset password
            </button>

            <button
            type="button"
            onClick={handleSignUp}
            className="ml-auto text-sm font-bold text-[#98946a] transition hover:text-[#b7b28a] hover:underline"
          >
            Sign up
          </button>
        </div>
        </Modal>
      )}

      {showProfile && (
        <Modal onClose={() => setShowProfile(false)}>
          <h2 className="text-3xl font-bold">Profile</h2>
          <p className="mt-2 text-sm text-white/75">
            Your Reeracify account details.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/25 bg-white/20 px-4 py-3">
              <p className="text-xs font-semibold text-white/60">User ID</p>
              <p className="mt-1 break-all text-sm font-semibold text-white">
                {currentUser?.id || "Not available"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/25 bg-white/20 px-4 py-3">
              <p className="text-xs font-semibold text-white/60">Email</p>
              <p className="mt-1 break-all text-sm font-semibold text-white">
                {currentUser?.email || "Not available"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-2xl bg-red-500/80 px-4 py-3 font-semibold text-white transition hover:scale-[1.01]"
            >
              Log Out
            </button>
          </div>
        </Modal>
      )}

      {showLinkedIn && (
        <Modal size="sm" onClose={() => setShowLinkedIn(false)}>
          <div className="text-center">
            <h2 className="text-2xl font-bold">Connect with LinkedIn?</h2>

            <p className="mt-3 text-sm text-white/75">
              Do you want to connect your LinkedIn profile with Reeracify?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLinkedIn(false)}
                className="flex-1 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/20"
              >
                Cancel
              </button>

              <button
                type="button"
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
        </Modal>
      )}
    </main>
  );
}

function Modal({ children, onClose, size = "md" }) {
  const maxWidth = size === "sm" ? "max-w-sm" : "max-w-[420px]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div
        className={`relative w-full ${maxWidth} rounded-[1.7rem] border border-white/25 bg-white/18 p-5 text-white shadow-2xl backdrop-blur-2xl`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full bg-white/15 p-2 transition hover:bg-white/25"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {children}
      </div>
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

