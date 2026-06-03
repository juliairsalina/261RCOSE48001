"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,

  Sparkles,
  AlertTriangle,
  Home,
  FileText,
  MessageCircle,
  Settings,
  HelpCircle,
  Menu,
  ChevronRight,
  Wand2,
  BarChart3,
  Target,
  Briefcase,
} from "lucide-react";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function EditResumePage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(0.72);

  const [resumeData, setResumeData] = useState({
        name: "John Doe",
        email: "john@email.com",
        phone: "+82 10-1234-5678",

        summary:
          "Computer Science student passionate about AI and backend systems.",

        skills: [
          "Python",
          "FastAPI",
          "React",
          "SQL",
          "Machine Learning"
        ],

        education: [
          {
            school: "Korea University",
            degree: "Bachelor of Computer Science",
            field: "Artificial Intelligence",
            start_date: "2022",
            end_date: "2026"
          }
        ],

        experience: [
          {
            role: "Backend Developer Intern",
            company: "ABC Tech",
            start_date: "Jun 2025",
            end_date: "Aug 2025",

            bullets: [
              "Developed REST APIs using FastAPI.",
              "Improved query performance by 30%.",
              "Integrated OCR preprocessing pipeline."
            ]
          }
        ],

        projects: [
          {
            name: "AI Resume Optimizer",
            start_date: "2025",
            end_date: "2025",

            bullets: [
              "Built ATS evaluation system.",
              "Implemented AI rewrite suggestions.",
              "Designed resume preview renderer."
            ]
          }
        ]
      });
  const [vacancyLink, setVacancyLink] = useState("");

  const [atsScoreValue, setAtsScoreValue] = useState(0);
  const [resumeLevel, setResumeLevel] = useState("Waiting for evaluation");
  const [jobSummary, setJobSummary] = useState(
    "Paste a vacancy link and upload a resume to generate job-based evaluation."
  );

  const [metrics, setMetrics] = useState({
    clarity: 0,
    keywordFit: 0,
    structure: 0,
    impact: 0,
  });

  const [backendSuggestions, setBackendSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState("summary");

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Backend session state
  const [userId, setUserId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [applicationId, setApplicationId] = useState("");

  // Right panel tab
  const [activeTab, setActiveTab] = useState("analysis");

  // Rewrites tab
  const [rewriteList, setRewriteList] = useState([]);

  // Cover letter tab
  const [coverLetterText, setCoverLetterText] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);

  // Active rewrite highlight in resume preview
  const [activeRewriteId, setActiveRewriteId] = useState(null);

  // Find Jobs tab
  const [jobResults, setJobResults] = useState([]);
  const [jobSearchLoading, setJobSearchLoading] = useState(false);
  const [jobSearched, setJobSearched] = useState(false);
  const [jobLocation, setJobLocation] = useState("");
  const [jobCountry, setJobCountry] = useState("us");

  // Career Profile tab
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [candidateProfileLoading, setCandidateProfileLoading] = useState(false);

  // One-level undo — saved before any content/score/rewrite change
  const [previousState, setPreviousState] = useState(null);

  function saveSnapshot() {
    setPreviousState({
      resumeData: JSON.parse(JSON.stringify(resumeData)),
      atsScoreValue,
      resumeLevel,
      metrics: { ...metrics },
      backendSuggestions: [...backendSuggestions],
      rewriteList: [...rewriteList],
    });
  }

  function undoChanges() {
    if (!previousState) return;
    setResumeData(previousState.resumeData);
    setAtsScoreValue(previousState.atsScoreValue);
    setResumeLevel(previousState.resumeLevel);
    setMetrics(previousState.metrics);
    setBackendSuggestions(previousState.backendSuggestions);
    setRewriteList(previousState.rewriteList);
    setPreviousState(null);
  }

  const suggestions = backendSuggestions || [];

  const currentSuggestion =
    suggestions.find((item) => item.id === activeSuggestion) || suggestions[0];

  useEffect(() => {
    const savedVacancyLink = localStorage.getItem("reeracifyVacancyLink");
    if (savedVacancyLink) {
      setVacancyLink(savedVacancyLink);
      setJobSummary("Vacancy link loaded. Click Evaluate to analyze it.");
    }

    const savedUserId = localStorage.getItem("reeracifyUserId");
    if (savedUserId) setUserId(savedUserId);

    const savedResumeId = localStorage.getItem("reeracifyResumeId");
    if (savedResumeId) setResumeId(savedResumeId);

    const savedAppId = localStorage.getItem("reeracifyApplicationId");
    if (savedAppId) setApplicationId(savedAppId);

    const savedParsed = localStorage.getItem("reeracifyParsedResume");
    if (savedParsed) {
      try {
        const parsed = JSON.parse(savedParsed);
        // Map backend fields to frontend resumeData shape
        setResumeData({
          name: parsed.name || "",
          email: parsed.email || "",
          phone: parsed.phone || "",
          summary: parsed.summary || "",
          skills: parsed.skills || [],
          education: (parsed.education || []).map(e => ({
            school: e.institution || e.school || "",
            degree: e.degree || "",
            field: e.field_of_study || e.field || "",
            start_date: e.start_date || "",
            end_date: e.end_date || "",
            gpa: e.gpa || "",
            description: e.description || "",
          })),
          experience: (parsed.work_experience || []).map(e => ({
            role: e.position || e.title || e.role || "",

            company: e.company || "",
            organization: e.organization || "",

            start_date: e.start_date || "",
            end_date:
              e.end_date === "Current" ||
              e.end_date === "Present" ||
              e.is_current
                ? "Present"
                : (e.end_date || ""),

            description: e.description || "",

            bullets: e.bullets || [],

            responsibilities: e.responsibilities || [],
          })),
          projects: (parsed.projects || []).map(p => ({
            name: p.title || p.name || "",
            start_date: p.start_date || "",
            end_date: p.end_date || "",
            description: p.description || "",
            technologies: p.technologies || [],
            bullets: p.bullets || [],
          })),
        });
      } catch (e) {
        console.warn("Could not parse saved resume:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (vacancyLink) {
      localStorage.setItem("reeracifyVacancyLink", vacancyLink);
    }
  }, [vacancyLink]);

  useEffect(() => {
    if (activeRewriteId && activeTab === "rewrites") {
      const el = document.getElementById(`rewrite-${activeRewriteId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeRewriteId, activeTab]);

  const zoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.08, 1.05));
  };

  const zoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.08, 0.5));
  };

  const goNextSuggestion = () => {
    const ids = suggestions.map((item) => item.id);
    const currentIndex = ids.indexOf(activeSuggestion);
    const nextIndex = (currentIndex + 1) % ids.length;
    setActiveSuggestion(ids[nextIndex]);
  };

  async function callBackend(path, options = {}) {
    const isFormData = options.body instanceof FormData;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: isFormData
        ? options.headers || {}
        : options.body
        ? {
            "Content-Type": "application/json",
            ...(options.headers || {}),
          }
        : options.headers || {},
      body: options.body,
    });

    if (!response.ok) {
      let detail = "";

      try {
        const errorBody = await response.json();
        detail = errorBody.detail ? `: ${errorBody.detail}` : "";
      } catch {
        detail = "";
      }

      throw new Error(`Backend error ${response.status}${detail}`);
    }

    return response.json();
  }

  function setLoadingState(message) {
    setIsLoading(true);
    setStatusMessage(message);
    setErrorMessage("");
  }

  function getRankLabel(rank) {
    if (rank === "상") return "Advanced";
    if (rank === "중") return "Intermediate";
    return "Beginner";
  }

  // Stream the LangGraph analysis pipeline (retrieve → ATS∥cover letter → rewrites).
  // Calls onStep(msg) for each progress event; resolves with the final result object.
  async function streamAnalysis(appId, uid, onStep) {
    const response = await fetch(`${API_BASE_URL}/applications/${appId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid }),
    });
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json()).detail || ""; } catch {}
      throw new Error(`Analysis failed ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const msg = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (!msg.startsWith("data: ")) continue;
        const data = JSON.parse(msg.slice(6));
        if (data.step) onStep(data.step);
        if (data.error) throw new Error(data.error);
        if (data.done) return data.result;
      }
    }
    throw new Error("Analysis stream ended without a result.");
  }

  function applyAnalysisResult(result, jobSummaryText) {
    saveSnapshot();
    const ats = result.ats || {};
    const score = ats.score || 0;
    setAtsScoreValue(score);
    setResumeLevel(getRankLabel(ats.rank));
    setJobSummary(jobSummaryText);

    const matched = ats.matched_skills?.length || 0;
    const missing = ats.missing_skills?.length || 0;
    const total = matched + missing || 1;
    setMetrics({
      clarity: Math.max(0, 100 - (ats.weaknesses?.length || 0) * 15),
      keywordFit: Math.round((matched / total) * 100),
      structure: score,
      impact: Math.min(100, (ats.strengths?.length || 0) * 20),
    });

    const atsSuggestions = [
      ...(ats.missing_skills || []).map((s, i) => ({
        id: `missing-${i}`, title: `Missing: ${s}`, type: "ATS", label: "Keyword",
        text: `"${s}" is required but not found in your resume.`,
        suggestion: `Add "${s}" to your skills or experience section.`,
      })),
      ...(ats.weaknesses || []).map((w, i) => ({
        id: `weak-${i}`, title: "Weakness", type: "Impact", label: "AI comment",
        text: w, suggestion: w,
      })),
      ...(ats.improvement_priority || []).map((p, i) => ({
        id: `priority-${i}`, title: "Priority", type: "Priority", label: "AI comment",
        text: p, suggestion: p,
      })),
    ];
    setBackendSuggestions(atsSuggestions);
    if (atsSuggestions.length > 0) setActiveSuggestion(atsSuggestions[0].id);

    setRewriteList(result.suggestions || []);
    if (result.cover_letter) setCoverLetterText(result.cover_letter);

    setIsLoading(false);
    setStatusMessage(`Analysis complete — ATS score: ${score}/100`);
    setActiveTab("rewrites");
  }

  async function evaluateResume() {
    if (!resumeId) {
      setErrorMessage("Please upload your resume on the home page first.");
      return;
    }

    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    const rid = resumeId || localStorage.getItem("reeracifyResumeId") || "";

    try {
      const hasLink = vacancyLink.trim().length > 0;
      setLoadingState(hasLink ? "Extracting job details from URL..." : "Preparing analysis...");
      const jobPost = await callBackend("/job-posts/create", {
        method: "POST",
        body: JSON.stringify({ job_url: vacancyLink.trim(), user_id: uid }),
      });

      setLoadingState("Creating application...");
      const app = await callBackend("/applications/create", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, resume_id: rid, job_post_id: jobPost.job_post_id }),
      });
      const appId = app.id;
      setApplicationId(appId);
      localStorage.setItem("reeracifyApplicationId", appId);

      // LangGraph pipeline: retrieve → (ATS ∥ cover letter) → rewrites
      const result = await streamAnalysis(appId, uid, (step) => setLoadingState(step));

      const jobSummaryText = hasLink
        ? `${jobPost.role_title || "Role"} at ${jobPost.company_name || "Company"}`
        : "General resume evaluation — no job posting provided.";
      applyAnalysisResult(result, jobSummaryText);

    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
    }
  }

  async function reevaluateResume() {
    await evaluateResume();
  }

  async function approveRewrite(suggestionId) {
    saveSnapshot();
    try {
      await callBackend(`/rewrite-suggestions/${suggestionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      });
      setRewriteList(prev =>
        prev.map(s => s.id === suggestionId ? { ...s, status: "approved" } : s)
      );
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function rejectRewrite(suggestionId) {
    saveSnapshot();
    try {
      await callBackend(`/rewrite-suggestions/${suggestionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
      setRewriteList(prev =>
        prev.map(s => s.id === suggestionId ? { ...s, status: "rejected" } : s)
      );
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function generateCoverLetter() {
    if (!applicationId) {
      setErrorMessage("Run Evaluate first to create an application.");
      return;
    }
    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    setCoverLetterLoading(true);
    setErrorMessage("");
    try {
      const result = await callBackend(`/applications/${applicationId}/cover-letter`, {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      });
      setCoverLetterText(result.content || "");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setCoverLetterLoading(false);
    }
  }

  function openSuggestionRewrite() {
    // Switch to Rewrites tab and highlight the first matching rewrite for this suggestion
    if (!currentSuggestion) return;
    setActiveTab("rewrites");
    const match = rewriteList.find(s =>
      currentSuggestion.text && s.original_text &&
      (s.original_text.includes(currentSuggestion.text.slice(0, 30)) ||
       currentSuggestion.text.includes(s.original_text.slice(0, 30)))
    );
    if (match) setActiveRewriteId(match.id);
  }

  async function findJobs() {
    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    const rid = resumeId || localStorage.getItem("reeracifyResumeId") || "";
    if (!rid) {
      setErrorMessage("Upload your resume first before searching for jobs.");
      return;
    }
    setJobSearchLoading(true);
    setErrorMessage("");
    try {
      const result = await callBackend("/jobs/search-web", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, resume_id: rid, location: jobLocation, country: jobCountry }),
      });
      setJobResults(result.jobs || []);
      setJobSearched(true);
    } catch (error) {
      setErrorMessage(error.message);
      setJobSearched(true);
    } finally {
      setJobSearchLoading(false);
    }
  }

  async function evaluateAgainstJob(job) {
    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    const rid = resumeId || localStorage.getItem("reeracifyResumeId") || "";
    if (!rid) return;
    try {
      setLoadingState(`Analyzing fit for ${job.role_title} at ${job.company_name}…`);
      setVacancyLink(job.job_url);
      localStorage.setItem("reeracifyVacancyLink", job.job_url);

      const app = await callBackend("/applications/create", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, resume_id: rid, job_post_id: job.job_post_id }),
      });
      const appId = app.id;
      setApplicationId(appId);
      localStorage.setItem("reeracifyApplicationId", appId);

      // LangGraph pipeline: retrieve → (ATS ∥ cover letter) → rewrites
      const result = await streamAnalysis(appId, uid, (step) => setLoadingState(step));
      applyAnalysisResult(result, `${job.role_title} at ${job.company_name}`);

    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
    }
  }

  async function generateCandidateProfile() {
    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    const rid = resumeId || localStorage.getItem("reeracifyResumeId") || "";
    if (!rid) {
      setErrorMessage("Upload your resume on the home page first.");
      return;
    }
    setCandidateProfileLoading(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.append("user_id", uid);
      const result = await callBackend(`/resumes/${rid}/candidate-profile`, {
        method: "POST",
        body: formData,
      });
      setCandidateProfile(result.profile);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setCandidateProfileLoading(false);
    }
  }

  async function searchJobsFromProfile() {
    setActiveTab("find-jobs");
    await findJobs();
  }

  async function downloadResume() {
    if (!applicationId) {
      setErrorMessage("Run Evaluate first to generate an application before downloading.");
      return;
    }
    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    try {
      setLoadingState("Preparing download...");
      // Fetch binary directly — callBackend always calls .json() which breaks for files
      const res = await fetch(`${API_BASE_URL}/applications/${applicationId}/export-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setIsLoading(false);
      setStatusMessage("Resume downloaded.");
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#dfe7da] text-[#243026]">
      {/* Background */}
      <div className="absolute inset-0 bg-[url('/nature-bg.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[#e8ece4]/68" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/25 to-[#e3e8df]/85" />

      {/* Soft light */}
      <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-white/35 blur-3xl" />
      <div className="absolute right-[12%] top-[18%] h-80 w-80 rounded-full bg-[#b9d1c0]/35 blur-3xl" />
      <div className="absolute bottom-[8%] left-[30%] h-96 w-96 rounded-full bg-[#f4e8b5]/25 blur-3xl" />

      <div className="relative z-10 flex min-h-screen">

      {/* Sidebar */}
      <aside
        className={`flex h-screen shrink-0 flex-col rounded-r-[0.5rem] border-r border-white/45 bg-white/35 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.14)] backdrop-blur-2xl transition-all duration-300 ${
          sidebarOpen ? "w-[230px]" : "w-[70px]"
        }`}
      >

        {/* Sidebar Top / Brand + Toggle */}
        <div className = "mb-6 flex items-center gap-3 px-1 pt-4"> 
          
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#243026] text-lg font-black leading-none text-white shadow-lg transition duration-300 hover:scale-105"
          >
            <Menu size={18} strokeWidth={3.5} />
          </button>

            {/* Brand text */}
          <div
            className={`min-w-[130px] transition-all duration-500 ease-in-out ${
              sidebarOpen
                ? "translate-x-0 opacity-100"
                : "-translate-x-3 opacity-0"
            }`}
          >
              <p className="whitespace-nowrap text-[20px] font-black tracking-tight text-[#243026]">
                   Reeracify
              </p>
            </div>
        </div>

          <nav className="space-y-1">
            <SidebarItem
              icon={<Home size={18} />}
              label="Home"
              open={sidebarOpen}
            />
            <SidebarItem
              icon={<FileText size={18} />}
              label="Resume Editor"
              active
              open={sidebarOpen}
            />
          </nav>

          <nav className="space-y-1">
            <SidebarItem
              icon={<MessageCircle size={18} />}
              label="Newsletter"
              open={sidebarOpen}
            />
          </nav>

          <div className="flex-1" />

          <nav className="space-y-1">
            <SidebarItem
              icon={<Settings size={18} />}
              label="Settings"
              open={sidebarOpen}
            />
            <SidebarItem
              icon={<HelpCircle size={18} />}
              label="Help & Support"
              open={sidebarOpen}
            />
          </nav>

          <button
            onClick={() => router.push("/")}
            className={`mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/35 py-3 text-xs font-bold text-[#243026] shadow-sm transition hover:bg-white/60 ${
              sidebarOpen ? "px-4" : "px-0"
            }`}
          >
            <ArrowLeft size={16} />
            {sidebarOpen && "Back Home"}
          </button>
        </aside>

        {/* Main content */}
        <section className="grid min-w-0 flex-1 grid-cols-[1fr_340px] gap-5 py-0 pl-5 pr-0">
          
          {/* Resume workspace */}
          <div className="flex h-screen min-w-0 flex-col rounded-[0.5rem] border-y-0 border-white/35 bg-white/28 p-5 shadow-[0_25px_90px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
            
            {/* Header + toolbar */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-4 rounded-full border border-white/50 bg-white/45 px-5 py-3 shadow-sm backdrop-blur-xl">
                
                {/* Left tools */}
                <div className="flex items-center gap-2">
                  <ToolButton
                    icon={<RotateCcw size={17} />}
                    label="Re-evaluate"
                    onClick={reevaluateResume}
                  />

                  {previousState && (
                    <ToolButton
                      icon={<ArrowLeft size={17} />}
                      label="Undo Changes"
                      onClick={undoChanges}
                    />
                  )}

                  <div className="mx-3 h-6 w-px bg-[#243026]/15" />

                  <ToolButton
                    icon={<ZoomOut size={17} />}
                    label="Zoom out"
                    onClick={zoomOut}
                  />

                  <span className="min-w-12 text-center text-xs font-black text-[#243026]/65">
                    {Math.round(zoom * 100)}%
                  </span>

                  <ToolButton
                    icon={<ZoomIn size={17} />}
                    label="Zoom in"
                    onClick={zoomIn}
                  />
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={vacancyLink}
                    onChange={(e) => setVacancyLink(e.target.value)}
                    placeholder="Paste vacancy link (optional)"
                    className="hidden w-56 rounded-full border border-[#243026]/20 bg-white/55 px-4 py-2 text-xs font-semibold text-[#243026] outline-none placeholder:text-[#243026]/35 focus:border-[#243026]/40 focus:bg-white/80 sm:block"
                  />

                  <button
                    onClick={evaluateResume}
                    disabled={isLoading}
                    className="rounded-full bg-[#243026] px-7 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {isLoading ? "Analyzing..." : "Analyze"}
                  </button>

                  <button
                    onClick={downloadResume}
                    className="flex items-center gap-2 rounded-full px-4 py-3 text-sm font-black text-[#243026] transition hover:bg-white/70"
                  >
                    Download
                    <Download size={18} strokeWidth={2.4} />
                  </button>
                </div>
              </div>

              {/* Ready-to-evaluate prompt */}
              {!isLoading && !atsScoreValue && resumeId && !errorMessage && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#243026]/15 bg-white/55 px-4 py-2.5">
                  <span className="flex h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  <p className="text-xs font-bold text-[#243026]/70">
                    Resume loaded{resumeData?.name ? ` — ${resumeData.name}` : ""}. Click <span className="text-[#243026]">Analyze</span> to run the full AI pipeline and get rewrite suggestions.
                  </p>
                </div>
              )}

              {(statusMessage || errorMessage) && (
                <div className="mt-3">
                  {statusMessage && (
                    <p className="rounded-2xl bg-white/55 px-4 py-2 text-xs font-bold text-[#243026]/65">
                      {statusMessage}
                    </p>
                  )}

                  {errorMessage && (
                    <p className="mt-2 rounded-2xl bg-red-100 px-4 py-2 text-xs font-bold text-red-700">
                      {errorMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* One resume section only */}
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto rounded-[1.4rem] bg-white/18 px-8 py-8 backdrop-blur-xl">
              <div
              id = "resume-a4"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                }}
                className="min-h-[1123px] w-[794px] shrink-0 rounded-[3px] bg-white px-16 py-12 text-black shadow-[0_30px_90px_rgba(0,0,0,0.22)] print:shadow-none"
              >
                <ResumeDocument
                  resumeData={resumeData}
                  rewriteList={rewriteList}
                  activeRewriteId={activeRewriteId}
                  onRewriteClick={(rw) => {
                    setActiveRewriteId(rw.id);
                    setActiveTab("rewrites");
                  }}
                  onDataChange={(next) => { saveSnapshot(); setResumeData(next); }}
                />
              </div>
            </div>
          </div>

          {/* Right evaluation panel */}
          <aside className="flex h-screen min-h-0 flex-col rounded-l-[0.5rem] border-y-0 border-r-0 border-white/45 bg-white/35 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-2xl">

            {/* Tab bar */}
            <div className="flex shrink-0 gap-1 border-b border-[#243026]/10 px-4 pt-4">
              {["analysis", "rewrites", "cover-letter", "find-jobs", "profile"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-t-xl px-3 py-2 text-xs font-black transition ${
                    activeTab === tab
                      ? "bg-white/70 text-[#243026] shadow-sm"
                      : "text-[#243026]/45 hover:text-[#243026]"
                  }`}
                >
                  {tab === "analysis" ? "Analysis"
                    : tab === "rewrites" ? "Rewrites"
                    : tab === "cover-letter" ? "Cover Letter"
                    : tab === "find-jobs" ? "Find Jobs"
                    : "Profile"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">

              {/* ── Analysis tab ── */}
              {activeTab === "analysis" && (
                <>
                  <section className="border-b border-[#243026]/10 pb-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#243026]/40">
                          Resume Level
                        </p>
                        <h2 className="mt-2 text-3xl font-black text-[#243026]">
                          {resumeLevel}
                        </h2>
                      </div>
                      <div className="rounded-2xl bg-[#dfe9ff]/80 p-3 text-[#2f5fa8]">
                        <Target size={22} />
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <LevelPill label="Beginner" active={resumeLevel === "Beginner"} />
                      <LevelPill label="Intermediate" active={resumeLevel === "Intermediate"} />
                      <LevelPill label="Advanced" active={resumeLevel === "Advanced"} />
                    </div>
                  </section>

                  <section className="border-b border-[#243026]/10 py-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#243026]/40">
                          ATS Score
                        </p>
                        <h2 className="mt-2 text-4xl font-black">{atsScoreValue}%</h2>
                      </div>
                      <div className="rounded-2xl bg-white/50 p-3">
                        <BarChart3 size={23} />
                      </div>
                    </div>
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/60">
                      <div
                        className="h-full rounded-full bg-[#243026]"
                        style={{ width: `${Math.max(0, Math.min(atsScoreValue, 100))}%` }}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <MetricBox title="Clarity" value={metrics.clarity} />
                      <MetricBox title="Keyword" value={metrics.keywordFit} />
                      <MetricBox title="Structure" value={metrics.structure} />
                      <MetricBox title="Impact" value={metrics.impact} />
                    </div>
                  </section>

                  <section className="border-b border-[#243026]/10 py-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#243026]/40">
                      Job Link Summary
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#243026]/65">{jobSummary}</p>
                  </section>

                  <section className="flex min-h-0 flex-1 flex-col py-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#243026]/40">
                          AI Comments
                        </p>
                        <h2 className="mt-1 text-xl font-black">Suggestions</h2>
                      </div>
                      <div className="rounded-2xl bg-yellow-300/80 p-3 text-black">
                        <Wand2 size={21} />
                      </div>
                    </div>

                    <div className="space-y-2 overflow-auto pr-1">
                      {suggestions.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setActiveSuggestion(item.id)}
                          className={`w-full rounded-[1.1rem] border px-4 py-3 text-left transition ${
                            activeSuggestion === item.id
                              ? "border-yellow-300 bg-yellow-100/85 shadow-[0_12px_30px_rgba(234,179,8,0.15)]"
                              : "border-white/35 bg-white/25 hover:bg-white/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-[#243026]">{item.title}</p>
                              <p className="mt-1 text-[11px] font-bold text-[#243026]/45">
                                {item.type} · {item.label}
                              </p>
                            </div>
                            {activeSuggestion === item.id ? (
                              <AlertTriangle size={16} className="shrink-0 text-yellow-700" />
                            ) : (
                              <ChevronRight size={16} className="shrink-0 text-[#243026]/40" />
                            )}
                          </div>
                        </button>
                      ))}
                      {suggestions.length === 0 && (
                        <p className="rounded-2xl bg-white/35 px-4 py-4 text-sm text-[#243026]/50">
                          Run Evaluate to see AI suggestions.
                        </p>
                      )}
                    </div>
                  </section>

                  {currentSuggestion && (
                    <section className="border-t border-[#243026]/10 pt-5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={17} />
                        <h3 className="text-sm font-black">{currentSuggestion.title}</h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#243026]/65">
                        {currentSuggestion.text}
                      </p>
                      <button
                        onClick={openSuggestionRewrite}
                        className="mt-4 w-full rounded-[1.2rem] bg-[#243026] px-4 py-3 text-xs font-bold text-white shadow-lg transition hover:scale-[1.01]"
                      >
                        Show Rewrite Suggestion
                      </button>
                    </section>
                  )}
                </>
              )}

              {/* ── Rewrites tab ── */}
              {activeTab === "rewrites" && (
                <section className="flex flex-col gap-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-xl font-black text-[#243026]">Rewrite Suggestions</h2>
                    <div className="rounded-2xl bg-yellow-300/80 p-2 text-black">
                      <Wand2 size={18} />
                    </div>
                  </div>

                  {rewriteList.length === 0 ? (
                    <p className="rounded-2xl bg-white/35 px-4 py-6 text-center text-sm text-[#243026]/50">
                      Run Evaluate to generate rewrite suggestions.
                    </p>
                  ) : (
                    rewriteList.map((s) => (
                      <div
                        key={s.id}
                        id={`rewrite-${s.id}`}
                        onClick={() => setActiveRewriteId(s.id)}
                        className={`cursor-pointer rounded-[1.2rem] border p-4 transition ${
                          activeRewriteId === s.id
                            ? "border-yellow-400 bg-yellow-50/80 shadow-[0_0_0_2px_rgba(250,204,21,0.4)]"
                            : s.status === "approved"
                            ? "border-green-300 bg-green-50/70"
                            : s.status === "rejected"
                            ? "border-red-200 bg-red-50/60 opacity-60"
                            : "border-white/45 bg-white/35 hover:bg-white/55"
                        }`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#243026]/40">
                          {s.section}
                        </p>

                        <p className="mt-2 text-xs leading-5 text-[#243026]/55 line-through">
                          {s.original_text}
                        </p>

                        <p className="mt-2 text-sm font-semibold leading-5 text-[#243026]">
                          {s.suggested_text}
                        </p>

                        {s.reason && (
                          <p className="mt-2 text-xs leading-5 text-[#243026]/50">{s.reason}</p>
                        )}

                        {s.status === "pending" && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); approveRewrite(s.id); }}
                              className="flex-1 rounded-full bg-[#243026] py-2 text-xs font-black text-white transition hover:scale-[1.02]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); rejectRewrite(s.id); }}
                              className="flex-1 rounded-full border border-[#243026]/20 bg-white/50 py-2 text-xs font-black text-[#243026] transition hover:bg-white/80"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {s.status !== "pending" && (
                          <p className={`mt-2 text-xs font-black uppercase tracking-wide ${
                            s.status === "approved" ? "text-green-600" : "text-red-500"
                          }`}>
                            {s.status}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </section>
              )}

              {/* ── Cover Letter tab ── */}
              {activeTab === "cover-letter" && (
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-[#243026]">Cover Letter</h2>
                    <div className="rounded-2xl bg-[#dfe9ff]/80 p-2 text-[#2f5fa8]">
                      <FileText size={18} />
                    </div>
                  </div>

                  <button
                    onClick={generateCoverLetter}
                    disabled={coverLetterLoading || !applicationId}
                    className="w-full rounded-[1.2rem] bg-[#243026] px-4 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
                  >
                    {coverLetterLoading ? "Generating..." : coverLetterText ? "Regenerate" : "Generate Cover Letter"}
                  </button>

                  {!applicationId && (
                    <p className="rounded-2xl bg-white/35 px-4 py-3 text-center text-xs text-[#243026]/50">
                      Run Evaluate first to enable cover letter generation.
                    </p>
                  )}

                  {coverLetterText && (
                    <>
                      <textarea
                        value={coverLetterText}
                        onChange={(e) => setCoverLetterText(e.target.value)}
                        rows={18}
                        className="w-full rounded-[1.2rem] border border-white/45 bg-white/55 p-4 text-sm leading-6 text-[#243026] outline-none focus:border-[#243026]/30 focus:bg-white/70"
                      />
                      <button
                        onClick={() => {
                          const blob = new Blob([coverLetterText], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "cover-letter.txt";
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        }}
                        className="w-full rounded-[1.2rem] border border-[#243026]/20 bg-white/50 py-3 text-xs font-black text-[#243026] transition hover:bg-white/80"
                      >
                        Download as .txt
                      </button>
                    </>
                  )}
                </section>
              )}

              {/* ── Career Profile tab ── */}
              {activeTab === "profile" && (
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-[#243026]">Career Profile</h2>
                    <div className="rounded-2xl bg-[#dfe9ff]/80 p-2 text-[#2f5fa8]">
                      <Briefcase size={18} />
                    </div>
                  </div>

                  <p className="text-xs text-[#243026]/55 leading-5">
                    AI analyzes your full resume and builds a career intelligence profile — target roles, seniority, skills, and ready-to-use job search queries.
                  </p>

                  <button
                    onClick={generateCandidateProfile}
                    disabled={candidateProfileLoading || !resumeId}
                    className="w-full rounded-[1.2rem] bg-[#243026] px-4 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
                  >
                    {candidateProfileLoading
                      ? "Analyzing resume…"
                      : candidateProfile
                      ? "Regenerate Profile"
                      : "Generate Career Profile"}
                  </button>

                  {!resumeId && (
                    <p className="rounded-2xl bg-white/35 px-4 py-3 text-center text-xs text-[#243026]/50">
                      Upload your resume on the home page first.
                    </p>
                  )}

                  {candidateProfileLoading && (
                    <p className="text-center text-xs text-[#243026]/50 animate-pulse">
                      AI is reading your resume…
                    </p>
                  )}

                  {candidateProfile && (
                    <div className="flex flex-col gap-4">

                      {/* Seniority */}
                      <div className="rounded-[1.2rem] border border-white/45 bg-white/40 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#243026]/40">Seniority Level</p>
                        <p className="mt-1 text-base font-black text-[#243026] capitalize">
                          {candidateProfile.seniority_level || "—"}
                        </p>
                      </div>

                      {/* Target Roles */}
                      {candidateProfile.target_roles?.length > 0 && (
                        <div className="rounded-[1.2rem] border border-white/45 bg-white/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#243026]/40 mb-2">Target Roles</p>
                          <div className="flex flex-wrap gap-1.5">
                            {candidateProfile.target_roles.map((role, i) => (
                              <span key={i} className="rounded-full bg-[#243026] px-3 py-1 text-[11px] font-bold text-white">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Core Skills */}
                      {candidateProfile.core_skills?.length > 0 && (
                        <div className="rounded-[1.2rem] border border-white/45 bg-white/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#243026]/40 mb-2">Core Skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {candidateProfile.core_skills.map((skill, i) => (
                              <span key={i} className="rounded-full border border-[#243026]/20 bg-white/60 px-3 py-1 text-[11px] font-semibold text-[#243026]">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Domain Interests */}
                      {candidateProfile.domain_interests?.length > 0 && (
                        <div className="rounded-[1.2rem] border border-white/45 bg-white/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#243026]/40 mb-2">Domain Interests</p>
                          <div className="flex flex-wrap gap-1.5">
                            {candidateProfile.domain_interests.map((d, i) => (
                              <span key={i} className="rounded-full bg-[#dfe9ff]/80 px-3 py-1 text-[11px] font-semibold text-[#2f5fa8]">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strongest Experiences */}
                      {candidateProfile.strongest_experiences?.length > 0 && (
                        <div className="rounded-[1.2rem] border border-white/45 bg-white/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#243026]/40 mb-2">Strongest Experiences</p>
                          <ul className="space-y-1">
                            {candidateProfile.strongest_experiences.map((exp, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-[#243026]/75">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#243026]/40" />
                                {exp}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}


                      <button
                        onClick={searchJobsFromProfile}
                        disabled={jobSearchLoading || !resumeId}
                        className="w-full rounded-[1.2rem] border border-[#243026]/20 bg-white/50 py-3 text-xs font-black text-[#243026] transition hover:bg-white/80 disabled:opacity-50"
                      >
                        {jobSearchLoading ? "Searching…" : "Search Jobs with this Profile →"}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* ── Find Jobs tab ── */}
              {activeTab === "find-jobs" && (
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-[#243026]">Find Jobs</h2>
                    <div className="rounded-2xl bg-[#dfe9ff]/80 p-2 text-[#2f5fa8]">
                      <Target size={18} />
                    </div>
                  </div>

                  <p className="text-xs text-[#243026]/55 leading-5">
                    AI searches the web for real job postings that match your resume. Click any result to evaluate your fit.
                  </p>

                  <select
                    value={jobCountry}
                    onChange={(e) => setJobCountry(e.target.value)}
                    className="w-full rounded-[1.2rem] border border-white/45 bg-white/55 px-4 py-2.5 text-sm text-[#243026] outline-none focus:border-[#243026]/30"
                  >
                    <option value="us">🇺🇸 United States</option>
                    <option value="sg">🇸🇬 Singapore</option>
                    <option value="gb">🇬🇧 United Kingdom</option>
                    <option value="ca">🇨🇦 Canada</option>
                    <option value="de">🇩🇪 Germany</option>
                    <option value="au">🇦🇺 Australia</option>
                    <option value="nl">🇳🇱 Netherlands</option>
                    <option value="jp">🇯🇵 Japan</option>
                    <option value="kr">🇰🇷 South Korea</option>
                    <option value="my">🇲🇾 Malaysia</option>
                    <option value="in">🇮🇳 India</option>
                  </select>

                  <input
                    type="text"
                    value={jobLocation}
                    onChange={(e) => setJobLocation(e.target.value)}
                    placeholder="City or Remote (optional)"
                    className="w-full rounded-[1.2rem] border border-white/45 bg-white/55 px-4 py-2.5 text-sm text-[#243026] outline-none placeholder:text-[#243026]/40 focus:border-[#243026]/30"
                  />

                  <button
                    onClick={findJobs}
                    disabled={jobSearchLoading || !resumeId}
                    className="w-full rounded-[1.2rem] bg-[#243026] px-4 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
                  >
                    {jobSearchLoading ? "Searching the web…" : jobResults.length > 0 ? "Search Again" : "Search for Jobs"}
                  </button>

                  {!resumeId && (
                    <p className="rounded-2xl bg-white/35 px-4 py-3 text-center text-xs text-[#243026]/50">
                      Upload your resume on the home page first.
                    </p>
                  )}

                  {jobSearchLoading && (
                    <p className="text-center text-xs text-[#243026]/50 animate-pulse">
                      AI is searching the web for relevant job openings…
                    </p>
                  )}

                  {!jobSearchLoading && jobSearched && jobResults.length === 0 && (
                    <p className="rounded-2xl bg-white/35 px-4 py-3 text-center text-xs text-[#243026]/50">
                      No jobs found. Try a different location or generate a candidate profile first.
                    </p>
                  )}

                  <div className="flex flex-col gap-3">
                    {jobResults.map((job, i) => (
                      <div
                        key={job.job_post_id || i}
                        className="rounded-[1.2rem] border border-white/45 bg-white/40 p-4"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#243026]/40">
                          {job.location || "Location not specified"}
                        </p>
                        <h3 className="mt-1 text-sm font-black text-[#243026]">{job.role_title}</h3>
                        <p className="text-xs font-semibold text-[#243026]/65">{job.company_name}</p>
                        {job.job_description && (
                          <p className="mt-2 text-xs leading-5 text-[#243026]/55 line-clamp-3">
                            {job.job_description}
                          </p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => evaluateAgainstJob(job)}
                            disabled={isLoading}
                            className="flex-1 rounded-full bg-[#243026] py-2 text-xs font-black text-white transition hover:scale-[1.01] disabled:opacity-50"
                          >
                            Evaluate Fit
                          </button>
                          {job.job_url && (
                            <a
                              href={job.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center rounded-full border border-[#243026]/20 bg-white/50 px-4 py-2 text-xs font-black text-[#243026] transition hover:bg-white/80"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          </aside>
        </section>
      </div>

    </main>
  );
}

function SidebarItem({ icon, label, active, open }) {
  return (
    <button
      title={!open ? label : ""}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        open ? "justify-start" : "justify-center px-0"
      } ${
        active
          ? "bg-[#dfe9ff]/75 text-[#2f5fa8] shadow-sm"
          : "text-[#243026]/68 hover:bg-white/45 hover:text-[#243026]"
      }`}
    >
      <span className={active ? "text-[#2f5fa8]" : "text-[#243026]/55"}>
        {icon}
      </span>

      {open && <span>{label}</span>}
    </button>
  );
}

function ToolButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[#243026]/70 transition hover:bg-white hover:text-[#243026]"
    >
      {icon}
    </button>
  );
}

function LevelPill({ label, active }) {
  return (
    <div
      className={`rounded-full px-3 py-2 text-center text-[11px] font-black ${
        active
          ? "bg-[#243026] text-white shadow-lg"
          : "bg-white/45 text-[#243026]/55"
      }`}
    >
      {label}
    </div>
  );
}

function MetricBox({ title, value }) {
  return (
    <div className="rounded-[1.1rem] border border-white/45 bg-white/35 p-3">
      <p className="text-[11px] font-bold text-[#243026]/50">{title}</p>
      <p className="mt-1 text-lg font-black text-[#243026]">{value}</p>
    </div>
  );
}

function ResumeDocument({ resumeData, rewriteList = [], activeRewriteId, onRewriteClick, onDataChange }) {
  const rewriteMap = useMemo(() => {
    const m = new Map();
    for (const rw of rewriteList) {
      if (rw.original_text) m.set(rw.original_text.trim(), rw);
    }
    return m;
  }, [rewriteList]);

  function matchRewrite(text) {
    if (!text) return null;
    const t = text.trim();
    for (const [orig, rw] of rewriteMap) {
      if (t === orig || t.includes(orig) || orig.includes(t)) return rw;
    }
    return null;
  }

  function RewritableBullet({ text, children }) {
    const rw = matchRewrite(text);

    if (!rw) {
      return children || <>{text}</>;
    }

    const isActive = rw.id === activeRewriteId;

    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRewriteClick?.(rw);
        }}
        title="Click to view rewrite suggestion"
        className={`cursor-pointer rounded px-0.5 transition ${
          isActive
            ? "bg-yellow-300 shadow-[0_0_0_2px_rgba(250,204,21,0.7)]"
            : rw.status === "approved"
            ? "bg-green-200"
            : rw.status === "rejected"
            ? "line-through opacity-50"
            : "bg-yellow-100 hover:bg-yellow-200"
        }`}
      >
        {children || text}
      </span>
    );
  }

  // Shorthand: spread-update top-level resumeData fields
  const upd = onDataChange
    ? (patch) => onDataChange({ ...resumeData, ...patch })
    : null;

  const hasData = resumeData && (
    resumeData.name || resumeData.email ||
    (resumeData.experience || []).length > 0 ||
    (resumeData.education || []).length > 0 ||
    (resumeData.projects || []).length > 0 ||
    flattenSkills(resumeData.skills).length > 0
  );

  if (!hasData) {
    return (
      <article className="flex h-full items-center justify-center text-center text-[#243026]/50">
        <div>
          <h2 className="text-xl font-black text-[#243026]">Resume preview</h2>
          <p className="mt-2 text-sm">Upload your resume on the home page, then click Evaluate.</p>
        </div>
      </article>
    );
  }

  const skills = flattenSkills(resumeData.skills);
  const education = resumeData.education || [];
  const experience = resumeData.experience || resumeData.work_experience || [];
  const projects = resumeData.projects || [];
  const pendingCount = rewriteList.filter(r => r.status === "pending").length;

  return (
    <article className="text-[12px] leading-[1.45]">

      {/* Header */}
      <div className="border-b pb-3 text-center">
        <Editable
          value={resumeData.name || ""}
          onSave={upd ? (v) => upd({ name: v }) : null}
          as="h1"
          placeholder="Your Name"
          className="text-[22px] font-black"
        />
        <p className="mt-1 text-[11px] text-gray-500 flex flex-wrap justify-center gap-x-1">
          <Editable
            value={resumeData.email || ""}
            onSave={upd ? (v) => upd({ email: v }) : null}
            placeholder="email@example.com"
          />
          {(resumeData.email || resumeData.phone) && <span className="select-none"> · </span>}
          <Editable
            value={resumeData.phone || ""}
            onSave={upd ? (v) => upd({ phone: v }) : null}
            placeholder="+1 234 567 8900"
          />
        </p>
      </div>

      {pendingCount > 0 && (
        <p className="mt-3 rounded-lg bg-yellow-50 px-3 py-1.5 text-[10px] font-bold text-yellow-700">
          ✦ {pendingCount} rewrite suggestion{pendingCount > 1 ? "s" : ""} highlighted — click to review
        </p>
      )}

      {/* Summary */}
      {(resumeData.summary || upd) && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">Summary</h2>
          <RewritableBullet text={resumeData.summary || ""}>
            <Editable
              value={resumeData.summary || ""}
              onSave={upd ? (v) => upd({ summary: v }) : null}
              as="p"
              placeholder="Write a short professional summary..."
              className="mt-2"
            />
          </RewritableBullet>
        </section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">Experience</h2>
          {experience.map((exp, i) => (
            <div key={i} className="mt-3">
              <div className="flex justify-between">
                <div>
                  <Editable
                    value={exp.role || exp.title || ""}
                    onSave={upd ? (v) => {
                      const newExp = experience.map((e, ei) => ei === i ? { ...e, role: v } : e);
                      upd({ experience: newExp });
                    } : null}
                    as="h3"
                    placeholder="Job Title"
                    className="font-bold"
                  />
                  <Editable
                    value={exp.company || exp.organization || ""}
                    onSave={upd ? (v) => {
                      const newExp = experience.map((e, ei) => ei === i ? { ...e, company: v } : e);
                      upd({ experience: newExp });
                    } : null}
                    as="p"
                    placeholder="Company Name"
                    className="text-gray-600"
                  />
                </div>
                <div className="shrink-0 text-gray-500 ml-2 text-right">
                  <Editable
                    value={exp.start_date || ""}
                    onSave={upd ? (v) => {
                      const newExp = experience.map((e, ei) =>
                        ei === i ? { ...e, start_date: v } : e
                      );
                      upd({ experience: newExp });
                    } : null}
                    placeholder="Start Date"
                  />

                  <span> – </span>

                  <Editable
                    value={exp.end_date || ""}
                    onSave={upd ? (v) => {
                      const newExp = experience.map((e, ei) =>
                        ei === i ? { ...e, end_date: v } : e
                      );
                      upd({ experience: newExp });
                    } : null}
                    placeholder="End Date"
                  />
                </div>
              </div>
              {/* Description always shown as editable so user can add one even if empty */}
              {(exp.bullets?.length
                ? exp.bullets
                : exp.responsibilities || []).length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {(exp.bullets?.length
                    ? exp.bullets
                    : exp.responsibilities || []).map((b, j) => (
                    <li key={j}>
                      <RewritableBullet text={b}>
                        <Editable
                          value={b}
                          onSave={upd ? (v) => {
                            const newExp = experience.map((e, ei) => {
                              if (ei !== i) return e;

                              const currentBullets =
                                e.bullets?.length
                                  ? [...e.bullets]
                                  : [...(e.responsibilities || [])];

                              currentBullets[j] = v;

                              return e.bullets?.length
                                ? { ...e, bullets: currentBullets }
                                : { ...e, responsibilities: currentBullets };
                            });

                            upd({ experience: newExp });
                          } : null}
                        />
                      </RewritableBullet>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">Projects</h2>
          {projects.map((proj, i) => (
            <div key={i} className="mt-3">
              <div className="flex justify-between">
                <Editable
                  value={proj.name || proj.title || ""}
                  onSave={upd ? (v) => {
                    const newProj = projects.map((p, pi) => pi === i ? { ...p, name: v } : p);
                    upd({ projects: newProj });
                  } : null}
                  as="h3"
                  placeholder="Project Name"
                  className="font-bold"
                />
                <div className="shrink-0 text-gray-500 ml-2 text-right">
                  <Editable
                    value={proj.start_date || ""}
                    onSave={upd ? (v) => {
                      const newProj = projects.map((p, pi) =>
                        pi === i ? { ...p, start_date: v } : p
                      );
                      upd({ projects: newProj });
                    } : null}
                    placeholder="Start Date"
                  />

                  <span> – </span>

                  <Editable
                    value={proj.end_date || ""}
                    onSave={upd ? (v) => {
                      const newProj = projects.map((p, pi) =>
                        pi === i ? { ...p, end_date: v } : p
                      );
                      upd({ projects: newProj });
                    } : null}
                    placeholder="End Date"
                  />
                </div>
              </div>
              <Editable
                value={proj.description || ""}
                onSave={upd ? (v) => {
                  const newProj = projects.map((p, pi) => pi === i ? { ...p, description: v } : p);
                  upd({ projects: newProj });
                } : null}
                as="p"
                placeholder="Describe this project..."
                className="mt-1 text-gray-700"
              />
              {proj.contributions?.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {proj.contributions.map((c, ci) => <li key={ci}>{c}</li>)}
                </ul>
              )}
              {(proj.results || proj.outcomes)?.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {(proj.results || proj.outcomes).map((r, ri) => <li key={ri}>{r}</li>)}
                </ul>
              )}
              {proj.repository && (
                <p className="mt-1 text-blue-600 break-all">{proj.repository}</p>
              )}
              {proj.links?.length > 0 && (
                <p className="mt-1 text-blue-600 break-all">{proj.links[0]}</p>
              )}
              {proj.technologies?.length > 0 && (
                <Editable
                  value={`Technologies: ${proj.technologies.join(", ")}`}
                  onSave={upd ? (v) => {
                    const techs = v
                      .replace(/^Technologies:\s*/i, "")
                      .split(",")
                      .map(t => t.trim())
                      .filter(Boolean);

                    const newProj = projects.map((p, pi) =>
                      pi === i
                        ? { ...p, technologies: techs }
                        : p
                    );

                    upd({ projects: newProj });
                  } : null}
                  className="mt-1 text-gray-500 text-[11px]"
                />
              )}
              {(proj.bullets || []).length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {proj.bullets.map((b, j) => (
                    <li key={j}>
                      <RewritableBullet text={b}>
                        <Editable
                          value={b}
                          onSave={upd ? (v) => {
                            const newProj = projects.map((p, pi) => {
                              if (pi !== i) return p;

                              const newBullets = [...(p.bullets || [])];
                              newBullets[j] = v;

                              return {
                                ...p,
                                bullets: newBullets
                              };
                            });

                            upd({ projects: newProj });
                          } : null}
                        />
                      </RewritableBullet>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">Education</h2>
          {education.map((edu, i) => (
            <div key={i} className="mt-2">
              <div className="flex justify-between">
                <div>
                  <Editable
                    value={edu.school || edu.institution || ""}
                    onSave={upd ? (v) => {
                      const newEdu = education.map((e, ei) => ei === i ? { ...e, school: v } : e);
                      upd({ education: newEdu });
                    } : null}
                    as="h3"
                    placeholder="School / University"
                    className="font-bold"
                  />
                  {(edu.degree || edu.program) && (
                    <Editable
                      value={edu.degree || edu.program || ""}
                      onSave={upd ? (v) => {
                        const newEdu = education.map((e, ei) => ei === i ? { ...e, degree: v } : e);
                        upd({ education: newEdu });
                      } : null}
                      as="p"
                      placeholder="Degree"
                      className="text-gray-600"
                    />
                  )}
                  <RewritableBullet text={edu.field_of_study || ""}>
                    <Editable
                      value={edu.field_of_study || ""}
                      onSave={upd ? (v) => {
                        const newEdu = education.map((e, ei) =>
                          ei === i ? { ...e, field_of_study: v } : e
                        );
                        upd({ education: newEdu });
                      } : null}
                      as="p"
                      placeholder="Field of Study"
                      className="text-gray-600"
                    />
                  </RewritableBullet>
                  {edu.focus && (
                    <p className="mt-1 text-gray-700">
                      {Array.isArray(edu.focus) ? edu.focus.join(", ") : edu.focus}
                    </p>
                  )}
                  {edu.highlights?.length > 0 && (
                    <ul className="mt-1 list-disc pl-5">
                      {edu.highlights.map((h, hi) => (
                        <li key={hi}>
                          <RewritableBullet text={h}>
                            <Editable
                              value={h}
                              onSave={upd ? (v) => {
                                const newEdu = education.map((e, ei) => {
                                  if (ei !== i) return e;

                                  const newHighlights = [...(e.highlights || [])];
                                  newHighlights[hi] = v;

                                  return {
                                    ...e,
                                    highlights: newHighlights
                                  };
                                });

                                upd({ education: newEdu });
                              } : null}
                            />
                          </RewritableBullet>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-gray-500 shrink-0 ml-2 text-right">
                  <Editable
                    value={edu.start_date || ""}
                    onSave={upd ? (v) => {
                      const newEdu = education.map((e, ei) =>
                        ei === i ? { ...e, start_date: v } : e
                      );
                      upd({ education: newEdu });
                    } : null}
                    placeholder="Start Date"
                  />

                  <span> – </span>

                  <Editable
                    value={edu.end_date || ""}
                    onSave={upd ? (v) => {
                      const newEdu = education.map((e, ei) =>
                        ei === i ? { ...e, end_date: v } : e
                      );
                      upd({ education: newEdu });
                    } : null}
                    placeholder="End Date"
                  />
                </div>
              </div>
              <p className="text-gray-600">
                GPA:
                <Editable
                  value={edu.gpa || ""}
                  onSave={upd ? (v) => {
                    const newEdu = education.map((e, ei) =>
                      ei === i ? { ...e, gpa: v } : e
                    );
                    upd({ education: newEdu });
                  } : null}
                  placeholder="3.86/4.00"
                />
              </p>
              <RewritableBullet text={(edu.coursework || []).join(", ")}>
                <Editable
                  value={(edu.coursework || []).join(", ")}
                  onSave={upd ? (v) => {
                    const newEdu = education.map((e, ei) =>
                      ei === i
                        ? {
                            ...e,
                            coursework: v
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean)
                          }
                        : e
                    );

                    upd({ education: newEdu });
                  } : null}
                  as="p"
                  placeholder="Relevant Coursework (AI, Machine Learning, Databases)"
                  className="mt-1 text-gray-700"
                />
              </RewritableBullet>
              <RewritableBullet text={edu.description || ""}>
                <Editable
                  value={edu.description || ""}
                  onSave={upd ? (v) => {
                    const newEdu = education.map((e, ei) =>
                      ei === i
                        ? { ...e, description: v }
                        : e
                    );

                    upd({ education: newEdu });
                  } : null}
                  as="p"
                  placeholder="Education Description"
                  className="mt-1 text-gray-700"
                />
              </RewritableBullet>
            </div>
          ))}
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">Skills</h2>
          <RewritableBullet text={skills.join(" · ")}>
            <Editable
              value={skills.join(" · ")}
              onSave={upd ? (v) =>
                upd({
                  skills: v
                    .split("·")
                    .map(s => s.trim())
                    .filter(Boolean)
                })
              : null}
              className="mt-2"
            />
          </RewritableBullet>
        </section>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">Languages</h2>
          {resumeData.languages.map((lang, i) => (
            <p key={i} className="mt-1">
              {lang.language || lang.name}: {
                lang.level ? `${lang.level} (${lang.proficiency})` : lang.proficiency
              }
            </p>
          ))}
        </section>
      )}
    </article>
  );
}

// Inline-editable text element for the resume preview.
// Uses useRef so React re-renders never clobber what the user is typing.
function Editable({ value, onSave, as: Tag = "span", className, placeholder }) {
  const ref = useRef(null);
  const committed = useRef(value ?? "");

  useEffect(() => {
    if (ref.current && committed.current !== (value ?? "")) {
      ref.current.innerText = value ?? "";
      committed.current = value ?? "";
    }
  }, [value]);

  if (!onSave) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e) => {
        const v = (e.currentTarget.innerText ?? "").trim();
        committed.current = v;
        if (v !== (value ?? "").trim()) onSave(v);
      }}
      className={`resume-editable outline-none focus:bg-yellow-50/80 focus:ring-1 focus:ring-yellow-300 focus:rounded-sm cursor-text ${className ?? ""}`}
    >
      {value || ""}
    </Tag>
  );
}

function flattenSkills(skills) {
  if (!skills) return [];
  if (typeof skills === "string") return [skills];
  if (Array.isArray(skills)) {
    return skills.flatMap((s) => {
      if (typeof s === "string") return [s];
      if (s && typeof s === "object") {
        const vals = Object.values(s);
        return vals.flatMap((v) =>
          Array.isArray(v) ? v.map(String) : [String(v)]
        );
      }
      return [];
    });
  }
  if (typeof skills === "object") {
    return Object.values(skills).flatMap((v) =>
      Array.isArray(v) ? v.map(String) : [String(v)]
    );
  }
  return [];
}