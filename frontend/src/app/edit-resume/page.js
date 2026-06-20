"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCcw,

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
  const [zoom, setZoom] = useState(0.82);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const scrollContainerRef = useRef(null);

  const UI = {
  heading: "text-[2rem] font-black tracking-tight text-white",
  subheading: "text-xl font-black uppercase tracking-[0.24em] text-white/88",
  body: "text-sm font-medium leading-7 text-white/75",
  bodyStrong: "text-sm font-bold text-white",
  tab: "text-sm font-black",
  line: "border-white/22",
  lineStrong: "border-white/30",
  glass: "border border-white/18 bg-white/10 backdrop-blur-xl",
  glassSoft: "border border-white/16 bg-white/12 backdrop-blur-xl",
};

//Dummy data
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

  
  const [backendSuggestions, setBackendSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState("summary");

  const [isLoading, setIsLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Backend session state
  const [userId, setUserId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [applicationId, setApplicationId] = useState("");

  // Right panel tab
  const [activeTab, setActiveTab] = useState("analysis");
  const [profileOpen, setProfileOpen] = useState(false);

  // Rewrites tab
  const [rewriteList, setRewriteList] = useState([]);

  // Cover letter tab
  const [coverLetterText, setCoverLetterText] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterWordLimit, setCoverLetterWordLimit] = useState("");

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
  const [redoState, setRedoState] = useState(null);

  const [vacancyLink, setVacancyLink] = useState("");
  const vacancyLinkRef = useRef("");
  const [atsScoreValue, setAtsScoreValue] = useState(0);
  const [resumeLevel, setResumeLevel] = useState("Waiting for evaluation");
  const [jobSummary, setJobSummary] = useState(
  "Paste a vacancy link and upload a resume to generate job-based evaluation."
);
  const [jobDescription, setJobDescription] = useState("");
  const [metrics, setMetrics] = useState({
    clarity: 0,
    keywordFit: 0,
    structure: 0,
    impact: 0,
  });
  const [metricComments, setMetricComments] = useState({
    clarity: "",
    keywordFit: "",
    structure: "",
    impact: "",
  });
  const [missingSkills, setMissingSkills] = useState([]);

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

    setRedoState({
      resumeData: JSON.parse(JSON.stringify(resumeData)),
      atsScoreValue,
      resumeLevel,
      metrics: { ...metrics },
      backendSuggestions: [...backendSuggestions],
      rewriteList: [...rewriteList],
    });

    setResumeData(previousState.resumeData);
    setAtsScoreValue(previousState.atsScoreValue);
    setResumeLevel(previousState.resumeLevel);
    setMetrics(previousState.metrics);
    setBackendSuggestions(previousState.backendSuggestions);
    setRewriteList(previousState.rewriteList);
    setPreviousState(null);
  }

  function redoChanges() {
  if (!redoState) return;

  setPreviousState({
    resumeData: JSON.parse(JSON.stringify(resumeData)),
    atsScoreValue,
    resumeLevel,
    metrics: { ...metrics },
    backendSuggestions: [...backendSuggestions],
    rewriteList: [...rewriteList],
  });

  setResumeData(redoState.resumeData);
  setAtsScoreValue(redoState.atsScoreValue);
  setResumeLevel(redoState.resumeLevel);
  setMetrics(redoState.metrics);
  setBackendSuggestions(redoState.backendSuggestions);
  setRewriteList(redoState.rewriteList);
  setRedoState(null);
}

  const suggestions = backendSuggestions || [];

  const currentSuggestion =
    suggestions.find((item) => item.id === activeSuggestion) || suggestions[0];

  useEffect(() => {
    const savedVacancyLink = localStorage.getItem("reeracifyVacancyLink");
    if (savedVacancyLink) {
      vacancyLinkRef.current = savedVacancyLink;
      setVacancyLink(savedVacancyLink);
      setJobSummary("Vacancy link loaded. Click Evaluate to analyze it.");
    }

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
    if (vacancyLink) {
      localStorage.setItem("reeracifyVacancyLink", vacancyLink);
    }
  }, [vacancyLink]);

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

  // Recalculate page count and current page whenever zoom or content changes
  useEffect(() => {
    const PAGE_H = 1123; // A4 height in px at 100% zoom

    function update() {
      const resumeEl = document.getElementById("resume-a4");
      const scrollEl = scrollContainerRef.current;
      if (!resumeEl || !scrollEl) return;

      const scaledH = resumeEl.scrollHeight * zoom;
      const pages = Math.max(1, Math.ceil(scaledH / (PAGE_H * zoom)));
      setTotalPages(pages);

      const scrollTop = scrollEl.scrollTop;
      const page = Math.min(pages, Math.floor(scrollTop / (PAGE_H * zoom)) + 1);
      setCurrentPage(page);
    }

    update();

    const scrollEl = scrollContainerRef.current;
    scrollEl?.addEventListener("scroll", update, { passive: true });

    const ro = new ResizeObserver(update);
    const resumeEl = document.getElementById("resume-a4");
    if (resumeEl) ro.observe(resumeEl);

    return () => {
      scrollEl?.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [zoom, resumeData]);

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
  async function streamAnalysis(appId, uid, onStep, resumeJson = null) {
    const response = await fetch(`${API_BASE_URL}/applications/${appId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, ...(resumeJson ? { resume_json: resumeJson } : {}) }),
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
    const clarityVal = Math.max(0, 100 - (ats.weaknesses?.length || 0) * 15);
    const keywordVal = Math.round((matched / total) * 100);
    const impactVal = Math.min(100, (ats.strengths?.length || 0) * 20);
    setMetrics({
      clarity: clarityVal,
      keywordFit: keywordVal,
      structure: score,
      impact: impactVal,
    });

    setMissingSkills(ats.missing_skills || []);
    const missingList = (ats.missing_skills || []).slice(0, 3);
    const matchedList = (ats.matched_skills || []).slice(0, 3);
    const topWeakness = (ats.weaknesses || [])[0] || "";
    const topStrength = (ats.strengths || [])[0] || "";
    const topPriority = (ats.improvement_priority || [])[0] || "";

    setMetricComments({
      clarity: clarityVal >= 85
        ? "Your resume is clear and well-structured with minimal gaps."
        : clarityVal === 0
        ? `Too many gaps for this role (${(ats.weaknesses || []).length} missing requirements). Top gap: ${topWeakness || "see weaknesses below"}.`
        : topWeakness
        ? `Area to improve: ${topWeakness}`
        : "Reduce vague language and add more specific, measurable details.",
      keywordFit: missingList.length > 0
        ? `Missing keywords: ${missingList.join(", ")}. Add these to your skills or experience.`
        : matchedList.length > 0
        ? `Strong keyword match — found: ${matchedList.join(", ")}.`
        : "Paste a job vacancy URL to get a precise keyword match score.",
      structure: topPriority
        ? `Top priority: ${topPriority}`
        : score >= 80
        ? "Resume structure aligns well with the job requirements."
        : "Ensure all key sections (summary, skills, experience) are present and complete.",
      impact: impactVal >= 80
        ? topStrength
          ? `Key strength: ${topStrength}`
          : "Your resume demonstrates strong measurable impact."
        : "Add bullet points with quantifiable results (numbers, %, improvements) to raise impact.",
    });

    const atsSuggestions = [
      ...(ats.weaknesses || []).map((w, i) => ({
        id: `weak-${i}`, type: "Weakness",
        text: w,
      })),
    ];
    setBackendSuggestions(atsSuggestions);
    if (atsSuggestions.length > 0) setActiveSuggestion(atsSuggestions[0].id);

    setRewriteList(result.suggestions || []);
    if (result.cover_letter) setCoverLetterText(result.cover_letter);

    setIsLoading(false);
    setHasAnalyzed(true);
    setStatusMessage(`Analysis complete — ATS score: ${score}/100`);
    setActiveTab("rewrites");
  }

  async function evaluateResume() {
    if (!resumeId) {
      setErrorMessage("Please upload your resume on the home page first.");
      return;
    }

    // Clear stale results from the previous evaluation immediately so the UI
    // never shows old data alongside the new evaluation's loading state.
    setJobDescription("");
    setRewriteList([]);
    setBackendSuggestions([]);
    setCoverLetterText("");
    setAtsScoreValue(0);
    setResumeLevel("Waiting for evaluation");
    setMetrics({ clarity: 0, keywordFit: 0, structure: 0, impact: 0 });
    setMetricComments({ clarity: "", keywordFit: "", structure: "", impact: "" });
    setMissingSkills([]);
    setHasAnalyzed(false);
    setJobSummary("Evaluating...");

    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    const rid = resumeId || localStorage.getItem("reeracifyResumeId") || "";

    try {
      // Auto-generate career profile if not yet available
      await ensureCandidateProfile(uid, rid);

      // Use ref to guarantee latest value regardless of closure age.
      // Don't fall back to localStorage here — an intentionally cleared field must stay empty.
      const vl = (vacancyLinkRef.current ?? vacancyLink ?? "").trim();
      if (vl) {
        localStorage.setItem("reeracifyVacancyLink", vl);
      } else {
        localStorage.removeItem("reeracifyVacancyLink");
      }
      const hasLink = vl.length > 0;
      setLoadingState(hasLink ? "Extracting job details from URL..." : "Preparing analysis...");
      const jobPost = await callBackend("/job-posts/create", {
        method: "POST",
        body: JSON.stringify({ job_url: vl, user_id: uid }),
      });

      setLoadingState("Creating application...");
      const app = await callBackend("/applications/create", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, resume_id: rid, job_post_id: jobPost.job_post_id }),
      });
      const appId = app.id;
      setApplicationId(appId);
      localStorage.setItem("reeracifyApplicationId", appId);

      // Pass current resumeData so approved rewrites are reflected in the ATS score
      const result = await streamAnalysis(appId, uid, (step) => setLoadingState(step), resumeData);

      let jobSummaryText;
      if (!hasLink) {
        jobSummaryText = "General resume evaluation — no job posting provided.";
      } else if (jobPost.role_title || jobPost.company_name) {
        jobSummaryText = `${jobPost.role_title || "Role"} at ${jobPost.company_name || "Company"}`;
      } else {
        try {
          jobSummaryText = `Job posting (${new URL(vl).hostname.replace(/^www\./, "")})`;
        } catch {
          jobSummaryText = "Job posting provided";
        }
      }
      setJobDescription(jobPost.job_description || "");
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
    const wordLimit = parseInt(coverLetterWordLimit, 10);
    setCoverLetterLoading(true);
    setErrorMessage("");
    try {
      const result = await callBackend(`/applications/${applicationId}/cover-letter`, {
        method: "POST",
        body: JSON.stringify({
          user_id: uid,
          ...(Number.isInteger(wordLimit) && wordLimit > 0 ? { word_limit: wordLimit } : {}),
        }),
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
      // Auto-generate career profile if not yet available
      await ensureCandidateProfile(uid, rid);

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

      // LangGraph pipeline: analyze_job → retrieve → research → (ATS ∥ cover letter) → rewrites
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

  function downloadResumePDF() {
    const resumeEl = document.getElementById("resume-a4");
    if (!resumeEl) return;

    // Clone and strip interactive/highlight artifacts
    const clone = resumeEl.cloneNode(true);
    clone.style.cssText =
      "transform:none !important;box-shadow:none !important;border-radius:0 !important;" +
      "background-image:none !important;width:100% !important;min-height:0 !important;" +
      "position:static !important;margin:0 !important;padding:0 !important;" +
      'font-family:Calibri,"Segoe UI",Arial,sans-serif !important;';

    clone.querySelectorAll("span").forEach((el) => {
      el.style.backgroundColor = "transparent";
      el.style.boxShadow = "none";
      el.style.outline = "none";
    });
    clone.querySelectorAll("[contenteditable]").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.style.outline = "none";
      el.style.background = "transparent";
    });
    // Remove rewrite banners, placeholder text, print:hidden elements
    clone.querySelectorAll("[data-placeholder]").forEach((el) => {
      el.removeAttribute("data-placeholder");
    });
    clone.querySelectorAll(".print\\:hidden, .resume-rewrite-banner").forEach((el) => {
      el.remove();
    });

    // Inject print frame into the SAME document so all styles/fonts are available
    const frame = document.createElement("div");
    frame.id = "__rfy_print_frame__";
    frame.style.cssText = "display:none;";
    frame.appendChild(clone);
    document.body.appendChild(frame);

    const printStyle = document.createElement("style");
    printStyle.id = "__rfy_print_style__";
    // Use display:none on all siblings instead of visibility:hidden+fixed —
    // position:fixed in print CSS repeats the element on every page, causing overlaps.
    printStyle.textContent = `
      @media print {
        @page { size: A4; margin: 16mm 20mm; }
        body > *:not(#__rfy_print_frame__) { display: none !important; }
        body { margin: 0 !important; padding: 0 !important; background: white !important; }
        #__rfy_print_frame__ {
          display: block !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
      }
    `;
    document.head.appendChild(printStyle);

    const cleanup = () => {
      document.getElementById("__rfy_print_frame__")?.remove();
      document.getElementById("__rfy_print_style__")?.remove();
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 5000); // fallback in case afterprint doesn't fire

    window.print();
  }

  function downloadCoverLetterPDF() {
    if (!coverLetterText) return;

    // Header info from current resumeData
    const name = resumeData?.name || "";
    const phone = resumeData?.phone || "";
    const email = resumeData?.email || "";
    const contactParts = [phone, email].filter(Boolean);
    const contactLine = contactParts.join("  •  ");

    // Split body into double-newline paragraphs; single newlines become <br>
    const paragraphs = coverLetterText
      .split(/\n\n+/)
      .filter((p) => p.trim())
      .map(
        (p) =>
          `<p>${p.trim().replace(/\n/g, "<br/>")}</p>`
      )
      .join("\n");

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 20mm 22mm; }
  html, body {
    margin: 0; padding: 0; background: white;
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    color: #111;
  }
  .cl-name {
    font-size: 15pt;
    font-weight: 700;
    letter-spacing: 0.01em;
    margin: 0 0 3pt 0;
  }
  .cl-contact {
    font-size: 10pt;
    color: #333;
    margin: 0 0 8pt 0;
  }
  .cl-rule {
    border: none;
    border-top: 1px solid #bbb;
    margin: 0 0 16pt 0;
  }
  .cl-body p {
    margin: 0 0 11pt 0;
    line-height: 1.55;
    text-align: justify;
  }
</style>
</head>
<body>
  ${name ? `<div class="cl-name">${name}</div>` : ""}
  ${contactLine ? `<div class="cl-contact">${contactLine}</div>` : ""}
  <hr class="cl-rule" />
  <div class="cl-body">${paragraphs}</div>
</body>
</html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 700);
  }

  async function downloadResume() {
    if (!applicationId) {
      setErrorMessage("Run Evaluate first to generate an application before downloading.");
      return;
    }
    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    try {
      setLoadingState("Preparing download...");
      const res = await fetch(`${API_BASE_URL}/applications/${applicationId}/export-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send current live resumeData so DOCX matches exactly what's displayed
        body: JSON.stringify({ user_id: uid, resume_json: toResumeJson(resumeData) }),
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

  <main
  style={{
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
  }}
  className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_8%,rgba(144,171,188,0.95)_0%,rgba(95,126,137,0.72)_22%,transparent_42%),radial-gradient(circle_at_72%_22%,rgba(184,190,137,0.72)_0%,rgba(118,137,92,0.58)_30%,transparent_56%),radial-gradient(circle_at_35%_88%,rgba(38,82,61,0.95)_0%,rgba(43,74,55,0.88)_35%,transparent_62%),linear-gradient(135deg,#425f6f_0%,#536f66_28%,#69794e_55%,#263f33_100%)] font-mono text-white"
>
  <div className="relative z-10 flex min-h-screen flex-col">

      {/* Top Navbar */}
      <header className="relative z-[999] flex h-[48px] shrink-0 items-center justify-between border-b border-white/60 bg-white/10 px-4 text-white backdrop-blur-xl">
        {/* Left: mascot close to left */}
        <div className="flex items-center">
          <img
            src="/mascot.png"
            alt="Reeracify mascot"
            className="h-12 w-12 object-contain"
          />
          <p className="py-2 text-[14px] font-bold text-white/88">
            Reeracify
          </p>
        </div>

        {/* Right: settings + profile close to right */}
          <div className="flex items-center gap-2">
              <input
                type="url"
                value={vacancyLink}
                onChange={(e) => { vacancyLinkRef.current = e.target.value; setVacancyLink(e.target.value); }}
                placeholder=" → Paste job vacancy URL here"
                className="h-8 w-[200px] rounded-xl border border-white/25 bg-white/12 px-5 text-xs font-semibold text-white outline-none backdrop-blur-xl placeholder:text-white/45 transition focus:border-white/45 focus:bg-white/18"
              />
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="h-9 w-9 overflow-hidden rounded-full border border-white/60 bg-white shadow-sm transition hover:scale-105 hover:bg-white/70"
            >
              <img
                src="/profile icon.jpg"
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </button>
          </div>
        </header>

        {/* Main content */}
        <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] gap-0 divide-x divide-white/70 px-0 py-0">
          
          {/* Resume workspace */}
          <div className="relative flex h-full min-w-0 flex-col">
            
           {/* Top action row */}
            <div className="mb-4 mt-4 flex items-center justify-center px-2">
              <div className="flex items-center gap-2">
                {!hasAnalyzed && !isLoading && (
                  <button
                    onClick={evaluateResume}
                    disabled={isLoading}
                    className="rounded-[1.2rem] bg-[#243026] px-12 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
                  >
                    Click here to evaluate your resume
                  </button>
                )}

                {isLoading && (
                  <button
                    disabled
                    className="relative overflow-hidden rounded-[1.2rem] bg-[#243026] px-30 py-3 text-sm text-sm font-black tracking-wide text-white shadow-lg transition hover:scale-[1.01] hover:border-white/60 disabled:opacity-50"
                  >
                    <span className="relative z-10 animate-pulse">
                      Agent is analyzing your resume
                    </span>
                    <span className="absolute inset-0 -translate-x-full animate-[scan_1.4s_infinite] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                  </button>
                )}

                {hasAnalyzed && !isLoading && (
                  <>
                    <button
                      onClick={undoChanges}
                      disabled={!previousState}
                      title="Undo"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/0 text-white transition hover:bg-white/40 disabled:opacity-30"
                    >
                      <ArrowLeft size={18} />
                    </button>

                    <button
                      onClick={redoChanges}
                      disabled={!redoState}
                      title="Redo"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/0 text-white transition hover:bg-white/40 disabled:opacity-30"
                    >
                      <ArrowLeft size={18} className="rotate-180" />
                    </button>

                    <button
                      onClick={downloadResumePDF}
                      title="Download PDF"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/0 text-white transition hover:bg-white/40"
                    >
                      <Download size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {(statusMessage || errorMessage) && (
              <div className="mb-4 px-2">
                {statusMessage && (
                  <p className="text-xs font-bold text-[#243026]/60">
                    {statusMessage}
                  </p>
                )}

                {errorMessage && (
                  <p className="mt-2 text-xs font-bold text-red-600">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}

            

            {/* One resume section only */}
            <div ref={scrollContainerRef} className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-transparent">
              <div
              id = "resume-a4"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                  fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                  backgroundImage:
                    "repeating-linear-gradient(transparent 0px, transparent calc(1123px - 3px), #d1d5db calc(1123px - 3px), #d1d5db calc(1123px - 1px), #f3f4f6 calc(1123px - 1px), #f3f4f6 1123px)",
                  backgroundSize: "100% 1123px",
                }}
                className="min-h-[1123px] w-[794px] shrink-0 rounded-[3px] bg-white px-16 py-12 text-black shadow-[0_30px_90px_rgba(0,0,0,0.22)]"
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

            {/* Floating document controls */}
            <div className="fixed bottom-6 left-[30%] z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/15 bg-[#243026]/75 px-4 py-0.2 text-white shadow-xl backdrop-blur-xl">
              <span className="text-xs font-bold">Page</span>

              <span className="text-sm font-black">{currentPage} / {totalPages}</span>

              <div className="mx-1 h-5 w-px bg-white/25" />

              <button
                onClick={zoomOut}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/0 transition hover:bg-white/20"
                title="Zoom out"
              >
                <ZoomOut size={15} />
              </button>

              <span className="min-w-10 text-center text-xs font-black">
                {Math.round(zoom * 100)}%
              </span>

              <button
                onClick={zoomIn}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/0 transition hover:bg-white/20"
                title="Zoom in"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>

          {/* Right evaluation panel */}
          <aside className="flex h-full min-h-0 flex-col">

            {/* Tab bar */}
            <div className="flex shrink-0 gap-1 px-4 pt-4">
              {["analysis", "rewrites", "cover-letter", "profile", "find-jobs"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    activeTab === tab
                      ? "bg-white/70 text-[#243026] shadow-sm"
                      : "text-white/88 hover:text-[#243026]"
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
                  <section className={`border-b ${UI.lineStrong} pb-5`}>
                    <div className="rounded-[1.6rem] border border-white/16 bg-white/08 px-4 py-4 backdrop-blur-xl">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl font-black text-[#243026]">
                            Resume Level
                          </p>
                        </div>

                        <button
                          onClick={evaluateResume}
                          disabled={isLoading}
                          title="Re-evaluate — runs full pipeline again"
                          className="rounded-2xl bg-white/18 p-3 text-white transition hover:scale-105 hover:bg-white/28 disabled:opacity-50"
                        >
                          <RefreshCcw size={22} />
                        </button>
                      </div>

                      {/* Middle row */}
                      <div className="mt-4 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4">
                        <div className="rounded-[1.2rem] bg-white/06 px-4 py-4">
                          <p className={UI.subheading}>ATS Score</p>
                          <p className="mt-2 text-[3rem] font-black leading-none text-white">
                            {atsScoreValue}%
                          </p>
                        </div>

                        <div className="flex items-end justify-end rounded-[1.2rem] bg-white/04 px-4 py-4">
                          <p className="text-right text-[2.2rem] font-black uppercase leading-none text-white">
                            {resumeLevel}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/28">
                        <div
                          className="h-full rounded-full bg-white/88"
                          style={{ width: `${Math.max(0, Math.min(atsScoreValue, 100))}%` }}
                        />
                      </div>

                      {/* Pills */}
                      <div className="mt-5 grid grid-cols-3 gap-3">
                        <LevelPill label="Beginner" active={resumeLevel === "Beginner"} />
                        <LevelPill label="Intermediate" active={resumeLevel === "Intermediate"} />
                        <LevelPill label="Advanced" active={resumeLevel === "Advanced"} />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <MetricBox title="Clarity" value={metrics.clarity} comment={metricComments.clarity} />
                      <MetricBox title="Keyword" value={metrics.keywordFit} comment={metricComments.keywordFit} />
                      <MetricBox title="Structure" value={metrics.structure} comment={metricComments.structure} />
                      <MetricBox title="Impact" value={metrics.impact} comment={metricComments.impact} />
                    </div>
                  </section>
                  
                  <section className="py-5">
                    <p className="text-xl font-black text-[#243026]">Job Link Summary</p>
                    <p className={`mt-1 ${UI.bodyStrong}`}>{jobSummary}</p>
                    {jobDescription && (
                      <p className="mt-2 text-[12px] leading-[1.6] text-white/75 line-clamp-6">
                        {jobDescription}
                      </p>
                    )}

                    {missingSkills.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55 mb-2">
                          Missing Keywords
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {missingSkills.map((skill, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-red-300/50 bg-red-100/20 px-3 py-1 text-[11px] font-bold text-white/90"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {backendSuggestions.filter(s => s.type === "Weakness").length > 0 && (
                    <section className="border-t border-white/22 py-5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                          AI Comments
                        </p>
                      </div>
                      <p className="text-[11px] text-white/50 mb-4 leading-5">
                        Based on: <span className="font-bold text-white/70">{jobSummary}</span>
                      </p>

                      <div className="rounded-[1.4rem] border border-white/30 bg-white/28 px-4 py-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles size={13} className="text-[#243026]/55" />
                          <p className="text-sm font-black text-[#243026]">Weaknesses</p>
                        </div>
                        <ul className="flex flex-col gap-2">
                          {backendSuggestions
                            .filter(s => s.type === "Weakness")
                            .map(s => (
                              <li key={s.id} className="flex items-start gap-2 text-sm leading-[1.65] text-[#243026]/75">
                                <span className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-[#243026]/40" />
                                {s.text}
                              </li>
                            ))}
                        </ul>
                      </div>
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
                            s.status === "approved" ? "text-green-600" : "text-red-700"
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

                  <div className="flex items-center gap-2">
                    <label htmlFor="cover-letter-word-limit" className="text-xs font-bold text-[#243026]/70">
                      Word limit (optional)
                    </label>
                    <input
                      id="cover-letter-word-limit"
                      type="number"
                      min="50"
                      max="1000"
                      placeholder="e.g. 300"
                      value={coverLetterWordLimit}
                      onChange={(e) => setCoverLetterWordLimit(e.target.value)}
                      className="w-24 rounded-xl border border-white/45 bg-white/55 px-3 py-2 text-sm text-[#243026] outline-none focus:border-[#243026]/30 focus:bg-white/70"
                    />
                  </div>

                  <button
                    onClick={generateCoverLetter}
                    disabled={coverLetterLoading || !applicationId}
                    className="w-full rounded-[1.2rem] bg-[#243026] px-4 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
                  >
                    {coverLetterLoading ? "Generating..." : coverLetterText ? "Regenerate" : "Generate Cover Letter"}
                  </button>

                  {!applicationId && (
                    <p className="rounded-2xl px-4 py-3 text-center text-xs font-bold text-red-700">
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
                        onClick={downloadCoverLetterPDF}
                        className="w-full rounded-[1.2rem] border border-[#243026]/20 bg-white/50 py-3 text-xs font-black text-[#243026] transition hover:bg-white/80"
                      >
                        Download as PDF
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

                  <p className="text-xs text-white/50 leading-5">
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

                  <p className="text-xs text-white/50 leading-5">
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
                    <p className="rounded-2xl bg-white/35 px-4 py-3 text-center text-xs text-red-700">
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

      {/* Profile dropdown — at root level to escape overflow-hidden clipping */}
      {profileOpen && (
        <>
          <div className="fixed inset-0 z-[1999]" onClick={() => setProfileOpen(false)} />
          <div className="fixed right-4 top-14 z-[2000] w-72 rounded-[1.4rem] border border-white/20 bg-[#243026] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-white">Profile</p>
              <button
                onClick={() => setProfileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-white/88 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <img
                src="/profile icon.jpg"
                alt="Profile"
                className="h-11 w-11 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/88">User ID</p>
                <p className="truncate text-base font-semibold text-white">
                  {userId || "No user ID"}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("reeracifyUserId");
                localStorage.removeItem("reeracifyResumeId");
                localStorage.removeItem("reeracifyApplicationId");
                localStorage.removeItem("reeracifyVacancyLink");
                localStorage.removeItem("reeracifyParsedResume");
                localStorage.removeItem("reeracifyCandidateProfile");
                setProfileOpen(false);
                router.push("/");
              }}
              className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#1f2420] shadow-sm transition hover:bg-white/90 active:scale-[0.98]"
            >
              Log Out
            </button>
          </div>
        </>
      )}

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
      className={`rounded-full px-3 py-2 text-center text-xs font-black ${
        active
          ? "bg-white text-[#1f2420] shadow-lg"
          : "bg-white/25 text-white/88"
      }`}
    >
      {label}
    </div>
  );
}

function MetricBox({ title, value, comment }) {
  return (
    <div className="rounded-[1.1rem] border border-white/35 bg-white/20 p-3 backdrop-blur-xl flex flex-col gap-1">
      <p className="text-sm font-black text-white/88">{title}</p>
      <p className="text-3xl font-black text-white">{value}</p>
      {comment && (
        <p className="mt-1 text-[11px] leading-[1.5] text-white/65">{comment}</p>
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
      if (rw.original_text) m.set(rw.original_text.trim(), rw);
    }
    return m;
  }, [rewriteList]);

  function matchRewrite(text) {
    if (!text) return null;
    const t = text.trim();
    for (const [orig, rw] of rewriteMap) {
      if (t === orig || t.includes(orig) || orig.includes(t)) return rw;
      // After approval the resume text becomes suggested_text — match that too
      if (rw.status === "approved") {
        const sug = (rw.suggested_text || "").trim();
        if (sug && (t === sug || t.includes(sug) || sug.includes(t))) return rw;
      }
    }
    return null;
  }

  function RewritableBullet({ text, children }) {
    const rw = matchRewrite(text);

    if (!rw) {
      return children || <>{text}</>;
    }

    const isActive = rw.id === activeRewriteId;

    const highlightClass =
      isActive
        ? "bg-yellow-200 outline outline-2 outline-yellow-400 rounded cursor-pointer"
        : rw.status === "approved"
        ? "bg-green-100 rounded"
        : rw.status === "rejected"
        ? "opacity-50 line-through"
        : "bg-yellow-50 hover:bg-yellow-100 rounded cursor-pointer";

    const handleClick = (e) => {
      e.stopPropagation();
      onRewriteClick?.(rw);
    };

    // Inject highlight directly onto the child element to avoid block-in-inline HTML
    if (children) {
      const child = React.Children.only(children);
      return React.cloneElement(child, {
        className: `${child.props.className ?? ""} ${highlightClass}`,
        onClick: handleClick,
        title: "Click to view rewrite suggestion",
      });
    }

    return (
      <span onClick={handleClick} title="Click to view rewrite suggestion" className={highlightClass}>
        {text}
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
        <p className="resume-rewrite-banner mt-3 rounded-lg bg-yellow-50 px-3 py-1.5 text-[10px] font-bold text-yellow-700 print:hidden">
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
              {/* Description paragraph — shown when present, rewritable */}
              {(exp.description) && (
                <RewritableBullet text={exp.description}>
                  <Editable
                    value={exp.description}
                    onSave={upd ? (v) => {
                      const newExp = experience.map((e, ei) =>
                        ei === i ? { ...e, description: v } : e
                      );
                      upd({ experience: newExp });
                    } : null}
                    as="p"
                    placeholder="Describe your role..."
                    className="mt-1 text-gray-700"
                  />
                </RewritableBullet>
              )}
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
              <RewritableBullet text={proj.description || ""}>
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
              </RewritableBullet>
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

              {item.description && (
                <RewritableBullet text={item.description}>
                  <Editable
                    value={item.description}
                    onSave={upd ? (v) => {
                      const newLeadership = leadership.map((l, li) =>
                        li === i ? { ...l, description: v } : l
                      );
                      upd({ leadership: newLeadership });
                    } : null}
                    as="p"
                    className="mt-1 text-gray-700"
                  />
                </RewritableBullet>
              )}

              {(item.bullets || []).length > 0 && (
                <ul className="mt-1.5 list-disc pl-5">
                  {item.bullets.map((b, j) => (
                    <li key={j}>
                      <RewritableBullet text={b}>
                        <Editable
                          value={b}
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

              <RewritableBullet text={a.description || ""}>
                <Editable
                  value={a.description || ""}
                  onSave={upd ? (v) => {
                    const newAchievements = achievements.map((a2, ai) =>
                      ai === i ? { ...a2, description: v } : a2
                    );
                    upd({ achievements: newAchievements });
                  } : null}
                  as="p"
                  placeholder="Describe this achievement..."
                  className="mt-1 text-gray-700"
                />
              </RewritableBullet>

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

              <RewritableBullet text={c.description || ""}>
                <Editable
                  value={c.description || ""}
                  onSave={upd ? (v) => {
                    const newCerts = certifications.map((c2, ci) =>
                      ci === i ? { ...c2, description: v } : c2
                    );
                    upd({ certifications: newCerts });
                  } : null}
                  as="p"
                  placeholder="Describe this certification..."
                  className="mt-1 text-gray-700"
                />
              </RewritableBullet>

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
                  {(edu.field || edu.field_of_study) && (
                    <RewritableBullet text={edu.field || edu.field_of_study || ""}>
                      <Editable
                        value={edu.field || edu.field_of_study || ""}
                        onSave={upd ? (v) => {
                          const newEdu = education.map((e, ei) =>
                            ei === i ? { ...e, field: v } : e
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
                  GPA:&nbsp;
                  <Editable
                    value={edu.gpa || ""}
                    onSave={upd ? (v) => {
                      const newEdu = education.map((e, ei) =>
                        ei === i ? { ...e, gpa: v } : e
                      );
                      upd({ education: newEdu });
                    } : null}
                    as="span"
                    placeholder="3.86/4.00"
                    className="text-gray-600"
                  />
                </p>
              )}
              {(edu.coursework?.length > 0) && (
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
              )}
              {edu.description && (
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