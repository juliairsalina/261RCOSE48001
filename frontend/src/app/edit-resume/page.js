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
  const [jobSummary, setJobSummary] = useState(null);

  const [metrics, setMetrics] = useState({
    clarity: 0,
    keywordFit: 0,
    structure: 0,
    impact: 0,
  });
  const [metricHints, setMetricHints] = useState({
    clarity: "",
    keywordFit: "",
    structure: "",
    impact: "",
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
    const savedUserId = localStorage.getItem("reeracifyUserId");
    if (savedUserId) setUserId(savedUserId);

    const savedResumeId = localStorage.getItem("reeracifyResumeId");
    if (savedResumeId) setResumeId(savedResumeId);

    const savedAppId = localStorage.getItem("reeracifyApplicationId");
    if (savedAppId) setApplicationId(savedAppId);

    const savedProfile = localStorage.getItem("reeracifyCandidateProfile");
    if (savedProfile) {
      try { setCandidateProfile(JSON.parse(savedProfile)); } catch {}
    }

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
          leadership: (parsed.leadership || []).map(l => ({
            title: l.title || "",
            organization: l.organization || "",
            start_date: l.start_date || "",
            end_date: l.end_date || "",
            description: l.description || "",
            bullets: l.bullets || [],
          })),

          achievements: (parsed.achievements || []).map(a => ({
            title: a.title || "",
            date: a.date || "",
            description: a.description || "",
          })),

          certifications: (parsed.certifications || []).map(c => ({
            name: c.name || "",
            issuer: c.issuer || "",
            date: c.date || "",
            description: c.description || "",
          })),
        });
      } catch (e) {
        console.warn("Could not parse saved resume:", e);
      }
    }
  }, []);


  useEffect(() => {
    if (!applicationId || coverLetterText) return;
    fetch(`${API_BASE_URL}/cover-letters/${applicationId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.content) setCoverLetterText(data.content);
      })
      .catch(() => {});
  }, [applicationId]);

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

  function applyAnalysisResult(result, jobPost) {
    saveSnapshot();
    const ats = result.ats || {};
    const score = ats.score || 0;
    setAtsScoreValue(score);
    setResumeLevel(getRankLabel(ats.rank));
    setJobSummary(jobPost);

    const matched = ats.matched_skills?.length || 0;
    const missing = ats.missing_skills?.length || 0;
    const total = matched + missing || 1;
    setMetrics({
      clarity: Math.max(0, 100 - (ats.weaknesses?.length || 0) * 15),
      keywordFit: Math.round((matched / total) * 100),
      structure: score,
      impact: Math.min(100, (ats.strengths?.length || 0) * 20),
    });

    setMetricHints({
      clarity: ats.weaknesses?.[0] || (ats.weaknesses?.length === 0 ? "No major clarity issues detected." : ""),
      keywordFit: missing > 0
        ? `Missing: ${(ats.missing_skills || []).slice(0, 3).join(", ")}${missing > 3 ? ` +${missing - 3} more` : ""}.`
        : matched > 0 ? `All key skills matched (${matched} found).` : "",
      structure: ats.improvement_priority?.[0] || (score >= 80 ? "Strong overall structure." : ""),
      impact: ats.strengths?.[0] || (ats.strengths?.length === 0 ? "Add more measurable outcomes to bullet points." : ""),
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
      // Auto-generate career profile if not yet available
      await ensureCandidateProfile(uid, rid);

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

      // LangGraph pipeline: analyze_job → retrieve → research → (ATS ∥ cover letter) → rewrites
      const result = await streamAnalysis(appId, uid, (step) => setLoadingState(step));

      applyAnalysisResult(result, jobPost);

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
    const rewrite = rewriteList.find((s) => s.id === suggestionId);
    try {
      await callBackend(`/rewrite-suggestions/${suggestionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      });
      setRewriteList((prev) =>
        prev.map((s) => s.id === suggestionId ? { ...s, status: "approved" } : s)
      );
      if (rewrite) {
        setResumeData((prev) => applyRewriteToResume(rewrite, prev));
      }
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

  function downloadCoverLetterPDF() {
    const name = resumeData.name || "";
    const phone = resumeData.phone || "";
    const email = resumeData.email || "";

    const printEl = document.createElement("div");
    printEl.id = "cover-letter-print";

    const nameEl = document.createElement("div");
    nameEl.textContent = name;
    nameEl.style.cssText = "font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #111; margin-bottom: 4px;";

    const contactEl = document.createElement("div");
    contactEl.textContent = [phone, email].filter(Boolean).join("   |   ");
    contactEl.style.cssText = "font-family: Arial, sans-serif; font-size: 11px; color: #444; margin-bottom: 16px;";

    const hr = document.createElement("hr");
    hr.style.cssText = "border: none; border-top: 1px solid #ccc; margin-bottom: 20px;";

    const bodyEl = document.createElement("div");
    bodyEl.textContent = coverLetterText;
    bodyEl.style.cssText = "font-family: Arial, sans-serif; font-size: 11px; line-height: 1.75; white-space: pre-wrap; color: #111;";

    printEl.appendChild(nameEl);
    printEl.appendChild(contactEl);
    printEl.appendChild(hr);
    printEl.appendChild(bodyEl);

    document.body.appendChild(printEl);
    document.body.classList.add("printing-cover");

    const restore = () => {
      document.body.classList.remove("printing-cover");
      printEl.remove();
    };
    window.addEventListener("afterprint", restore, { once: true });
    setTimeout(() => window.print(), 50);
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
      // Auto-generate career profile if not yet available
      await ensureCandidateProfile(uid, rid);

      setLoadingState(`Analyzing fit for ${job.role_title} at ${job.company_name}…`);
      setVacancyLink(job.job_url);

      const app = await callBackend("/applications/create", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, resume_id: rid, job_post_id: job.job_post_id }),
      });
      const appId = app.id;
      setApplicationId(appId);
      localStorage.setItem("reeracifyApplicationId", appId);

      // LangGraph pipeline: analyze_job → retrieve → research → (ATS ∥ cover letter) → rewrites
      const result = await streamAnalysis(appId, uid, (step) => setLoadingState(step));
      applyAnalysisResult(result, job);

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
      localStorage.setItem("reeracifyCandidateProfile", JSON.stringify(result.profile));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setCandidateProfileLoading(false);
    }
  }

  // Called at the start of Analyze — generates profile silently if not already available.
  async function ensureCandidateProfile(uid, rid) {
    if (candidateProfile) return;
    const saved = localStorage.getItem("reeracifyCandidateProfile");
    if (saved) {
      try {
        setCandidateProfile(JSON.parse(saved));
        return;
      } catch {}
    }
    setLoadingState("Generating career profile...");
    const formData = new FormData();
    formData.append("user_id", uid);
    const result = await callBackend(`/resumes/${rid}/candidate-profile`, {
      method: "POST",
      body: formData,
    });
    setCandidateProfile(result.profile);
    localStorage.setItem("reeracifyCandidateProfile", JSON.stringify(result.profile));
  }

  async function searchJobsFromProfile() {
    setActiveTab("find-jobs");
    await findJobs();
  }

  // Convert frontend resumeData shape → backend resume_json shape for DOCX export.
  function toResumeJson(rd) {
    return {
      name: rd.name || "",
      email: rd.email || "",
      phone: rd.phone || "",
      summary: rd.summary || "",
      skills: rd.skills || [],
      education: (rd.education || []).map(e => ({
        institution: e.school || e.institution || "",
        degree: e.degree || "",
        field_of_study: e.field_of_study || e.field || "",
        start_date: e.start_date || "",
        end_date: e.end_date || "",
        gpa: e.gpa || "",
        description: e.description || "",
      })),
      work_experience: (rd.experience || []).map(e => ({
        title: e.role || "",
        company: e.company || e.organization || "",
        location: e.location || "",
        start_date: e.start_date || "",
        end_date: e.end_date === "Present" ? "" : (e.end_date || ""),
        is_current: e.end_date === "Present",
        description: e.description || "",
        bullets: e.bullets || [],
      })),
      projects: (rd.projects || []).map(p => ({
        name: p.name || "",
        description: p.description || "",
        technologies: p.technologies || [],
        bullets: p.bullets || [],
        start_date: p.start_date || "",
        end_date: p.end_date || "",
      })),
      leadership: (rd.leadership || []).map(l => ({
        title: l.title || "",
        organization: l.organization || "",
        start_date: l.start_date || "",
        end_date: l.end_date || "",
        description: l.description || "",
        bullets: l.bullets || [],
      })),
      achievements: (rd.achievements || []).map(a => ({
        title: a.title || "",
        date: a.date || "",
        description: a.description || "",
      })),
      certifications: (rd.certifications || []).map(c => ({
        name: c.name || "",
        issuer: c.issuer || "",
        date: c.date || "",
        description: c.description || "",
      })),
      languages: (rd.languages || []).map(l => ({
        language: l.language || l.name || "",
        proficiency: l.proficiency || l.level || "",
      })),
    };
  }

  function downloadResume() {
    if (!resumeData) {
      setErrorMessage("No resume loaded.");
      return;
    }

    const resume = document.getElementById("resume-a4");
    if (!resume) return;

    const parent = resume.parentNode;
    const placeholder = document.createComment("resume-print-placeholder");
    const originalTransform = resume.style.transform;

    // Move resume to body root and mark body so print CSS targets it cleanly
    parent.insertBefore(placeholder, resume);
    resume.style.transform = "none";
    document.body.appendChild(resume);
    document.body.classList.add("printing");

    const restore = () => {
      document.body.classList.remove("printing");
      resume.style.transform = originalTransform;
      parent.insertBefore(resume, placeholder);
      placeholder.remove();
    };

    // afterprint fires when the print dialog closes (save or cancel)
    window.addEventListener("afterprint", restore, { once: true });

    // Small delay so browser applies CSS before opening print dialog
    setTimeout(() => window.print(), 50);
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
                    Download PDF
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
                <div className="mt-3 space-y-2">
                  {statusMessage && (
                    <p className="rounded-2xl bg-white/55 px-4 py-2 text-xs font-bold text-[#243026]/65">
                      {statusMessage}
                    </p>
                  )}

                  {errorMessage && (
                    <p className="rounded-2xl bg-red-100 px-4 py-2 text-xs font-bold text-red-700">
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
              {["analysis", "rewrites", "cover-letter", "profile", "find-jobs"].map((tab) => (
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
                      <MetricBox title="Clarity" value={metrics.clarity} hint={metricHints.clarity} />
                      <MetricBox title="Keyword" value={metrics.keywordFit} hint={metricHints.keywordFit} />
                      <MetricBox title="Structure" value={metrics.structure} hint={metricHints.structure} />
                      <MetricBox title="Impact" value={metrics.impact} hint={metricHints.impact} />
                    </div>
                  </section>

                  {jobSummary && (
                    <section className="border-b border-[#243026]/10 py-5">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#243026]/40">
                        Job Summary
                      </p>
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-black text-[#243026]">
                          {jobSummary.role_title || "Role"}
                          {jobSummary.company_name ? ` · ${jobSummary.company_name}` : ""}
                        </p>
                        {jobSummary.location && (
                          <p className="text-xs text-[#243026]/50">{jobSummary.location}</p>
                        )}
                        {jobSummary.job_description && (
                          <p className="mt-2 text-xs leading-5 text-[#243026]/65">
                            {jobSummary.job_description.replace(/\s+/g, " ").slice(0, 220).trim()}
                            {jobSummary.job_description.length > 220 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    </section>
                  )}

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
                    [...rewriteList].sort((a, b) => {
                      const order = ["work_experience", "projects", "leadership", "achievements", "certifications"];
                      const ai = order.indexOf(a.section);
                      const bi = order.indexOf(b.section);
                      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                    }).map((s) => (
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
                      <div className="flex gap-2">
                      <button
                        onClick={downloadCoverLetterPDF}
                        className="flex-1 rounded-[1.2rem] border border-[#243026]/20 bg-[#243026] py-3 text-xs font-black text-white transition hover:opacity-90"
                      >
                        Download as PDF
                      </button>
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
                        className="flex-1 rounded-[1.2rem] border border-[#243026]/20 bg-white/50 py-3 text-xs font-black text-[#243026] transition hover:bg-white/80"
                      >
                        Download as .txt
                      </button>
                      </div>
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

function MetricBox({ title, value, hint }) {
  return (
    <div className="rounded-[1.1rem] border border-white/45 bg-white/35 p-3">
      <p className="text-[11px] font-bold text-[#243026]/50">{title}</p>
      <p className="mt-1 text-lg font-black text-[#243026]">{value}</p>
      {hint && (
        <p className="mt-1.5 text-[10px] leading-[1.4] text-[#243026]/50">{hint}</p>
      )}
    </div>
  );
}

function ResumeDocument({ resumeData, rewriteList = [], activeRewriteId, onRewriteClick, onDataChange }) {
  // Defined locally — top-level imports are not visible across Turbopack chunk boundaries
  const cleanBullet = (text) =>
    typeof text === "string" ? text.replace(/^[◆●•▪▫–—\-\*►▶•◆■▶→\s]+/, "").trim() : text;

  const rewriteMap = useMemo(() => {
    const m = new Map();
    for (const rw of rewriteList) {
      if (rw.original_text) {
        // Index by cleaned original so pre-approval bullets match
        m.set(cleanBullet(rw.original_text), rw);
      }
      // Also index by suggested_text so the bullet stays highlighted (green) after approval
      if (rw.status === "approved" && rw.suggested_text) {
        m.set(cleanBullet(rw.suggested_text), rw);
      }
    }
    return m;
  }, [rewriteList]); // cleanBullet is a stable inline const — not a reactive dep

  function matchRewrite(text) {
    if (!text) return null;
    const t = cleanBullet(text);
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
  const leadership = resumeData.leadership || [];
  const achievements = resumeData.achievements || [];
  const certifications = resumeData.certifications || [];
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
          {upd && (
            <button
              onClick={() => upd({ experience: [...experience, { role: "", company: "", start_date: "", end_date: "", bullets: [""] }] })}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 print:hidden"
            >+ Add experience</button>
          )}
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
                      <RewritableBullet text={cleanBullet(b)}>
                        <Editable
                          value={cleanBullet(b)}
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
          {upd && (
            <button
              onClick={() => upd({ projects: [...projects, { name: "", start_date: "", end_date: "", bullets: [""] }] })}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 print:hidden"
            >+ Add project</button>
          )}
          {projects.map((proj, i) => (
            <div key={i} className="mt-3">
              <div className="flex justify-between">
                <Editable
                  value={proj.name || proj.title || ""}
                  onSave={upd ? (v) => {
                    const newProj = projects.map((p, pi) => pi === i ? { ...p, name: v } : p);
                    upd({ projects: newProj });
                  } : null}
                  onAdd={upd ? (currentVal) => {
                    const newProj = projects.map((p, pi) =>
                      pi === i ? { ...p, name: currentVal, description: "" } : p
                    );
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
              {"description" in proj && (
                <DescriptionBullets
                  description={proj.description}
                  onChange={upd ? (v) => {
                    upd({ projects: projects.map((p, pi) => pi === i ? { ...p, description: v } : p) });
                  } : null}
                  onRemoveAll={upd ? () => {
                    upd({ projects: projects.map((p, pi) => {
                      if (pi !== i) return p;
                      const { description: _, ...rest } = p;
                      return rest;
                    }) });
                  } : null}
                  placeholder="Describe this project..."
                />
              )}
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
                      <RewritableBullet text={cleanBullet(b)}>
                        <Editable
                          value={cleanBullet(b)}
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

      {/* Leadership */}
      {leadership.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
            Leadership
          </h2>
          {upd && (
            <button
              onClick={() => upd({ leadership: [...leadership, { title: "", organization: "", start_date: "", end_date: "", bullets: [] }] })}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 print:hidden"
            >+ Add leadership</button>
          )}

          {leadership.map((item, i) => (
            <div key={i} className="mt-2">

              <div className="flex justify-between">

                <div>

                  <Editable
                    value={item.title || ""}
                    onSave={upd ? (v) => {
                      const newLeadership = leadership.map((l, li) =>
                        li === i ? { ...l, title: v } : l
                      );
                      upd({ leadership: newLeadership });
                    } : null}
                    className="font-bold"
                  />

                  <Editable
                    value={item.organization || ""}
                    onSave={upd ? (v) => {
                      const newLeadership = leadership.map((l, li) =>
                        li === i ? { ...l, organization: v } : l
                      );
                      upd({ leadership: newLeadership });
                    } : null}
                    className="text-gray-600"
                  />

                </div>

                <div className="text-gray-500 text-right shrink-0 ml-2">

                  <Editable
                    value={item.start_date || ""}
                    onSave={upd ? (v) => {
                      const newLeadership = leadership.map((l, li) =>
                        li === i
                          ? { ...l, start_date: v }
                          : l
                      );

                      upd({ leadership: newLeadership });
                    } : null}
                    placeholder="Start Date"
                  />

                  <span> – </span>

                  <Editable
                    value={item.end_date || ""}
                    onSave={upd ? (v) => {
                      const newLeadership = leadership.map((l, li) =>
                        li === i
                          ? { ...l, end_date: v }
                          : l
                      );

                      upd({ leadership: newLeadership });
                    } : null}
                    placeholder="End Date"
                  />

                </div>

              </div>

              {(item.bullets || []).length > 0 && (
                <ul className="mt-1.5 list-disc pl-5">
                  {item.bullets.map((b, j) => (
                    <li key={j}>
                      <RewritableBullet text={cleanBullet(b)}>
                        <Editable
                          value={cleanBullet(b)}
                          onSave={upd ? (v) => {
                            const newLeadership = leadership.map((l, li) => {
                              if (li !== i) return l;

                              const newBullets = [...(l.bullets || [])];
                              newBullets[j] = v;

                              return {
                                ...l,
                                bullets: newBullets,
                              };
                            });

                            upd({ leadership: newLeadership });
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

      {/* Achievements */}
      {achievements.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
            Achievements
          </h2>

          {upd && (
            <button
              onClick={() => upd({ achievements: [...achievements, { title: "", date: "" }] })}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 print:hidden"
            >+ Add achievement</button>
          )}
          {achievements.map((a, i) => (
            <div key={i} className="mt-2">

              <div className="flex justify-between">

                <Editable
                  value={a.title || ""}
                  onSave={upd ? (v) => {
                    const newAchievements = achievements.map((a2, ai) =>
                      ai === i ? { ...a2, title: v } : a2
                    );
                    upd({ achievements: newAchievements });
                  } : null}
                  onAdd={upd ? (currentVal) => {
                    const newAchievements = achievements.map((a2, ai) =>
                      ai === i ? { ...a2, title: currentVal, description: "" } : a2
                    );
                    upd({ achievements: newAchievements });
                  } : null}
                  as="h3"
                  className="font-bold"
                />

                <Editable
                  value={a.date || ""}
                  onSave={upd ? (v) => {
                    const newAchievements = achievements.map((a2, ai) =>
                      ai === i ? { ...a2, date: v } : a2
                    );
                    upd({ achievements: newAchievements });
                  } : null}
                  as="span"
                  placeholder="Date"
                  className="text-gray-500 shrink-0 ml-2"
                />

              </div>

              {"description" in a && (
                <DescriptionBullets
                  description={a.description}
                  onChange={upd ? (v) => {
                    upd({ achievements: achievements.map((a2, ai) => ai === i ? { ...a2, description: v } : a2) });
                  } : null}
                  onRemoveAll={upd ? () => {
                    upd({ achievements: achievements.map((a2, ai) => {
                      if (ai !== i) return a2;
                      const { description: _, ...rest } = a2;
                      return rest;
                    }) });
                  } : null}
                  placeholder="Describe this achievement..."
                />
              )}

            </div>
          ))}
        </section>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
            Certifications
          </h2>
          {upd && (
            <button
              onClick={() => upd({ certifications: [...certifications, { name: "", issuer: "", date: "" }] })}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 print:hidden"
            >+ Add certification</button>
          )}

          {certifications.map((c, i) => (
            <div key={i} className="mt-2">

              <div className="flex justify-between">

                <div>

                  <Editable
                    value={c.name || ""}
                    onSave={upd ? (v) => {
                      const newCerts = certifications.map((c2, ci) =>
                        ci === i ? { ...c2, name: v } : c2
                      );
                      upd({ certifications: newCerts });
                    } : null}
                    onAdd={upd ? (currentVal) => {
                      const newCerts = certifications.map((c2, ci) =>
                        ci === i ? { ...c2, name: currentVal, description: "" } : c2
                      );
                      upd({ certifications: newCerts });
                    } : null}
                    as="h3"
                    className="font-bold"
                  />

                  <Editable
                    value={c.issuer || ""}
                    onSave={upd ? (v) => {
                      const newCerts = certifications.map((c2, ci) =>
                        ci === i ? { ...c2, issuer: v } : c2
                      );
                      upd({ certifications: newCerts });
                    } : null}
                    as="p"
                    className="text-gray-600"
                  />

                </div>

                <Editable
                  value={c.date || ""}
                  onSave={upd ? (v) => {
                    const newCerts = certifications.map((c2, ci) =>
                      ci === i ? { ...c2, date: v } : c2
                    );
                    upd({ certifications: newCerts });
                  } : null}
                  as="span"
                  placeholder="Date"
                  className="text-gray-500 shrink-0 ml-2 min-w-[80px] text-right"
                />

              </div>

              {"description" in c && (
                <DescriptionBullets
                  description={c.description}
                  onChange={upd ? (v) => {
                    upd({ certifications: certifications.map((c2, ci) => ci === i ? { ...c2, description: v } : c2) });
                  } : null}
                  onRemoveAll={upd ? () => {
                    upd({ certifications: certifications.map((c2, ci) => {
                      if (ci !== i) return c2;
                      const { description: _, ...rest } = c2;
                      return rest;
                    }) });
                  } : null}
                  placeholder="Describe this certification..."
                />
              )}

            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">Education</h2>
          {upd && (
            <button
              onClick={() => upd({ education: [...education, { school: "", degree: "", start_date: "", end_date: "" }] })}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 print:hidden"
            >+ Add education</button>
          )}
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
                  {edu.field_of_study && (
                    <RewritableBullet text={edu.field_of_study || ""}>
                      <Editable
                        value={edu.field_of_study || ""}
                        onSave={upd ? (v) => {
                          const newEdu = education.map((e, ei) =>
                            ei === i ? { ...e, field_of_study: v } : e
                          );
                          upd({ education: newEdu });
                        } : null}
                        onDelete={upd ? () => {
                          const newEdu = education.map((e, ei) =>
                            ei === i ? { ...e, field_of_study: "" } : e
                          );
                          upd({ education: newEdu });
                        } : null}
                        as="p"
                        placeholder="Field of Study"
                        className="text-gray-600"
                      />
                    </RewritableBullet>
                  )}
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
              {edu.gpa && (
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
                    onDelete={upd ? () => {
                      const newEdu = education.map((e, ei) =>
                        ei === i ? { ...e, gpa: "" } : e
                      );
                      upd({ education: newEdu });
                    } : null}
                    placeholder="3.86/4.00"
                  />
                </p>
              )}
              {(edu.coursework || []).length > 0 && (
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
                    onDelete={upd ? () => {
                      const newEdu = education.map((e, ei) =>
                        ei === i ? { ...e, coursework: [] } : e
                      );
                      upd({ education: newEdu });
                    } : null}
                    as="p"
                    placeholder="Relevant Coursework (AI, Machine Learning, Databases)"
                    className="mt-1 text-gray-700"
                  />
                </RewritableBullet>
              )}
              {"description" in edu && (
                <RewritableBullet text={edu.description || ""}>
                  <Editable
                    value={edu.description || ""}
                    onSave={upd ? (v) => {
                      const newEdu = education.map((e, ei) =>
                        ei === i ? { ...e, description: v } : e
                      );
                      upd({ education: newEdu });
                    } : null}
                    onDelete={upd ? () => {
                      const newEdu = education.map((e, ei) => {
                        if (ei !== i) return e;
                        const { description: _, ...rest } = e;
                        return rest;
                      });
                      upd({ education: newEdu });
                    } : null}
                    as="p"
                    placeholder="Education Description"
                    className="mt-1 text-gray-700"
                  />
                </RewritableBullet>
              )}
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

// Multi-line bullet description for achievements, certifications, projects.
// Stores content as a "\n"-joined string; each line renders as a <li> bullet.
function DescriptionBullets({ description, onChange, onRemoveAll, placeholder }) {
  const lines = (description ?? "").split("\n");
  const display = lines.length > 0 ? lines : [""];
  // Track which bullet index should auto-focus after a state update.
  // Use a ref so it survives re-renders without causing extra renders itself.
  const focusIdxRef = useRef(description === "" ? 0 : null);

  if (!onChange) {
    const filled = lines.filter(l => l.trim());
    return filled.length > 0 ? (
      <ul className="mt-1 list-disc pl-5 text-gray-700">
        {filled.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    ) : null;
  }

  return (
    <ul className="mt-1 list-disc pl-5 text-gray-700">
      {display.map((line, idx) => (
        <li key={idx}>
          <Editable
            value={line}
            shouldFocus={idx === focusIdxRef.current}
            onFocused={() => { focusIdxRef.current = null; }}
            onSave={(v) => {
              const next = [...display];
              next[idx] = v;
              onChange(next.join("\n"));
            }}
            onAdd={(currentVal) => {
              focusIdxRef.current = idx + 1;
              const next = [...display];
              next[idx] = currentVal;
              next.splice(idx + 1, 0, "");
              onChange(next.join("\n"));
            }}
            onDelete={() => {
              if (display.length === 1) {
                onRemoveAll?.();
              } else {
                focusIdxRef.current = Math.max(0, idx - 1);
                onChange(display.filter((_, li) => li !== idx).join("\n"));
              }
            }}
            placeholder={idx === 0 ? placeholder : ""}
          />
        </li>
      ))}
    </ul>
  );
}

// Inline-editable text element for the resume preview.
// Uses useRef so React re-renders never clobber what the user is typing.
function Editable({ value, onSave, onDelete, onAdd, shouldFocus, onFocused, as: Tag = "span", className, placeholder }) {
  const ref = useRef(null);
  const committed = useRef(value ?? "");
  const onFocusedRef = useRef(onFocused);
  onFocusedRef.current = onFocused;

  useEffect(() => {
    if (ref.current && committed.current !== (value ?? "")) {
      ref.current.innerText = value ?? "";
      committed.current = value ?? "";
    }
  }, [value]);

  useEffect(() => {
    if (shouldFocus && ref.current) {
      ref.current.focus();
      // Place cursor at end of content
      const el = ref.current;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      onFocusedRef.current?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFocus]);

  if (!onSave) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !e.currentTarget.innerText.trim() && onDelete) {
          e.preventDefault();
          onDelete();
        }
        if (e.key === "Enter" && onAdd) {
          e.preventDefault();
          const v = (e.currentTarget.innerText ?? "").trim();
          committed.current = v;
          onAdd(v);
        } else if (e.key === "Enter") {
          e.preventDefault();
        }
      }}
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

function applyRewriteToResume(rewrite, rd) {
  const section = (rewrite.section || "").toLowerCase();
  const original = (rewrite.original_text || "").trim();
  const suggested = rewrite.suggested_text || "";
  if (!original || !suggested) return rd;

  const replaceBullets = (bullets) =>
    (bullets || []).map((b) => {
      const clean = typeof b === "string" ? b.replace(/^[◆●•▪▫–—\-\*►▶•◆■▶→\s]+/, "").trim() : b;
      return clean === original ? suggested : b;
    });

  const replaceDesc = (desc) =>
    typeof desc === "string" ? desc.replace(original, suggested) : desc;

  if (["summary", "profile", "objective"].includes(section)) {
    return { ...rd, summary: replaceDesc(rd.summary) };
  }
  if (["skills", "skill"].includes(section)) {
    return { ...rd, skills: (rd.skills || []).map((s) => (s === original ? suggested : s)) };
  }
  if (["work_experience", "experience", "work experience"].includes(section)) {
    return {
      ...rd,
      experience: (rd.experience || []).map((e) => ({
        ...e,
        bullets: replaceBullets(e.bullets),
        description: replaceDesc(e.description),
      })),
    };
  }
  if (["projects", "project"].includes(section)) {
    return {
      ...rd,
      projects: (rd.projects || []).map((p) => ({
        ...p,
        bullets: replaceBullets(p.bullets),
        description: replaceDesc(p.description),
      })),
    };
  }
  if (section === "leadership") {
    return {
      ...rd,
      leadership: (rd.leadership || []).map((l) => ({
        ...l,
        bullets: replaceBullets(l.bullets),
        description: replaceDesc(l.description),
      })),
    };
  }
  if (["achievements", "achievement"].includes(section)) {
    return {
      ...rd,
      achievements: (rd.achievements || []).map((a) => ({
        ...a,
        description: replaceDesc(a.description),
      })),
    };
  }
  if (section === "education") {
    return {
      ...rd,
      education: (rd.education || []).map((e) => ({
        ...e,
        description: replaceDesc(e.description),
      })),
    };
  }
  return rd;
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