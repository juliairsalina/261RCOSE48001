"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Redo2,
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
} from "lucide-react";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function EditResumePage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(0.72);

  const [resumeFile, setResumeFile] = useState(null);
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

  const [resumeBullets, setResumeBullets] = useState([]);
  const [weakBulletIds, setWeakBulletIds] = useState(new Set());
  const [backendSuggestions, setBackendSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState("summary");

  const [latestRuleBasedSignals, setLatestRuleBasedSignals] = useState(null);
  const [latestEvaluationAgentResult, setLatestEvaluationAgentResult] =
    useState(null);

  const [rewriteModalOpen, setRewriteModalOpen] = useState(false);
  const [selectedBullet, setSelectedBullet] = useState(null);
  const [rewriteSuggestions, setRewriteSuggestions] = useState([]);
  const [selectedRewriteSuggestion, setSelectedRewriteSuggestion] =
    useState("");

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
          })),
          experience: (parsed.work_experience || []).map(e => ({
            role: e.title || e.role || "",
            company: e.company || "",
            start_date: e.start_date || "",
            end_date: e.is_current ? "Present" : (e.end_date || ""),
            bullets: e.bullets || [],
          })),
          projects: (parsed.projects || []).map(p => ({
            name: p.name || "",
            start_date: p.start_date || "",
            end_date: p.end_date || "",
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

  function calculateResumeLevel(score) {
    if (score >= 85) return "Advanced";
    if (score >= 60) return "Intermediate";
    return "Beginner";
  }

  function calculateImpactScore(ruleSignals) {
    const measurable = ruleSignals?.measurable_evidence || {};
    const total = measurable.total_bullet_count || 0;
    const metricCount = measurable.metric_bullet_count || 0;

    if (total === 0) return 0;

    return Math.round((metricCount / total) * 100);
  }

  function buildBackendSuggestions(ruleSignals, evaluation) {
    const items = [];

    const keywordResult = ruleSignals?.keyword_result || {};
    const missingKeywords = keywordResult.missing_keywords || [];

    missingKeywords.forEach((keyword, index) => {
      items.push({
        id: `missing-keyword-${index}`,
        title: `Missing keyword: ${keyword}`,
        label: "Keyword suggestion",
        type: "ATS",
        text: `The keyword "${keyword}" is missing from your resume.`,
        suggestion: `Add "${keyword}" naturally in your project, skills, or experience section if it is true to your background.`,
      });
    });

    (ruleSignals?.weak_phrase_flags || []).forEach((item, index) => {
      items.push({
        id: item.id || `weak-phrase-${index}`,
        title: "Weak phrase detected",
        label: "Rewrite suggestion",
        type: "Clarity",
        text: item.reason || item.text || "Weak phrase found.",
        suggestion:
          "Click the highlighted sentence in the resume to request rewrite suggestions.",
        bulletId: item.id,
      });
    });

    (ruleSignals?.grammar_flags || []).forEach((item, index) => {
      items.push({
        id: item.id || `grammar-${index}`,
        title: "Grammar issue",
        label: "Grammar suggestion",
        type: "Correctness",
        text: item.text || "Grammar or spelling issue found.",
        suggestion: "Review the highlighted sentence and rewrite it clearly.",
        bulletId: item.id,
      });
    });

    (evaluation?.weak_bullets || []).forEach((item, index) => {
      items.push({
        id: item.id || `weak-bullet-${index}`,
        title: "Weak bullet point",
        label: "Rewrite suggestion",
        type: "Impact",
        text: item.reason || item.text || "This bullet can be improved.",
        suggestion:
          "Rewrite this bullet to better match the vacancy link without inventing fake numbers or achievements.",
        bulletId: item.id,
      });
    });

    (evaluation?.improvement_priorities || []).forEach((priority, index) => {
      items.push({
        id: `priority-${index}`,
        title: "Improvement priority",
        label: "AI comment",
        type: "Priority",
        text: priority,
        suggestion: priority,
      });
    });

    return items;
  }

  function renderBackendData(data) {
    const ruleSignals = data.rule_based_signals || {};
    const evaluation = data.evaluation_agent_result || {};

    setLatestRuleBasedSignals(ruleSignals);
    setLatestEvaluationAgentResult(evaluation);

    const score = Number(data.ats_score ?? ruleSignals.ats_score ?? 0);

    setAtsScoreValue(score);
    setResumeLevel(data.resume_level || calculateResumeLevel(score));

    setJobSummary(
      data.job_description_summary ||
        evaluation.job_description_summary ||
        evaluation.reasoning ||
        "Job-based evaluation completed."
    );

    const keywordResult = ruleSignals.keyword_result || {};
    const presentKeywords = keywordResult.present_keywords || [];
    const missingKeywords = keywordResult.missing_keywords || [];
    const totalKeywords = presentKeywords.length + missingKeywords.length;

    const keywordScoreValue =
      totalKeywords > 0
        ? Math.round((presentKeywords.length / totalKeywords) * 100)
        : 0;

    const sectionPresence = ruleSignals.section_presence || {};
    const sectionValues = Object.values(sectionPresence);

    const structureScoreValue =
      sectionValues.length > 0
        ? Math.round(
            (sectionValues.filter(Boolean).length / sectionValues.length) * 100
          )
        : score;

    const weakCount = (ruleSignals.weak_phrase_flags || []).length;
    const grammarCount = (ruleSignals.grammar_flags || []).length;
    const clarityScoreValue = Math.max(
      0,
      100 - weakCount * 10 - grammarCount * 8
    );

    setMetrics({
      clarity: clarityScoreValue,
      keywordFit: keywordScoreValue,
      structure: structureScoreValue,
      impact: calculateImpactScore(ruleSignals),
    });

    const weakIds = new Set();

    (ruleSignals.weak_phrase_flags || []).forEach((item) => {
      if (item.id) weakIds.add(item.id);
    });

    (ruleSignals.grammar_flags || []).forEach((item) => {
      if (item.id) weakIds.add(item.id);
    });

    (evaluation.weak_bullets || []).forEach((item) => {
      if (item.id) weakIds.add(item.id);
    });

    setWeakBulletIds(weakIds);
    setResumeBullets(ruleSignals.all_bullets || []);

    const dynamicSuggestions = buildBackendSuggestions(ruleSignals, evaluation);
    setBackendSuggestions(dynamicSuggestions);

    if (dynamicSuggestions.length > 0) {
      setActiveSuggestion(dynamicSuggestions[0].id);
    }

    setIsLoading(false);
    setStatusMessage("Evaluation completed.");
  }

  function getRankLabel(rank) {
    if (rank === "상") return "Advanced";
    if (rank === "중") return "Intermediate";
    return "Beginner";
  }

  async function evaluateResume() {
    if (!resumeId) {
      setErrorMessage("Please upload your resume on the home page first.");
      return;
    }

    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    const rid = resumeId || localStorage.getItem("reeracifyResumeId") || "";

    try {
      // Step 1: Create job post from URL (vacancy link is optional)
      const hasLink = vacancyLink.trim().length > 0;
      setLoadingState(hasLink ? "Extracting job details from URL..." : "Preparing evaluation...");
      const jobPost = await callBackend("/job-posts/create", {
        method: "POST",
        body: JSON.stringify({ job_url: vacancyLink.trim(), user_id: uid }),
      });

      // Step 2: Create application
      setLoadingState("Creating application...");
      const app = await callBackend("/applications/create", {
        method: "POST",
        body: JSON.stringify({
          user_id: uid,
          resume_id: rid,
          job_post_id: jobPost.job_post_id,
        }),
      });
      const appId = app.id;
      setApplicationId(appId);
      localStorage.setItem("reeracifyApplicationId", appId);

      // Step 3: RAG retrieval
      setLoadingState("Retrieving resume context...");
      await callBackend(`/applications/${appId}/retrieve-context`, {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      });

      // Step 4: ATS evaluation
      setLoadingState("Evaluating ATS score...");
      const evalResult = await callBackend(`/applications/${appId}/evaluate`, {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      });

      const score = evalResult.score || 0;
      setAtsScoreValue(score);
      setResumeLevel(getRankLabel(evalResult.rank));
      setJobSummary(
        hasLink
          ? `${jobPost.role_title || "Role"} at ${jobPost.company_name || "Company"}`
          : "General resume evaluation — no job posting provided."
      );

      const matched = evalResult.matched_skills?.length || 0;
      const missing = evalResult.missing_skills?.length || 0;
      const total = matched + missing || 1;
      setMetrics({
        clarity: score,
        keywordFit: Math.round((matched / total) * 100),
        structure: score,
        impact: score,
      });

      const suggestions = [
        ...(evalResult.missing_skills || []).map((s, i) => ({
          id: `missing-${i}`, title: `Missing: ${s}`, type: "ATS", label: "Keyword",
          text: `"${s}" is required but not found in your resume.`,
          suggestion: `Add "${s}" to your skills or experience section.`,
        })),
        ...(evalResult.weaknesses || []).map((w, i) => ({
          id: `weak-${i}`, title: "Weakness", type: "Impact", label: "AI comment",
          text: w, suggestion: w,
        })),
        ...(evalResult.improvement_priority || []).map((p, i) => ({
          id: `priority-${i}`, title: "Priority", type: "Priority", label: "AI comment",
          text: p, suggestion: p,
        })),
      ];
      setBackendSuggestions(suggestions);
      if (suggestions.length > 0) setActiveSuggestion(suggestions[0].id);

      // Step 5: Rewrite suggestions
      setLoadingState("Generating rewrite suggestions...");
      const rewriteResult = await callBackend(`/applications/${appId}/rewrite-suggestions`, {
        method: "POST",
        body: JSON.stringify({ user_id: uid }),
      });
      setRewriteList(rewriteResult.suggestions || []);

      setIsLoading(false);
      setStatusMessage(`Evaluation complete — ATS score: ${score}/100`);
      setActiveTab("analysis");

    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
    }
  }

  async function reevaluateResume() {
    setErrorMessage("Re-evaluate: paste a new vacancy link and click Evaluate.");
  }

  async function approveRewrite(suggestionId) {
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

  function requestRewriteForBullet(bullet) {
    setSelectedBullet(bullet);
    setSelectedRewriteSuggestion("");
    setRewriteSuggestions(
      rewriteList
        .filter(s => s.original_text && bullet.text?.includes(s.original_text.slice(0, 20)))
        .map(s => ({ suggestion: s.suggested_text, why_it_is_better: s.reason }))
    );
    setRewriteModalOpen(true);
  }

  function openSuggestionRewrite() {
    if (!currentSuggestion) return;
    setSelectedBullet({ id: currentSuggestion.id, text: currentSuggestion.text });
    setRewriteSuggestions([{
      suggestion: currentSuggestion.suggestion,
      why_it_is_better: "AI suggestion based on job requirements.",
    }]);
    setSelectedRewriteSuggestion("");
    setRewriteModalOpen(true);
  }

  function acceptRewrite() {
    setRewriteModalOpen(false);
    setSelectedBullet(null);
    setSelectedRewriteSuggestion("");
  }

  function ignoreRewrite() {
    setRewriteModalOpen(false);
    setSelectedBullet(null);
    setSelectedRewriteSuggestion("");
  }

  function handleResumeUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setResumeFile(file);
    setStatusMessage(`${file.name} uploaded. Click Evaluate to analyze it.`);
    setErrorMessage("");
  }

  async function downloadResume() {
    if (!applicationId) {
      setErrorMessage("Run Evaluate first to generate an application before downloading.");
      return;
    }
    const uid = userId || localStorage.getItem("reeracifyUserId") || "";
    try {
      setLoadingState("Preparing download...");
      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/export-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Export failed: ${response.status}`);
      }
      const blob = await response.blob();
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
              label="Homes"
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

                  <ToolButton
                    icon={<Redo2 size={17} />}
                    label="Next issue"
                    onClick={goNextSuggestion}
                  />

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
                  <button
                    onClick={evaluateResume}
                    disabled={isLoading}
                    className="rounded-full bg-[#243026] px-7 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {isLoading ? "Evaluating..." : "Evaluate"}
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
                className="h-[1123px] w-[794px] shrink-0 rounded-[3px] bg-white px-16 py-12 text-black shadow-[0_30px_90px_rgba(0,0,0,0.22)] print:shadow-none"
              >
                <ResumeDocument
                  resumeData = {resumeData}
                  activeSuggestion={activeSuggestion}
                  currentSuggestion={currentSuggestion}
                  resumeBullets={resumeBullets}
                  weakBulletIds={weakBulletIds}
                  onBulletClick={requestRewriteForBullet}
                />
              </div>
            </div>
          </div>

          {/* Right evaluation panel */}
          <aside className="flex h-screen min-h-0 flex-col rounded-l-[0.5rem] border-y-0 border-r-0 border-white/45 bg-white/35 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-2xl">

            {/* Tab bar */}
            <div className="flex shrink-0 gap-1 border-b border-[#243026]/10 px-4 pt-4">
              {["analysis", "rewrites", "cover-letter"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-t-xl px-4 py-2 text-xs font-black transition ${
                    activeTab === tab
                      ? "bg-white/70 text-[#243026] shadow-sm"
                      : "text-[#243026]/45 hover:text-[#243026]"
                  }`}
                >
                  {tab === "analysis" ? "Analysis" : tab === "rewrites" ? "Rewrites" : "Cover Letter"}
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
                        className={`rounded-[1.2rem] border p-4 transition ${
                          s.status === "approved"
                            ? "border-green-300 bg-green-50/70"
                            : s.status === "rejected"
                            ? "border-red-200 bg-red-50/60 opacity-60"
                            : "border-white/45 bg-white/35"
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
                              onClick={() => approveRewrite(s.id)}
                              className="flex-1 rounded-full bg-[#243026] py-2 text-xs font-black text-white transition hover:scale-[1.02]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectRewrite(s.id)}
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

            </div>
          </aside>
        </section>
      </div>

      {rewriteModalOpen && (
        <RewriteModal
          selectedBullet={selectedBullet}
          rewriteSuggestions={rewriteSuggestions}
          selectedRewriteSuggestion={selectedRewriteSuggestion}
          setSelectedRewriteSuggestion={setSelectedRewriteSuggestion}
          onClose={() => setRewriteModalOpen(false)}
          onIgnore={ignoreRewrite}
          onAccept={acceptRewrite}
          errorMessage={errorMessage}
        />
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

function HighlightBox({ active, children, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-sm px-1 transition ${
        active
          ? "cursor-pointer bg-yellow-300 shadow-[0_0_0_2px_rgba(250,204,21,0.65)]"
          : onClick
          ? "cursor-pointer hover:bg-yellow-100"
          : ""
      }`}
    >
      {children}
    </div>
  );
}

function ResumeDocument({
  resumeData,
  activeSuggestion,
  currentSuggestion,
  resumeBullets = [],
  weakBulletIds = new Set(),
  onBulletClick,
}) {
  const groupedBullets = useMemo(() => {
    return resumeBullets.reduce((acc, bullet) => {
      const section = bullet.section || "other";
      if (!acc[section]) acc[section] = [];
      acc[section].push(bullet);
      return acc;
    }, {});
  }, [resumeBullets]);

  if (resumeData) {
  return (

    <article className="text-[12px] leading-[1.45]">

      {/* Header */}
      <div className="border-b pb-3 text-center">
        <h1 className="text-[22px] font-black">
          {resumeData.name}
        </h1>

        <p className="mt-1 text-[11px] text-gray-600">
          {resumeData.email}
          {" • "}
          {resumeData.phone}
        </p>
      </div>

      {/* Summary */}
      <section className="mt-5">
        <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
          Summary
        </h2>

        <p className="mt-2">
          {resumeData.summary}
        </p>
      </section>

      {/* Skills */}
      <section className="mt-5">
        <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
          Skills
        </h2>

        <p className="mt-2">
          {(resumeData.skills || []).join(" • ")}
        </p>
      </section>

      {/* Education */}
      <section className="mt-5">
        <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
          Education
        </h2>

        {(resumeData.education || []).map((edu, index) => (

          <div key={index} className="mt-3">

            <div className="flex justify-between">
              <h3 className="font-bold">
                {edu.school}
              </h3>

              <span>
                {edu.start_date} - {edu.end_date}
              </span>
            </div>

            <p>
              {edu.degree} in {edu.field}
            </p>

          </div>

        ))}
      </section>

      {/* Experience */}
      <section className="mt-5">
        <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
          Experience
        </h2>

        {(resumeData.experience || []).map((exp, index) => (

          <div key={index} className="mt-3">

            <div className="flex justify-between">
              <div>
                <h3 className="font-bold">
                  {exp.role}
                </h3>

                <p>{exp.company}</p>
              </div>

              <span>
                {exp.start_date} - {exp.end_date}
              </span>
            </div>

            <ul className="mt-2 list-disc pl-5">
              {(exp.bullets || []).map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>

          </div>

        ))}
      </section>

      {/* Projects */}
      <section className="mt-5">
        <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
          Projects
        </h2>

        {(resumeData.projects || []).map((project, index) => (

          <div key={index} className="mt-3">

            <div className="flex justify-between">
              <h3 className="font-bold">
                {project.name}
              </h3>

              <span>
                {project.start_date} - {project.end_date}
              </span>
            </div>

            <ul className="mt-2 list-disc pl-5">
              {(project.bullets || []).map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>

          </div>

        ))}
      </section>

    </article>

  );
}

  if (resumeBullets.length > 0) {
    return (
      <article className="text-[12px] leading-[1.45]">
        <h1 className="text-center text-[20px] font-black tracking-wide">
          REERACIFY RESUME
        </h1>
        <p className="text-center text-[10px]">
          Click highlighted parts to view AI rewrite suggestions
        </p>

        {Object.entries(groupedBullets).map(([section, bullets]) => (
          <section key={section} className="mt-4">
            <h2 className="border-b border-black pb-[2px] text-[11px] font-black uppercase">
              {section}
            </h2>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              {bullets.map((bullet, index) => {
                const isWeak = weakBulletIds.has(bullet.id);
                const isActive =
                  activeSuggestion === bullet.id ||
                  currentSuggestion?.bulletId === bullet.id;

                return (
                  <li
                    key={bullet.id || index}
                    onClick={() => onBulletClick?.(bullet)}
                    className={`rounded-sm px-1 transition ${
                      isWeak || isActive
                        ? "cursor-pointer bg-yellow-300 shadow-[0_0_0_2px_rgba(250,204,21,0.65)]"
                        : "cursor-pointer hover:bg-yellow-100"
                    }`}
                    title="Click to rewrite this part"
                  >
                    {bullet.text}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </article>
    );
  }

  return (
    <article className="flex h-full items-center justify-center text-center text-[#243026]/50">
      <div>
        <h2 className="text-xl font-black text-[#243026]">
          No resume evaluated yet
        </h2>
        <p className="mt-2 text-sm">
          Upload your resume and paste a vacancy link, then click Evaluate.
        </p>
      </div>
    </article>
  );
}

function RewriteModal({
  selectedBullet,
  rewriteSuggestions,
  selectedRewriteSuggestion,
  setSelectedRewriteSuggestion,
  onClose,
  onIgnore,
  onAccept,
  errorMessage,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-auto rounded-[2rem] border border-white/45 bg-white/85 p-6 text-[#243026] shadow-2xl backdrop-blur-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 hover:bg-black/5"
        >
          <X size={18} />
        </button>

        <h2 className="text-2xl font-black">Rewrite Suggestion</h2>

        <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#243026]/45">
          Selected part
        </p>

        <div className="mt-2 rounded-2xl bg-white/70 p-4 text-sm leading-6">
          {selectedBullet?.text || "No text selected."}
        </div>

        <div className="mt-5 space-y-3">
          {rewriteSuggestions.length === 0 ? (
            <p className="rounded-2xl bg-white/60 p-4 text-sm">
              {errorMessage || "Generating rewrite suggestions..."}
            </p>
          ) : (
            rewriteSuggestions.map((item, index) => {
              const suggestion = item.suggestion || "";

              return (
                <button
                  key={index}
                  onClick={() => setSelectedRewriteSuggestion(suggestion)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedRewriteSuggestion === suggestion
                      ? "border-[#243026] bg-white shadow-lg"
                      : "border-white/60 bg-white/50 hover:bg-white/80"
                  }`}
                >
                  <p className="text-sm font-black">Suggestion {index + 1}</p>
                  <p className="mt-2 text-sm leading-6">{suggestion}</p>

                  {item.why_it_is_better && (
                    <p className="mt-2 text-xs leading-5 text-[#243026]/60">
                      {item.why_it_is_better}
                    </p>
                  )}

                  {item.caution && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {item.caution}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onIgnore}
            className="rounded-full border border-[#243026]/20 bg-white/50 px-5 py-3 text-xs font-bold"
          >
            Ignore
          </button>

          <button
            onClick={onClose}
            className="rounded-full border border-[#243026]/20 bg-white/50 px-5 py-3 text-xs font-bold"
          >
            Close
          </button>

          <button
            onClick={onAccept}
            disabled={!selectedRewriteSuggestion}
            className="rounded-full bg-[#243026] px-5 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            Accept Suggestion
          </button>
        </div>
      </div>
    </div>
  );
}