"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Loader2,
  X,
  Search,
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
  Bell,
  User,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Wand2,
  BarChart3,
  Target,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const FALLBACK_SUGGESTIONS = [ ];

export default function EditResumePage() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(0.72);

  const [resumeFile, setResumeFile] = useState(null);
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

  const suggestions = backendSuggestions;

  const currentSuggestion =
    suggestions.find((item) => item.id === activeSuggestion) || suggestions[0];

  useEffect(() => {
    const savedVacancyLink = localStorage.getItem("reeracifyVacancyLink");

    if (savedVacancyLink) {
      setVacancyLink(savedVacancyLink);
      setJobSummary("Vacancy link loaded. Upload your resume to evaluate it.");
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

  async function evaluateResume() {
    if (!vacancyLink.trim()) {
      setErrorMessage("Please paste the vacancy link first.");
      return;
    }

    if (!resumeFile) {
      setErrorMessage("Please upload your resume first.");
      return;
    }

    try {
      setLoadingState("Reading vacancy link and evaluating resume...");

      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("vacancy_link", vacancyLink);

      const data = await callBackend("/evaluate", {
        method: "POST",
        body: formData,
      });

      renderBackendData(data);
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(
        `${error.message}. If /evaluate is not ready yet, connect this endpoint to resume + vacancy link processing.`
      );
    }
  }

  async function reevaluateResume() {
    try {
      setLoadingState("Re-evaluating resume...");

      const data = await callBackend("/reevaluate-file", {
        method: "POST",
        body: JSON.stringify({
          vacancy_link: vacancyLink,
        }),
      });

      renderBackendData(data);
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
    }
  }

  async function requestRewriteForBullet(bullet) {
    if (!latestRuleBasedSignals || !latestEvaluationAgentResult) {
      setErrorMessage("Please evaluate the resume first.");
      return;
    }

    setSelectedBullet(bullet);
    setSelectedRewriteSuggestion("");
    setRewriteSuggestions([]);
    setRewriteModalOpen(true);

    const payload = {
      vacancy_link: vacancyLink,
      selected_bullet: bullet.text,
      rule_based_signals: latestRuleBasedSignals,
      evaluation_agent_result: latestEvaluationAgentResult,
      user_instruction:
        "Rewrite this bullet to better match the vacancy link. Make it stronger, clearer, and ATS-friendly. Do not invent fake numbers, tools, or achievements.",
    };

    try {
      const data = await callBackend("/rewrite", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setRewriteSuggestions(data.rewrite_suggestions || []);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function openSuggestionRewrite() {
    const bulletId = currentSuggestion?.bulletId;

    if (!bulletId) {
      setSelectedBullet({
        id: currentSuggestion.id,
        text: currentSuggestion.text,
      });
      setRewriteSuggestions([
        {
          suggestion: currentSuggestion.suggestion,
          why_it_is_better:
            "This is a general AI suggestion. Evaluate with backend to get bullet-specific rewrite options.",
        },
      ]);
      setSelectedRewriteSuggestion("");
      setRewriteModalOpen(true);
      return;
    }

    const bullet = resumeBullets.find((item) => item.id === bulletId);

    if (!bullet) {
      setErrorMessage("Cannot find the related bullet in the resume.");
      return;
    }

    requestRewriteForBullet(bullet);
  }

  async function acceptRewrite() {
    if (!selectedBullet || !selectedRewriteSuggestion) {
      setErrorMessage("Please select one rewrite suggestion first.");
      return;
    }

    try {
      setLoadingState("Saving rewrite and updating score...");

      const payload = {
        bullet_id: selectedBullet.id,
        accepted_bullet: selectedRewriteSuggestion,
        vacancy_link: vacancyLink,
      };

      const data = await callBackend("/accept-rewrite", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setRewriteModalOpen(false);
      setSelectedBullet(null);
      setSelectedRewriteSuggestion("");

      if (data.reevaluation_result) {
        renderBackendData(data.reevaluation_result);
      } else {
        await reevaluateResume();
      }
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
    }
  }

  async function ignoreRewrite() {
    try {
      await callBackend("/ignore-rewrite", {
        method: "POST",
      });
    } catch (error) {
      console.warn(error);
    }

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

  function downloadResume() {
    window.print();
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
          className={`flex h-screen shrink-0 flex-col rounded-r-[2.2rem] border-r border-white/45 bg-white/35 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.14)] backdrop-blur-2xl transition-all duration-300 ${
            sidebarOpen ? "w-[230px]" : "w-[72px]"
          }`}
        >
          <div
            className={`mb-6 flex items-center ${
              sidebarOpen ? "justify-between" : "justify-center"
            } px-1 pt-4`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#243026] text-sm font-black text-white shadow-lg">
                R
              </div>

              {sidebarOpen && (
                <div>
                  <p className="text-sm font-black tracking-tight text-[#243026]">
                    Reeracify
                  </p>
                  <p className="text-[10px] font-semibold text-[#243026]/45">
                    Resume Workspace
                  </p>
                </div>
              )}
            </div>

            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-full p-2 text-[#243026]/60 transition hover:bg-white/50 hover:text-[#243026]"
              >
                <PanelLeftClose size={18} />
              </button>
            )}
          </div>

          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="mb-5 rounded-full p-2 text-[#243026]/60 transition hover:bg-white/50 hover:text-[#243026]"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}

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

          <div className="my-5 h-px bg-[#243026]/10" />

          <nav className="space-y-1">
            <SidebarItem
              icon={<MessageCircle size={18} />}
              label="Message"
              open={sidebarOpen}
            />
            <SidebarItem
              icon={<Bell size={18} />}
              label="Notification"
              open={sidebarOpen}
            />
          </nav>

          <div className="flex-1" />

          <nav className="space-y-1">
            <SidebarItem
              icon={<User size={18} />}
              label="My Profile"
              open={sidebarOpen}
            />
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
        <section className="grid min-w-0 flex-1 grid-cols-[1fr_340px] gap-5 px-5 py-5">
          {/* Resume workspace */}
          <div className="flex min-w-0 flex-col rounded-[2rem] border border-white/35 bg-white/28 p-5 shadow-[0_25px_90px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
            {/* Header + toolbar */}
            <div className="mb-4 rounded-[1.4rem] border border-white/40 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-[#243026]">
                  .
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={evaluateResume}
                    disabled={isLoading}
                    className="rounded-full bg-[#243026] px-5 py-2 text-xs font-bold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {isLoading ? "Evaluating..." : "Evaluate"}
                  </button>

                  <button
                    onClick={downloadResume}
                    className="flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-4 py-2 text-xs font-bold text-[#243026] transition hover:bg-white"
                  >
                    Download
                    <Download size={15} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-full border border-white/50 bg-white/45 px-4 py-2 shadow-sm backdrop-blur-xl">
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

                  <div className="mx-2 h-6 w-px bg-[#243026]/15" />

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
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                }}
                className="h-[1123px] w-[794px] shrink-0 rounded-[3px] bg-white px-16 py-12 text-black shadow-[0_30px_90px_rgba(0,0,0,0.22)]"
              >
                <ResumeDocument
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
          <aside className="flex min-h-0 flex-col rounded-[2rem] border border-white/35 bg-white/30 p-5 shadow-[0_25px_90px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
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
                <LevelPill
                  label="Intermediate"
                  active={resumeLevel === "Intermediate"}
                />
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
                  style={{
                    width: `${Math.max(0, Math.min(atsScoreValue, 100))}%`,
                  }}
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
              <p className="mt-3 text-sm leading-6 text-[#243026]/65">
                {jobSummary}
              </p>
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
                        <p className="text-sm font-black text-[#243026]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[#243026]/45">
                          {item.type} · {item.label}
                        </p>
                      </div>

                      {activeSuggestion === item.id ? (
                        <AlertTriangle
                          size={16}
                          className="shrink-0 text-yellow-700"
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-[#243026]/40"
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="border-t border-[#243026]/10 pt-5">
              <div className="flex items-center gap-2">
                <Sparkles size={17} />
                <h3 className="text-sm font-black">
                  {currentSuggestion?.title}
                </h3>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#243026]/65">
                {currentSuggestion?.text}
              </p>

              <button
                onClick={openSuggestionRewrite}
                className="mt-4 w-full rounded-[1.2rem] bg-[#243026] px-4 py-3 text-xs font-bold text-white shadow-lg transition hover:scale-[1.01]"
              >
                Show Rewrite Suggestion
              </button>
            </section>
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