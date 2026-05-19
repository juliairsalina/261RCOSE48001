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


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const PREPROCESS_API_URL = process.env.NEXT_PUBLIC_PREPROCESS_API_URL;


export default function HomePage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [vacancyLink, setVacancyLink] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

    useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleLogin = (e) => {
    e.preventDefault();

    // Dummy login for demo
    setIsLoggedIn(true);
    setShowLogin(false);
    setLoginMessage("");
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);

    if (!isLoggedIn) {
      setLoginMessage("Please log in for the best service.");
      setShowLogin(true);
    }

    try {
      const formData = new FormData();
      formData.append("resume", file);

      // STEP 1: send resume to preprocessing/parser
      const parseRes = await fetch(`${PREPROCESS_API_URL}/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (!parseRes.ok) {
        throw new Error("Preprocessing failed");
      }

      const parsedJson = await parseRes.json();

      console.log("Parsed JSON:", parsedJson);

      // STEP 2: send parsed JSON to FastAPI evaluation backend
      const evalRes = await fetch(`${API_BASE_URL}/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedJson),
      });

      if (!evalRes.ok) {
        throw new Error("Evaluation failed");
      }

      const result = await evalRes.json();
      console.log("Evaluation result:", result);

      // later use this to update your UI
      // setBackendResult(result);
    } catch (error) {
      console.error(error);
      alert("Cannot connect to backend. Please check your API URL.");
    }
  };


    const handleContinue = () => {
    if (!resumeFile) {
      alert("Please upload your resume first.");
      return;
    }

    // Vacancy link boleh kosong, so still continue
    router.push("/edit-resume");
  };

  const handleContactUs = () => {
    router.push("/contact");
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[url('/nature-bg.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/55" />

      {/* Soft blur lights */}
      <div className="absolute left-[-80px] top-16 h-72 w-72 rounded-full bg-blue-200/25 blur-3xl" />
      <div className="absolute bottom-20 right-[-80px] h-80 w-80 rounded-full bg-blue-100/20 blur-3xl" />

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
            <button className="flex items-center gap-2 rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28">
              <UserCircle size={18} />
              Profile
            </button>
          ) : (
            <button
              onClick={() => {
                setLoginMessage("");
                setShowLogin(true);
              }}
              className="rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:bg-white/28"
            >
              Log In
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
      <section className="relative z-10 flex min-h-[78vh] flex-col items-center px-4 pb-8 pt-1 text-center md:px-8">
        {/* Logo image */}
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

        <p className="mt-8 text-[10px] font-semibold text-white/90 sm:text-[10px] md:text-[15px]">
          Build a resume that feels clear, confident, and ready.
        </p>

        {/* Upload + link */}
        <div className="mt-18 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Upload Resume Box */}
          <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-white/25 bg-[#98946a]/85 px-5 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl transition hover:scale-[1.01]">
            <Upload size={18} />

            <span className="truncate">
              {resumeFile ? resumeFile.name : "Here's upload your resume"}
            </span>

            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleResumeUpload}
            />
          </label>

          {/* Paste Vacancy Link Box */}
          <div className="flex h-11 w-full items-center gap-3 rounded-full border border-white/25 bg-white/18 px-5 text-sm font-semibold text-white shadow-xl backdrop-blur-2xl">
            <LinkIcon size={18} className="shrink-0 text-white/85" />

            <input
              type="url"
              value={vacancyLink}
              onChange={(e) => setVacancyLink(e.target.value)}
              placeholder="Paste Vacancy Link"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/70"
            />

            <button
              onClick={handleContinue}
              className="flex h-8 w-11 shrink-0 items-center justify-center rounded-full bg-white/72 text-slate-900 transition hover:scale-105"
            >
              <ArrowRight size={18} />
            </button>
          </div>
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

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[2rem] border border-white/30 bg-white/20 p-8 text-white shadow-2xl backdrop-blur-2xl">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute right-5 top-5 rounded-full bg-white/15 p-2 transition hover:bg-white/25"
            >
              <X size={18} />
            </button>

            <h2 className="text-3xl font-bold">Log In</h2>
            <p className="mt-2 text-sm text-white/75">
              Continue to your Reeracify workspace.
            </p>

            {loginMessage && (
              <p className="mt-4 rounded-2xl border border-white/25 bg-white/20 px-4 py-3 text-sm font-semibold text-white">
                {loginMessage}
              </p>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <input
                type="email"
                placeholder="Email address"
                required
                className="w-full rounded-2xl border border-white/25 bg-white/20 px-4 py-3 text-white outline-none placeholder:text-white/60"
              />

              <input
                type="password"
                placeholder="Password"
                required
                className="w-full rounded-2xl border border-white/25 bg-white/20 px-4 py-3 text-white outline-none placeholder:text-white/60"
              />

              <button
                type="submit"
                className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 transition hover:scale-[1.01]"
              >
                Continue
              </button>
            </form>
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
    </main>
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