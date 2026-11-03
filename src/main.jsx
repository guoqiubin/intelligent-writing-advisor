import React, { Component, lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  buildDraft,
  buildReview,
  buildRevisionTarget,
  APP_VERSION,
  archiveProject,
  DEFAULT_PASSWORD_HASH,
  grantAccess,
  isAccessGranted,
  canAccessStep,
  estimateCall,
  getSelectedBook,
  isStepComplete,
  loadHistory,
  loadProject,
  releaseHistory,
  releaseNotes,
  resetProject,
  revokeAccess,
  saveProject,
  sha256Hex,
  bookSteps,
  canAccessBookStep,
  isBookStepComplete,
  steps,
  validateBookFileMatch
} from "./workflow";
const SyncStudioWorkbench = lazy(() => import("./sync-studio/Workbench").then((module) => ({ default: module.SyncStudioWorkbench })));
const SyncStudioTutorial = lazy(() => import("./sync-studio/Tutorial").then((module) => ({ default: module.SyncStudioTutorial })));
const CoverGenerator = lazy(() => import("./cover-generator/CoverGenerator").then((module) => ({ default: module.CoverGenerator })));

const LOCAL_SYNC_URL = "http://127.0.0.1:4175/?module=sync";

function isSyncRoute() {
  return new URLSearchParams(window.location.search).get("module") === "sync";
}

function WorkspaceIcon({ type }) {
  const paths = {
    community: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20M8 7h8M8 10h6" /><path d="m15.5 15.5 3.8-3.8 1.5 1.5-3.8 3.8-2.1.6.6-2.1Z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21V5.5Z" /><path d="M7 7h2M15 7h2M7 10h2M15 10h2" /><circle cx="16.5" cy="15.5" r="2" /><path d="m18 17 2 2" /></>,
    sync: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9v6M10 11v2M13 8v8M16 10v4M19 7v10" /><path d="M8 21h8" /></>,
    cover: <><path d="M4 18.5 9.5 13l3.5 3.5 3-3 4 4" /><path d="M5 4h14a1 1 0 0 1 1 1v14H4V5a1 1 0 0 1 1-1Z" /><circle cx="9" cy="8.5" r="1.5" /><path d="m16 7 1.2-2.4L18.4 7 21 8.2l-2.6 1.2-1.2 2.6-1.2-2.6-2.6-1.2L16 7Z" /></>
  };
  return <svg className="workspace-svg-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

function App() {
  const [hasAccess, setHasAccess] = useState(isAccessGranted);
  const [project, setProject] = useState(loadProject);
  const [history, setHistory] = useState(() => loadHistory("community"));
  const [bookHistory, setBookHistory] = useState(() => loadHistory("book"));
  const [activeStep, setActiveStep] = useState(() => isSyncRoute() ? "sync-studio" : "problem");
  const [workspace, setWorkspace] = useState(() => isSyncRoute() ? "sync" : "community");
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({ community: true, book: false, sync: true, cover: true });
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem("intelligent-writing-advisor-sidebar-width")) || 320);
  // 首页每次重新打开都从“收起”状态开始；用户仍可在当前使用过程中手动展开。
  // 不读取旧的 localStorage 值，避免之前手动展开过导致首页再次打开仍占用大量空间。
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    try {
      saveProject(project);
    } catch (error) {
      console.warn("项目状态保存失败，已保留当前页面内存状态。", error);
    }
  }, [project]);

  const selectedBook = useMemo(() => getSelectedBook(project), [project]);
  const activeSteps = workspace === "book" ? bookSteps : workspace === "sync" || workspace === "cover" ? [] : steps;
  const activeIndex = activeSteps.findIndex((step) => step.id === activeStep);
  const completedCount = activeSteps.filter((step) => workspace === "book" ? canAccessBookStep(project, step.id) : canAccessStep(project, step.id)).length - 1;

  function update(patch) {
    setProject((current) => ({ ...current, ...patch }));
  }

  function logUsage(stage, model, inputTokens, outputTokens) {
    setProject((current) => ({
      ...current,
      usage: [...current.usage, estimateCall(stage, model, inputTokens, outputTokens)]
    }));
  }

  function goNext() {
    const next = activeSteps[activeIndex + 1];
    const enabled = workspace === "book" ? canAccessBookStep(project, next?.id) : canAccessStep(project, next?.id);
    if (next && enabled) setActiveStep(next.id);
  }

  function switchWorkspace(nextWorkspace) {
    if (nextWorkspace === "sync" && !isSyncRoute()) {
      window.location.assign(LOCAL_SYNC_URL);
      return;
    }
    if (nextWorkspace !== "sync" && isSyncRoute()) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    const sameWorkspace = workspace === nextWorkspace;
    setWorkspace(nextWorkspace);
    setExpandedWorkspaces((current) => {
      if (nextWorkspace === "sync") return { community: false, book: false, sync: true, cover: false };
      if (sameWorkspace) return { ...current, [nextWorkspace]: !current[nextWorkspace] };
      return { community: nextWorkspace === "community", book: nextWorkspace === "book", sync: false, cover: nextWorkspace === "cover" };
    });
    if (!sameWorkspace) setActiveStep(nextWorkspace === "book" ? "book-upload" : nextWorkspace === "sync" ? "sync-studio" : nextWorkspace === "cover" ? "cover-generator" : "problem");
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("intelligent-writing-advisor-sidebar-collapsed-v2", String(next));
      return next;
    });
  }

  function startSidebarResize(event) {
    if (sidebarCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let latestWidth = startWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const handleMove = (moveEvent) => {
      const nextWidth = Math.min(520, Math.max(240, startWidth + moveEvent.clientX - startX));
      latestWidth = nextWidth;
      setSidebarWidth(nextWidth);
    };
    const stopResize = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", stopResize);
      localStorage.setItem("intelligent-writing-advisor-sidebar-width", String(latestWidth));
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", stopResize, { once: true });
  }

  function logout() {
    revokeAccess();
    setProject(resetProject());
    setHasAccess(false);
    setWorkspace("community");
    setActiveStep("problem");
  }

  function completeCurrentRound() {
    const archiveTarget = workspace === "book"
      ? {
          ...project,
          title: project.bookWritingTitle || project.bookTitle || "书籍拆解稿",
          manualBook: project.bookTitle,
          manualBookConfirmed: true,
          draft: project.bookDraft,
          writingMode: project.bookWritingMode,
          wordRule: project.bookWordRule,
          wordCount: project.bookWordCount,
          learnerProblem: "书籍拆解工作流"
        }
      : project;
    const nextHistory = archiveProject(archiveTarget, workspace);
    if (workspace === "book") setBookHistory(nextHistory);
    else setHistory(nextHistory);
    setProject(resetProject());
    setWorkspace("community");
    setActiveStep("problem");
  }

  function renderWorkspaceFlow(workspaceType) {
    if (!expandedWorkspaces[workspaceType]) return null;
    if (workspaceType === "sync") {
      return <div className="current-workspace-flow">
        <div className="current-workspace-label"><span>子工作流</span><strong>声画同步</strong></div>
        <button className={`nested-history ${activeStep === "sync-studio" ? "active" : ""}`} onClick={() => setActiveStep("sync-studio")}>
          <span className="step-index">作</span><span><strong>创作工作台</strong><small>上传素材并生成 MP4</small></span>
        </button>
        <button className={`nested-history ${activeStep === "sync-tutorial" ? "active" : ""}`} onClick={() => setActiveStep("sync-tutorial")}>
          <span className="step-index">教</span><span><strong>新手教程</strong><small>图文了解完整操作流程</small></span>
        </button>
        <button className={`nested-history ${activeStep === "sync-history" ? "active" : ""}`} onClick={() => setActiveStep("sync-history")}>
          <span className="step-index">档</span><span><strong>渲染历史</strong><small>查看视频时长和渲染耗时</small></span>
        </button>
      </div>;
    }
    if (workspaceType === "cover") {
      return <div className="current-workspace-flow">
        <div className="current-workspace-label"><span>子工作流</span><strong>封面生成</strong></div>
        <button className={`nested-history ${activeStep === "cover-generator" ? "active" : ""}`} onClick={() => setActiveStep("cover-generator")}>
          <span className="step-index">图</span><span><strong>封面生成工作台</strong><small>配置参数并生成图片</small></span>
        </button>
      </div>;
    }
    const stepsForWorkspace = workspaceType === "book" ? bookSteps : steps;
    return <div className="current-workspace-flow">
      <div className="current-workspace-label"><span>子工作流</span><strong>{workspaceType === "book" ? "书籍拆解" : "读书会写作"}</strong></div>
      <button className={`nested-history ${activeStep === `${workspaceType}-history` ? "active" : ""}`} onClick={() => setActiveStep(`${workspaceType}-history`)}>
        <span className="step-index">档</span><span><strong>历史记录</strong><small>该业务最近 10 篇稿件</small></span>
      </button>
      <div className="nav-divider" />
      {stepsForWorkspace.map((step, index) => {
        const enabled = workspaceType === "book" ? canAccessBookStep(project, step.id) : canAccessStep(project, step.id);
        const completed = workspaceType === "book" ? isBookStepComplete(project, step.id) : isStepComplete(project, step.id);
        const active = activeStep === step.id;
        return <button key={step.id} className={`step-button ${active ? "active" : ""} ${completed ? "completed" : ""} ${enabled ? "" : "locked"}`} disabled={!enabled} onClick={() => setActiveStep(step.id)}>
          <span className="step-index">{completed ? "✓" : index + 1}</span>
          <span><strong>{step.title}</strong><small>{step.note}</small></span>
        </button>;
      })}
    </div>;
  }

  if (!hasAccess) {
    return <AccessGate onSuccess={() => setHasAccess(true)} />;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} style={{ "--sidebar-width": `${sidebarWidth}px` }}>
      <aside className="sidebar">
        <div className="sidebar-topline">
          <BrandBlock />
          <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "展开导航栏" : "折叠导航栏"}>{sidebarCollapsed ? "☰" : "×"}</button>
        </div>

        <button className="logout-button" onClick={logout}>退出后台</button>

        <nav className="step-nav" aria-label="产品流程">
          <div className="workspace-group">
            <button className={`workspace-button ${workspace === "community" ? "active" : ""}`} onClick={() => switchWorkspace("community")} title="读书会写作">
              <span className="workspace-icon"><WorkspaceIcon type="community" /></span><span><strong>读书会写作</strong><small>围绕学员困惑生产内容</small></span><span className="workspace-chevron">{workspace === "community" && expandedWorkspaces.community ? "⌄" : "›"}</span>
            </button>
            {workspace === "community" && renderWorkspaceFlow("community")}
          </div>
          <div className="workspace-group">
            <button className={`workspace-button ${workspace === "book" ? "active" : ""}`} onClick={() => switchWorkspace("book")} title="书籍拆解">
              <span className="workspace-icon"><WorkspaceIcon type="book" /></span><span><strong>书籍拆解</strong><small>从一本书生成知识文稿</small></span><span className="workspace-chevron">{workspace === "book" && expandedWorkspaces.book ? "⌄" : "›"}</span>
            </button>
            {workspace === "book" && renderWorkspaceFlow("book")}
          </div>
          <div className="workspace-group">
            <button className={`workspace-button ${workspace === "sync" ? "active" : ""}`} onClick={() => switchWorkspace("sync")} title="声画同步工作台">
              <span className="workspace-icon"><WorkspaceIcon type="sync" /></span><span><strong>声画同步</strong><small>音频、页面与字幕创作</small></span><span className="workspace-chevron">{workspace === "sync" && expandedWorkspaces.sync ? "⌄" : "›"}</span>
            </button>
            {workspace === "sync" && renderWorkspaceFlow("sync")}
          </div>
          <div className="workspace-group">
            <button className={`workspace-button ${workspace === "cover" ? "active" : ""}`} onClick={() => switchWorkspace("cover")} title="封面生成">
              <span className="workspace-icon"><WorkspaceIcon type="cover" /></span><span><strong>封面生成</strong><small>配置参数生成封面图片</small></span><span className="workspace-chevron">{workspace === "cover" && expandedWorkspaces.cover ? "⌄" : "›"}</span>
            </button>
            {workspace === "cover" && renderWorkspaceFlow("cover")}
          </div>
        </nav>
        <div className="sidebar-resize-handle" onPointerDown={startSidebarResize} aria-label="拖动调整导航栏宽度" />
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{APP_VERSION} 已落地为可调试流程</p>
            <h2>{workspace === "sync" ? activeStep === "sync-history" ? "渲染历史" : activeStep === "sync-tutorial" ? "声画同步新手教程" : "声画同步工作台" : workspace === "cover" ? "封面生成" : activeStep.endsWith("-history") ? "历史记录" : activeStep === "direct-outline" ? "已有内容大纲" : activeSteps[activeIndex]?.title}</h2>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">
              {workspace === "sync" ? activeStep === "sync-history" ? "本地渲染记录" : activeStep === "sync-tutorial" ? "图文操作指南" : "音视频创作入口" : workspace === "cover" ? "图片创作入口" : activeStep.endsWith("-history") ? `${(workspace === "book" ? bookHistory : history).length}/10 篇历史稿件` : activeStep === "direct-outline" ? "并行写作入口" : `${Math.max(completedCount, 0)}/${activeSteps.length - 1} 个前置关卡已解锁`}
            </div>
            <UpdateBell />
          </div>
        </header>

        {workspace === "sync" && activeStep === "sync-studio" && <SyncStudioBoundary><Suspense fallback={<div className="sync-loading-panel">正在打开声画同步工作台…</div>}><SyncStudioWorkbench /></Suspense></SyncStudioBoundary>}
        {workspace === "sync" && activeStep === "sync-history" && <SyncHistory />}
        {workspace === "sync" && activeStep === "sync-tutorial" && <Suspense fallback={<div className="sync-loading-panel">正在打开新手教程…</div>}><SyncStudioTutorial /></Suspense>}
        {workspace === "cover" && activeStep === "cover-generator" && <Suspense fallback={<div className="sync-loading-panel">正在打开封面生成工作台…</div>}><CoverGenerator /></Suspense>}
        {workspace !== "sync" && activeStep.endsWith("-history") && (
          <HistoryStep history={workspace === "book" ? bookHistory : history} workflowType={workspace} />
        )}
        {workspace !== "sync" && activeStep === "problem" && (
          <>
            <ProblemStep project={project} update={update} logUsage={logUsage} goNext={goNext} setActiveStep={setActiveStep} />
          </>
        )}
        {workspace !== "sync" && activeStep === "books" && (
          <BooksStep project={project} update={update} logUsage={logUsage} goNext={goNext} />
        )}
        {workspace !== "sync" && activeStep === "source" && (
          <SourceStep project={project} selectedBook={selectedBook} update={update} goNext={goNext} />
        )}
        {workspace !== "sync" && activeStep === "analysis" && (
          <AnalysisStep project={project} selectedBook={selectedBook} update={update} logUsage={logUsage} goNext={goNext} />
        )}
        {workspace !== "sync" && activeStep === "frame" && (
          <FrameStep project={project} update={update} logUsage={logUsage} goNext={goNext} />
        )}
        {workspace !== "sync" && activeStep === "direct-outline" && (
          <DirectOutlineStep project={project} update={update} setActiveStep={setActiveStep} />
        )}
        {workspace !== "sync" && activeStep === "settings" && (
          <SettingsStep project={project} update={update} goNext={goNext} />
        )}
        {workspace !== "sync" && activeStep === "draft" && (
          <DraftStep project={project} update={update} logUsage={logUsage} goNext={goNext} />
        )}
        {workspace !== "sync" && activeStep === "review" && (
          <ReviewStep project={project} update={update} logUsage={logUsage} setActiveStep={setActiveStep} completeCurrentRound={completeCurrentRound} />
        )}
        {workspace !== "sync" && activeStep === "book-upload" && <BookUploadStep project={project} update={update} goNext={goNext} />}
        {workspace !== "sync" && activeStep === "book-analysis" && <BookAnalysisStep project={project} update={update} logUsage={logUsage} goNext={goNext} />}
        {workspace !== "sync" && activeStep === "book-settings" && <BookSettingsStep project={project} update={update} goNext={goNext} />}
        {workspace !== "sync" && activeStep === "book-draft" && <BookDraftStep project={project} update={update} logUsage={logUsage} goNext={goNext} />}
        {workspace !== "sync" && activeStep === "book-review" && <BookReviewStep project={project} update={update} logUsage={logUsage} completeCurrentRound={completeCurrentRound} />}
      </main>
    </div>
  );
}

class SyncStudioBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <section className="sync-panel sync-error-panel">
        <p className="sync-eyebrow">SYNC STUDIO / ERROR</p>
        <h2>声画同步工作台加载失败</h2>
        <p>本地入口已经打开，但模块初始化失败。请刷新页面重试；如果仍然失败，可以把下面这段错误信息发给我。</p>
        <code>{this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}</code>
      </section>;
    }
    return this.props.children;
  }
}

function SyncHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("http://127.0.0.1:8787/api/render-history")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "无法读取本地渲染记录");
        if (!cancelled) setHistory(Array.isArray(data.history) ? data.history : []);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "无法读取本地渲染记录"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return <section className="content-section sync-history-page">
    <div className="section-heading"><div><p className="eyebrow">SYNC STUDIO / RENDER HISTORY</p><h3>渲染历史</h3><p>记录每次 MP4 的视频时长、实际渲染耗时和输出状态，帮助你比较不同方案的效率。</p></div><span className="status-pill">{history.length} 条记录</span></div>
    {loading && <Notice type="success" text="正在读取本地渲染记录……" />}
    {error && <Notice type="warning" text={`${error}。请确认本地声画同步服务正在运行。`} />}
    {!loading && !error && !history.length && <Notice type="warning" text="还没有渲染记录。完成一次 MP4 生成后，记录会自动出现在这里。" />}
    {!loading && !error && history.length > 0 && <div className="sync-history-table-wrap"><table className="sync-history-table"><thead><tr><th>生成时间</th><th>视频时长</th><th>渲染耗时</th><th>字幕</th><th>文件大小</th><th>状态</th><th>操作</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td data-label="生成时间">{formatSyncDate(item.finishedAt || item.startedAt)}</td><td data-label="视频时长">{formatSyncDuration(item.videoDurationMs)}</td><td data-label="渲染耗时">{formatSyncDuration(item.elapsedMs)}</td><td data-label="字幕">{item.includeSubtitles === null ? "未记录" : item.includeSubtitles ? "已嵌入" : "未嵌入"}</td><td data-label="文件大小">{formatFileSize(item.fileSize)}</td><td data-label="状态"><span className={`sync-history-status ${item.status === "completed" ? "success" : "failed"}`}>{item.status === "completed" ? "已完成" : "失败"}</span>{item.legacy && <small className="sync-history-error">历史文件，耗时未记录</small>}{item.error && <small className="sync-history-error">{item.error}</small>}</td><td data-label="操作">{item.status === "completed" && item.videoUrl ? <a className="sync-history-download" href={`http://127.0.0.1:8787${item.videoUrl}`} download={item.filename}>下载 MP4</a> : <span className="sync-history-muted">—</span>}</td></tr>)}</tbody></table></div>}
  </section>;
}

function formatSyncDate(value) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—"; }
function formatSyncDuration(value) { const milliseconds = Number(value); if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "未知"; const totalSeconds = Math.round(milliseconds / 1000); return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}分${String(totalSeconds % 60).padStart(2, "0")}秒`; }
function formatFileSize(value) { const bytes = Number(value || 0); if (!bytes) return "—"; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

async function callAi(action, project) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, project: prepareProjectForApi(project) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "AI 调用失败");
  return data;
}

function stripTransientFilePayload(file = {}) {
  const { base64, ...metadata } = file;
  return metadata;
}

function prepareProjectForApi(project) {
  return {
    ...project,
    sourceFiles: (project.sourceFiles || []).map(stripTransientFilePayload),
    referenceFiles: (project.referenceFiles || []).map(stripTransientFilePayload),
    draftFiles: (project.draftFiles || []).map(stripTransientFilePayload),
    bookFiles: (project.bookFiles || []).map(stripTransientFilePayload)
  };
}

function usageFromAi(data, stage) {
  const usage = data?.usage || {};
  return estimateCall(
    stage,
    data?.model || "openai-api",
    usage.input_tokens || usage.prompt_tokens || 0,
    usage.output_tokens || usage.completion_tokens || 0
  );
}

function BrandBlock() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <img src="/brand-mark.svg" alt="" />
      </div>
      <div>
        <h1>托德学院创作工作台</h1>
        <p>内容生产工作平台</p>
      </div>
    </div>
  );
}

async function uploadFiles(files) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file, file.name));
  const response = await fetch("/api/files", {
    method: "POST",
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "文件上传失败");
  return data.files || [];
}

function AccessGate({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setChecking(true);
    setError("");
    const passwordHash = import.meta.env.VITE_ACCESS_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;
    const inputHash = await sha256Hex(password);
    if (inputHash === passwordHash) {
      grantAccess();
      onSuccess();
    } else {
      setError("访问密码不正确，请重新输入。");
    }
    setChecking(false);
  }

  return (
    <main className="access-page">
      <section className="access-panel">
        <div className="access-brand">
          <BrandBlock />
        </div>
        <form onSubmit={submit} className="access-form">
          <label>
            访问密码
            <input
              type="password"
              value={password}
              placeholder="请输入访问密码"
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
          {error && <Notice type="warning" text={error} />}
          <button className="primary" disabled={!password.trim() || checking}>
            {checking ? "验证中" : "进入后台"}
          </button>
        </form>
        <p className="access-note">临时门禁用于原型分享；正式外部使用建议升级为账号登录与权限管理。</p>
      </section>
    </main>
  );
}

function Section({ title, intro, children, aside }) {
  return (
    <section className="work-section">
      <div className="section-main">
        <div className="section-heading">
          <h3>{title}</h3>
          {intro && <p>{intro}</p>}
        </div>
        {children}
      </div>
      {aside && <aside className="section-aside">{aside}</aside>}
    </section>
  );
}

function Announcement() {
  return (
    <section className="announcement">
      <div>
        <span>本次产品更新</span>
        <h3>{APP_VERSION} 更新清单</h3>
        <details className="release-history">
          <summary>查看历史更新</summary>
          <div className="release-history-list">
            {releaseHistory.map((release) => (
              <article key={release.version}>
                <strong>{release.version}</strong>
                <ul>
                  {release.notes.map((note) => <li key={`${release.version}-${note}`}>{note}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </details>
      </div>
      <ol>
        {releaseNotes.map((note) => <li key={note}>{note}</li>)}
      </ol>
    </section>
  );
}

function UpdateBell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="update-center">
      <button className={`update-bell ${open ? "active" : ""}`} onClick={() => setOpen((current) => !current)} aria-label="查看产品更新" title="产品更新">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      </button>
      {open && (
        <div className="update-popover">
          <div className="update-popover-heading"><strong>产品更新</strong><span>{APP_VERSION}</span></div>
          <ul>{releaseNotes.slice(0, 4).map((note) => <li key={note}>{note}</li>)}</ul>
          <details><summary>查看历史更新</summary><div className="release-history-list">{releaseHistory.map((release) => <article key={release.version}><strong>{release.version}</strong><ul>{release.notes.map((note) => <li key={`${release.version}-${note}`}>{note}</li>)}</ul></article>)}</div></details>
        </div>
      )}
    </div>
  );
}

function ProblemStep({ project, update, logUsage, goNext, setActiveStep }) {
  const ready = project.learnerProblem.trim().length > 20;
  const [loading, setLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  return (
    <Section
      title="第一步：确认学员生活困惑"
      intro="后续书籍匹配、观点拆解、实操建议和写作框架都以这个困惑为中心。"
      aside={<RuleList items={["AI 生成的问题必须由用户确认", "真实问题可直接粘贴", "确认前不能进入书籍匹配"]} />}
    >
      <div className="segmented">
        <button className={project.problemSource === "real" ? "selected" : ""} onClick={() => update({ problemSource: "real", problemConfirmed: false })}>真实学员问题</button>
        <button className={project.problemSource === "ai" ? "selected" : ""} onClick={() => update({ problemSource: "ai", problemConfirmed: false })}>AI 生成问题</button>
      </div>

      <textarea
        className="large-input"
        value={project.learnerProblem}
        placeholder="粘贴学员问题，或点击 AI 生成模拟学员困惑。"
        onChange={(event) => update({ learnerProblem: event.target.value, problemConfirmed: false })}
      />

      <div className="action-row">
        <button
          className="secondary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setAiNotice("");
            try {
              const data = await callAi("generateProblem", project);
              update({ learnerProblem: data.payload.learnerProblem, problemSource: "ai", problemConfirmed: false });
              logUsage("生成学员困惑", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
              setAiNotice("已使用 OpenAI API 生成学员困惑。");
            } catch (error) {
              setAiNotice(`真实 AI 调用失败：${error.message}`);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "AI 生成中" : "AI 生成学员困惑"}
        </button>
        <button
          className={project.problemConfirmed ? "confirmed" : "primary"}
          disabled={!ready || project.problemConfirmed}
          onClick={() => update({ problemConfirmed: true })}
        >
          {project.problemConfirmed ? "已确认" : "确认学员困惑"}
        </button>
        <button className="ghost" disabled={!project.problemConfirmed} onClick={goNext}>进入书籍匹配</button>
      </div>

      {project.problemConfirmed && <Notice type="success" text="学员困惑已确认，可以进入书籍匹配。" />}
      {aiNotice && <Notice type={aiNotice.startsWith("已使用") ? "success" : "warning"} text={aiNotice} />}
      <div className="direct-route-card">
        <div className="direct-route-icon" aria-hidden="true">↗</div>
        <div className="direct-route-copy">
          <strong>已有内容大纲</strong>
          <p>跳过前置流程，直接写作</p>
        </div>
        <button className="direct-route-action" onClick={() => setActiveStep("direct-outline")}>
          直接进入
        </button>
      </div>
    </Section>
  );
}

function BooksStep({ project, update, logUsage, goNext }) {
  const hasSelection = Boolean(project.selectedBookId || project.manualBookConfirmed);
  const [loading, setLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  function confirmManual() {
    if (!project.manualBook.trim()) return;
    update({ manualBookConfirmed: true, selectedBookId: "" });
  }

  return (
    <Section
      title="书籍匹配：AI 推荐 3 本，用户可自主指定"
      intro="第一版候选书只展示书名、作者、推荐理由；不承诺一本书必然解决问题。"
      aside={<RuleList items={["用户不满意推荐时可自主指定", "电子书上传在确认书籍之后", "推荐理由要克制，不写成保证"]} />}
    >
      <div className="action-row">
        <button
          className="primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setAiNotice("");
            try {
              const data = await callAi("matchBooks", project);
              update({ bookCandidates: data.payload.bookCandidates || [], selectedBookId: "", manualBookConfirmed: false });
              logUsage("匹配 3 本候选书", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
              setAiNotice("已使用 OpenAI API 匹配 3 本候选书。");
            } catch (error) {
              setAiNotice(`真实 AI 调用失败：${error.message}`);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "AI 匹配中" : "AI 匹配 3 本候选书"}
        </button>
      </div>
      {aiNotice && <Notice type={aiNotice.startsWith("已使用") ? "success" : "warning"} text={aiNotice} />}

      <div className="book-grid">
        {project.bookCandidates.map((book) => (
          <button
            key={book.id}
            className={`book-card ${project.selectedBookId === book.id ? "selected" : ""}`}
            onClick={() => update({ selectedBookId: book.id, manualBookConfirmed: false })}
          >
            <span>推荐书籍</span>
            <h4>{book.title}</h4>
            <p className="muted">{book.author}</p>
            <p>{book.reason}</p>
          </button>
        ))}
      </div>

      <div className="manual-box">
        <label>AI 推荐不满意时，自主指定书籍</label>
        <div className="inline-form">
          <input value={project.manualBook} placeholder="输入书名，例如：自控力" onChange={(event) => update({ manualBook: event.target.value, manualBookConfirmed: false })} />
          <button
            className={project.manualBookConfirmed ? "confirmed" : "primary"}
            disabled={!project.manualBook.trim() || project.manualBookConfirmed}
            onClick={confirmManual}
          >
            {project.manualBookConfirmed ? "已确认" : "确认指定"}
          </button>
        </div>
        {project.manualBookConfirmed && (
          <Notice type="success" text={`已确认自主指定《${project.manualBook}》。下一步可上传这本书的电子书或补充资料。`} />
        )}
      </div>

      <div className="action-row">
        <button className="primary" disabled={!hasSelection} onClick={goNext}>确认书籍，进入资料准备</button>
      </div>
    </Section>
  );
}

function SourceStep({ project, selectedBook, update, goNext }) {
  const sourceRevision = project.revisionTarget?.route === "source" ? project.revisionTarget : null;
  const selectedTitle = selectedBook?.title || "";
  const sourceMode = project.sourceMode || "quick";
  const needsUpload = sourceMode !== "quick";
  const canConfirmSource = sourceMode === "quick" || project.sourceFiles.length > 0 || project.sourceScope.trim().length > 10 || project.sourceNote.trim().length > 10;

  function changeSourceMode(nextMode) {
    update({
      sourceMode: nextMode,
      sourceConfirmed: false,
      analysis: null,
      analysisConfirmed: false,
      frame: null,
      frameConfirmed: false,
      draft: null,
      review: null,
      sourceUploadError: nextMode === "quick" ? "已选择快速模式：不强制上传电子书，后续将基于通用大模型知识拆解。" : ""
    });
  }

  function handleSourceFiles(files) {
    const mismatched = files
      .map((file) => ({ file, match: validateBookFileMatch(selectedTitle, file.name) }))
      .filter((result) => !result.match.ok);

    if (mismatched.length) {
      const names = mismatched.map(({ file }) => `《${file.name}》`).join("、");
      update({
        sourceFiles: [],
        sourceConfirmed: false,
        sourceUploadError: `上传失败：${names} 与当前书籍《${selectedTitle || "未选择书籍"}》不匹配，请上传正确书籍。`
      });
      return;
    }

    update({
      sourceFiles: files.map((file) => ({
        ...file,
        matchedBookTitle: selectedTitle,
        matchStatus: "matched"
      })),
      sourceConfirmed: false,
      sourceUploadError: files.length ? `已匹配当前书籍《${selectedTitle}》，可继续确认资料状态。` : ""
    });
  }

  function validateSourceFileNames(pickedFiles) {
    if (sourceMode === "deep" && pickedFiles.some((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      update({
        sourceFiles: [],
        sourceConfirmed: false,
        sourceUploadError: "上传失败：深度模式仅支持 PDF 文件，请上传选定书籍的 PDF。"
      });
      return false;
    }

    const mismatched = pickedFiles
      .map((file) => ({ file, match: validateBookFileMatch(selectedTitle, file.name) }))
      .filter((result) => !result.match.ok);

    if (mismatched.length) {
      const names = mismatched.map(({ file }) => `《${file.name}》`).join("、");
      update({
        sourceFiles: [],
        sourceConfirmed: false,
        sourceUploadError: `上传失败：${names} 与当前书籍《${selectedTitle || "未选择书籍"}》不匹配，请上传正确书籍。`
      });
      return false;
    }
    return true;
  }

  return (
    <Section
      title="选择资料准备模式"
      intro={`当前书籍：${selectedBook?.title || "尚未选择"}。默认不强制上传电子书，按交付严谨度选择资料模式。`}
      aside={<RuleList items={["快速模式成本最低", "证据模式限定章节/摘录", "深度模式适合页码引用和严肃交付"]} />}
    >
      <div className="mode-grid">
        <button className={`mode-card ${sourceMode === "quick" ? "selected" : ""}`} onClick={() => changeSourceMode("quick")}>
          <span>快速模式</span>
          <strong>通用模型知识拆解</strong>
          <p>不上传电子书，速度最快，成本最低；适合知名书籍和普通读书会内容。</p>
        </button>
        <button className={`mode-card ${sourceMode === "evidence" ? "selected" : ""}`} onClick={() => changeSourceMode("evidence")}>
          <span>证据模式</span>
          <strong>章节、摘录、划线限定</strong>
          <p>上传或粘贴指定目录、章节、摘录、划线内容，Agent 只在指定范围内拆解。</p>
        </button>
        <button className={`mode-card ${sourceMode === "deep" ? "selected" : ""}`} onClick={() => changeSourceMode("deep")}>
          <span>深度模式</span>
          <strong>PDF 精读与来源核验</strong>
          <p>上传 PDF，优先追求页码、章节和引用严谨性；token 成本最高。</p>
        </button>
      </div>

      {needsUpload && (
        <FilePicker
          label={sourceMode === "deep" ? "上传完整 PDF 或严肃交付资料" : "上传章节、摘录、划线或局部资料"}
          files={project.sourceFiles}
          beforeRead={validateSourceFileNames}
          onChange={handleSourceFiles}
        />
      )}
      {project.sourceUploadError && (
        <Notice type={project.sourceUploadError.startsWith("上传失败") ? "warning" : "success"} text={project.sourceUploadError} />
      )}
      {sourceRevision && (
        <Notice type="warning" text={`审核未通过：${sourceRevision.reason}`} />
      )}
      {sourceMode !== "quick" && (
        <textarea
          className="medium-input"
          value={project.sourceScope}
          placeholder="指定目录、章节、页码范围、摘录、划线内容或检索边界。证据模式会严格限定在这里描述的范围内。"
          onChange={(event) => update({ sourceScope: event.target.value, sourceConfirmed: false })}
        />
      )}
      <textarea
        className="medium-input"
        value={project.sourceNote}
        placeholder={sourceMode === "quick" ? "可补充你已知的书籍版本、作者、译本或希望避开的内容；也可以留空。" : "可补充资料来源说明、版本信息、译本信息或人工校验备注。"}
        onChange={(event) => update({ sourceNote: event.target.value, sourceConfirmed: false })}
      />
      <div className="action-row">
        <button
          className={project.sourceConfirmed ? "confirmed" : "primary"}
          disabled={!canConfirmSource || project.sourceConfirmed}
          onClick={() => update({ sourceConfirmed: true, revisionTarget: null })}
        >
          {project.sourceConfirmed ? "已确认" : "确认资料状态"}
        </button>
        <button className="ghost" disabled={!project.sourceConfirmed} onClick={goNext}>进入书籍拆解</button>
      </div>
      {project.sourceConfirmed && <Notice type="success" text={`资料状态已确认。当前采用${sourceMode === "quick" ? "快速模式：基于通用模型知识拆解。" : sourceMode === "evidence" ? "证据模式：严格围绕指定章节、摘录和划线内容拆解。" : "深度模式：优先使用上传 PDF 做页码、章节和来源核验。"}`} />}
    </Section>
  );
}

function countFrameUnits(frame = []) {
  return frame.reduce((sum, item) => sum + 1 + (item.children?.length || 0), 0);
}

function isDestructiveFrameRewrite(previousFrame = [], nextFrame = []) {
  if (!previousFrame.length || !nextFrame.length) return false;
  const previousUnits = countFrameUnits(previousFrame);
  const nextUnits = countFrameUnits(nextFrame);
  return nextUnits < Math.max(3, Math.ceil(previousUnits * 0.7));
}

function AnalysisStep({ project, selectedBook, update, logUsage, goNext }) {
  const [loading, setLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const hasAnalysisFeedback = project.analysisFeedback.trim().length > 0;

  useEffect(() => {
    if (!loading) return undefined;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function generateAnalysis() {
    setLoading(true);
    setAiNotice("");
    try {
      const data = await callAi("analyzeBook", project);
      update({
        analysis: data.payload.analysis,
        analysisHistory: project.analysis ? [project.analysis, ...(project.analysisHistory || [])].slice(0, 3) : project.analysisHistory,
        analysisFeedback: "",
        analysisNotice: project.analysis ? "已按反馈重新生成书籍拆解；如不满意可撤回到上一版。" : "",
        analysisConfirmed: false,
        frameConfirmed: false,
        draft: null,
        review: null
      });
      logUsage("书籍观点拆解", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
      setAiNotice(project.analysis ? "已使用 OpenAI API 重新生成拆解结果。" : "已使用 OpenAI API 按当前资料模式生成拆解结果。");
    } catch (error) {
      setAiNotice(`真实 AI 调用失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section
      title="书籍拆解与落地实操"
      intro="只提取与学员困惑相关的 Y 个观点，不做整本书完整读书笔记。"
      aside={<RuleList items={["观点要围绕困惑", "建议不超过 4 条", "避免提升认知等空泛建议"]} />}
    >
      <div className="action-row">
        <button
          className="primary"
          disabled={loading}
          onClick={generateAnalysis}
        >
          {loading ? "AI 拆解中" : "生成拆解结果"}
        </button>
      </div>
      {loading && (
        <WorkProgress
          elapsedSeconds={elapsedSeconds}
          title="正在拆解书籍观点"
          description={project.sourceMode === "quick"
            ? "AI 正在基于通用模型知识、学员困惑和选定书籍提取观点与实操建议。"
            : project.sourceMode === "evidence"
              ? "AI 正在严格围绕指定章节、摘录和划线资料提取观点与实操建议。"
              : "AI 正在结合上传 PDF 做更严谨的来源核验与观点拆解。"}
        />
      )}
      {aiNotice && <Notice type={aiNotice.startsWith("已使用") ? "success" : "warning"} text={aiNotice} />}
      {project.analysisNotice && <Notice type="success" text={project.analysisNotice} />}
      {project.analysis && (
        <div className="stack">
          <InfoBlock title="作者与影响力简介" body={`${project.analysis.authorIntro}\n\n${project.analysis.influenceIntro}`} />
          <div className="list-panel">
            <h4>相关观点 Y</h4>
            {project.analysis.ideas.map((idea) => (
              <article key={idea.title} className="idea-row">
                <strong>{idea.title}</strong>
                <p>{idea.body}</p>
                <div className="source-box">
                  <span>详细来源</span>
                  <p>{idea.source}</p>
                  <small>{idea.evidence}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="list-panel">
            <h4>落地实操建议</h4>
            <div className="practice-list">
              {project.analysis.practices.map((practice, index) => (
                <article key={practice.title} className="practice-row">
                  <strong>{index + 1}. {practice.title}</strong>
                  <p>{practice.body}</p>
                  <div className="source-box">
                    <span>详细来源</span>
                    <p>{practice.source}</p>
                    <small>{practice.evidence}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="action-row">
            <button
              className={project.analysisConfirmed ? "confirmed" : "primary"}
              disabled={project.analysisConfirmed}
              onClick={() => update({ analysisConfirmed: true })}
            >
              {project.analysisConfirmed ? "已确认" : "确认拆解结果"}
            </button>
            <button className="ghost" disabled={!project.analysisConfirmed} onClick={goNext}>进入结构框架</button>
          </div>
          <textarea
            className="medium-input"
            value={project.analysisFeedback}
            placeholder="如果不认可拆解结果，在这里说明问题，例如：观点和学员困惑不够贴合，实操建议太泛。"
            onChange={(event) => update({ analysisFeedback: event.target.value, analysisConfirmed: false, analysisNotice: "" })}
          />
          <div className="action-row">
            <button
              className={hasAnalysisFeedback ? "secondary ready" : "secondary"}
              disabled={!hasAnalysisFeedback || loading}
              onClick={generateAnalysis}
            >
              不认可，重新拆解
            </button>
            <button
              className="ghost"
              disabled={!project.analysisHistory?.length}
              onClick={() => update({
                analysis: project.analysisHistory[0],
                analysisHistory: project.analysisHistory.slice(1),
                analysisFeedback: "",
                analysisConfirmed: false,
                analysisNotice: "已撤回到上一版书籍拆解。"
              })}
            >
              撤回上版拆解
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function FrameStep({ project, update, logUsage, goNext }) {
  const hasFeedback = project.frameFeedback.trim().length > 0;
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!loading) return undefined;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function generateFrameWithAi() {
    setLoading(true);
    update({ frameNotice: "" });
    try {
      const data = await callAi("generateFrame", project);
      const nextFrame = Array.isArray(data.payload?.frame) ? data.payload.frame : [];
      if (!nextFrame.length) throw new Error("AI 没有返回可用的结构框架，请重试");
      if (isDestructiveFrameRewrite(project.frame || [], nextFrame)) {
        update({
          frameNotice: "AI 结果疑似删除了过多模块，已拒绝覆盖当前框架。请把整合关系写得更具体，或先撤回后再重试。"
        });
        return;
      }
      update({
        frame: nextFrame,
        frameHistory: project.frame ? [project.frame, ...(project.frameHistory || [])].slice(0, 3) : project.frameHistory,
        frameFeedback: "",
        frameConfirmed: false,
        frameNotice: project.frame ? "已按反馈重新生成结构框架，上一版可撤回。" : "已使用 OpenAI API 生成结构框架。",
        settingsConfirmed: false,
        draft: null,
        review: null
      });
      logUsage("生成文字稿结构框架", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
    } catch (error) {
      update({ frameNotice: `真实 AI 调用失败：${error.message}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section
      title="输出文字稿结构框架"
      intro="这里不是输出全文，而是确认课程/音频稿的模块顺序和论证功能。你也可以使用侧边栏的并行入口，直接粘贴已有大纲开始写作。"
      aside={<RuleList items={["确认框架后才进入写作设置", "反馈会覆盖旧框架", "框架必须回扣学员困惑"]} />}
    >
      <div className="action-row">
        <button
          className="primary"
          disabled={loading}
          onClick={generateFrameWithAi}
        >
          {loading ? "AI 生成中" : "生成结构框架"}
        </button>
      </div>
      {loading && (
        <WorkProgress
          elapsedSeconds={elapsedSeconds}
          title="正在生成结构框架"
          description="AI 正在根据学员困惑、书籍拆解和实操建议生成文字稿大纲。"
        />
      )}
      {project.frameNotice && (
        <Notice
          type={project.frameNotice.startsWith("真实") || project.frameNotice.includes("拒绝覆盖") ? "warning" : "success"}
          text={project.frameNotice}
        />
      )}
      {project.frame && (
        <div className="stack">
          <div className="timeline">
            {project.frame.map((item, index) => (
              <article key={item.title}>
                <span>{index + 1}</span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.goal}</p>
                  {Boolean(item.children?.length) && (
                    <div className="branch-list">
                      {item.children.map((child) => (
                        <div key={`${item.title}-${child.title}`}>
                          <strong>{child.title}</strong>
                          <p>{child.goal}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          <textarea
            className="medium-input"
            value={project.frameFeedback}
            placeholder="如果框架有问题，在这里输入调整反馈。"
            onChange={(event) => update({ frameFeedback: event.target.value, frameConfirmed: false, frameNotice: "" })}
          />
          {!hasFeedback && !project.frameConfirmed && (
            <p className="helper-text">需要调整时，先输入反馈；输入后“按反馈重生成”会变为可点击。</p>
          )}
          {project.frameConfirmed && <Notice type="success" text="文字稿结构框架已确认，可以进入写作设置。" />}
          <div className="action-row">
            <button
              className={hasFeedback ? "secondary ready" : "secondary"}
              disabled={!hasFeedback || loading}
              onClick={generateFrameWithAi}
            >
              按反馈重生成
            </button>
            <button
              className="ghost"
              disabled={!project.frameHistory?.length}
              onClick={() => update({
                frame: project.frameHistory[0],
                frameHistory: project.frameHistory.slice(1),
                frameFeedback: "",
                frameConfirmed: false,
                frameNotice: "已撤回到上一版结构框架。"
              })}
            >
              撤回上一版
            </button>
            <button
              className={project.frameConfirmed ? "confirmed" : "primary"}
              disabled={project.frameConfirmed}
              onClick={() => update({ frameConfirmed: true, frameNotice: "" })}
            >
              {project.frameConfirmed ? "已确认" : "确认结构框架"}
            </button>
            <button className="ghost" disabled={!project.frameConfirmed} onClick={goNext}>进入写作设置</button>
          </div>
        </div>
      )}
    </Section>
  );
}

function DirectOutlineStep({ project, update, setActiveStep }) {
  const ready = project.directOutline.trim().length >= 20;

  function saveOutline() {
    if (!ready) return;
    update({
      directOutline: project.directOutline.trim(),
      directOutlineConfirmed: true,
      frameConfirmed: false,
      settingsConfirmed: false,
      draft: null,
      review: null,
      revisionTarget: null
    });
    setActiveStep("settings");
  }

  return (
    <Section
      title="直接使用已有内容大纲"
      intro="如果大纲来自其他专家、课程负责人或你自己的整理，可以从这里开始。无需先完成学员困惑、书籍匹配和书籍拆解。"
      aside={<RuleList items={["支持粘贴文字版大纲", "AI 会围绕大纲扩写正文", "仍需确认写作设置与审核"]} />}
    >
      <div className="parallel-intro">
        <span className="parallel-badge">并行入口</span>
        <div>
          <strong>你已经有内容方向了吗？</strong>
          <p>直接粘贴模块、标题、要点或写作要求，AI 会把它作为本次写作的主框架。</p>
        </div>
      </div>
      <label className="outline-label" htmlFor="direct-outline">内容大纲</label>
      <textarea
        id="direct-outline"
        className="large-input outline-input"
        value={project.directOutline}
        placeholder={'例如：\n1. 开场：呈现学员的真实困惑\n2. 核心观点：解释问题背后的心理机制\n3. 方法：给出三个可执行练习\n4. 结尾：总结行动建议'}
        onChange={(event) => update({ directOutline: event.target.value, directOutlineConfirmed: false, settingsConfirmed: false, draft: null, review: null })}
      />
      <div className="outline-meta">
        <span>{project.directOutline.trim().length} 字</span>
        <span>建议包含模块顺序、重点观点或希望写出的内容</span>
      </div>
      <div className="action-row">
        <button className={project.directOutlineConfirmed ? "confirmed" : "primary"} disabled={!ready || project.directOutlineConfirmed} onClick={saveOutline}>
          {project.directOutlineConfirmed ? "已确认大纲" : "确认大纲，进入写作设置"}
        </button>
      </div>
      {project.directOutlineConfirmed && <Notice type="success" text="大纲已保存。接下来只需确认写作方式和目标字数，AI 就会开始写作。" />}
    </Section>
  );
}

function SettingsStep({ project, update, goNext }) {
  const validWordCount = Number(project.wordCount) >= 500;
  return (
    <Section
      title="写作方式、字数与参考稿"
      intro={project.directOutlineConfirmed ? "当前将围绕你提供的已有内容大纲写作。确认字数和参考稿状态后，AI 才开始输出。" : "选择写作策略后不立即输出；确认字数和参考稿状态后，AI 才开始写作。"}
      aside={<RuleList items={["预算小于 $5 时推荐分模块写作", "参考稿可以是局部段落", "字数影响模块篇幅分配"]} />}
    >
      <div className="segmented">
        <button className={project.writingMode === "one-shot" ? "selected" : ""} onClick={() => update({ writingMode: "one-shot", settingsConfirmed: false })}>一次性写作</button>
        <button className={project.writingMode === "modular" ? "selected" : ""} onClick={() => update({ writingMode: "modular", settingsConfirmed: false })}>分模块写作</button>
      </div>

      <div className="form-grid">
        <label>
          字数规则
          <select value={project.wordRule} onChange={(event) => update({ wordRule: event.target.value, settingsConfirmed: false })}>
            <option value="around">控制在</option>
            <option value="minimum">不少于</option>
          </select>
        </label>
        <label>
          目标字数
          <input type="number" min="500" step="100" value={project.wordCount} onChange={(event) => update({ wordCount: Number(event.target.value), settingsConfirmed: false })} />
        </label>
      </div>

      <label className="checkbox-row">
        <input type="checkbox" checked={project.hasReference} onChange={(event) => update({ hasReference: event.target.checked, settingsConfirmed: false })} />
        有参考文稿或参考段落
      </label>

      {project.hasReference && (
        <div className="stack">
          <FilePicker label="上传参考文稿" files={project.referenceFiles} onChange={(files) => update({ referenceFiles: files, settingsConfirmed: false })} />
          <textarea className="medium-input" value={project.referenceText} placeholder="也可以粘贴局部参考段落。" onChange={(event) => update({ referenceText: event.target.value, settingsConfirmed: false })} />
        </div>
      )}

      <div className="action-row">
        <button
          className={project.settingsConfirmed ? "confirmed" : "primary"}
          disabled={!validWordCount || project.settingsConfirmed}
          onClick={() => update({ settingsConfirmed: true })}
        >
          {project.settingsConfirmed ? "已确认" : "确认写作设置"}
        </button>
        <button className="ghost" disabled={!project.settingsConfirmed} onClick={goNext}>进入 AI 写作</button>
      </div>
    </Section>
  );
}

function DraftStep({ project, update, logUsage, goNext }) {
  const draftRevision = project.revisionTarget?.route === "draft" ? project.revisionTarget : null;
  const [loading, setLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [progressStartedAt, setProgressStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!loading || !progressStartedAt) return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.round((Date.now() - progressStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading, progressStartedAt]);

  function startProgress() {
    const now = Date.now();
    setProgressStartedAt(now);
    setElapsedSeconds(0);
  }

  function stopProgress() {
    setProgressStartedAt(null);
  }

  function useManualDraft() {
    const text = project.manualDraftText.trim();
    const fileNames = (project.draftFiles || []).map((file) => file.name).join(" / ");
    if (!text && !project.draftFiles?.length) return;
    update({
      draft: {
        mode: "manual",
        wordTarget: "用户自有文字稿",
        modules: [{ key: "manual-draft", title: "用户自有文字稿", content: text || `用户上传了待审核文稿文件：${fileNames}` }],
        fullText: text || `用户上传了待审核文稿文件：${fileNames}`
      },
      review: null,
      copyStatus: "",
      revisionTarget: null
    });
    setAiNotice("已使用用户自有文字稿，可以进入 AI 审核。");
  }

  return (
      <Section
      title="AI 开始写作"
      intro="可调用真实 API 生成文字稿，也可以粘贴或上传用户自有文稿后直接进入审核。"
      aside={<RuleList items={["所有前置条件已确认", "支持用户自有文稿", "下一步进入 AI 审核"]} />}
    >
      <div className="action-row">
        <button
          className="primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            startProgress();
            setAiNotice("");
            try {
              const data = await callAi("generateDraft", project);
              update({
                draft: data.payload.draft,
                revisionTarget: null,
                resolvedReviewKeys: project.revisionTarget
                  ? Array.from(new Set([...(project.resolvedReviewKeys || []), project.revisionTarget.key]))
                  : project.resolvedReviewKeys,
                review: null,
                copyStatus: ""
              });
              logUsage("生成文字稿", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
              setAiNotice("已使用 OpenAI API 生成真实长文。");
            } catch (error) {
              setAiNotice(`真实 AI 调用失败：${error.message}`);
            } finally {
              setLoading(false);
              stopProgress();
            }
          }}
        >
          {loading ? "AI 写作中" : draftRevision ? "按审核意见重生成文字稿" : "生成文字稿"}
        </button>
        <button className="ghost" disabled={!project.draft} onClick={goNext}>进入 AI 审核</button>
      </div>
      <div className="manual-box">
        <label>用户自有文字稿</label>
        <textarea
          className="medium-input no-top"
          value={project.manualDraftText}
          placeholder="也可以直接粘贴用户自己写好的文字稿，确认后跳过 AI 生成，进入 AI 审核。"
          onChange={(event) => update({ manualDraftText: event.target.value, draft: null, review: null })}
        />
        <FilePicker
          label="上传用户自有文稿"
          files={project.draftFiles || []}
          onChange={(files) => update({ draftFiles: files, draft: null, review: null })}
        />
        <div className="action-row">
          <button
            className={project.draft?.mode === "manual" ? "confirmed" : "secondary ready"}
            disabled={project.draft?.mode === "manual" || (!project.manualDraftText.trim() && !project.draftFiles?.length)}
            onClick={useManualDraft}
          >
            {project.draft?.mode === "manual" ? "已确认自有文稿" : "使用自有文稿进入审核"}
          </button>
        </div>
      </div>
      {draftRevision && (
        <Notice type="warning" text={`审核未通过：${draftRevision.reason}`} />
      )}
      {loading && <GenerationProgress elapsedSeconds={elapsedSeconds} wordCount={project.wordCount} />}
      {aiNotice && <Notice type={aiNotice.startsWith("已使用") ? "success" : "warning"} text={aiNotice} />}
      {project.draft && (
        <div className="draft-preview">
          <div className="draft-meta">
            <span>{project.draft.mode === "modular" ? "分模块写作" : "一次性写作"}</span>
            <span>{project.draft.wordTarget}</span>
          </div>
          <pre>{project.draft.fullText}</pre>
        </div>
      )}
    </Section>
  );
}

function GenerationProgress({ elapsedSeconds, wordCount }) {
  const estimatedSeconds = Math.max(45, Math.min(180, Math.round(Number(wordCount || 3500) / 28)));
  const progress = Math.min(92, Math.max(8, Math.round((elapsedSeconds / estimatedSeconds) * 88)));
  const stage = elapsedSeconds < 8
    ? "正在整理框架、书籍拆解和写作约束"
    : elapsedSeconds < 25
      ? "已发送到模型，正在生成正文"
      : elapsedSeconds < 60
        ? "长文生成中，等待模型返回完整结果"
        : "仍在生成，请保持页面打开";

  return (
    <div className="generation-panel" role="status" aria-live="polite">
      <div className="generation-header">
        <span className="spinner" aria-hidden="true" />
        <div>
          <strong>{stage}</strong>
          <p>真实 API 正在处理，本页没有卡死。长文会在模型返回后一次性展示。</p>
        </div>
        <em>{progress}%</em>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-meta">
        <span>已等待 {elapsedSeconds}s</span>
        <span>目标字数 {wordCount} 字</span>
        <span>请勿刷新页面</span>
      </div>
    </div>
  );
}

function WorkProgress({ elapsedSeconds, title, description }) {
  const progress = Math.min(90, Math.max(10, 10 + elapsedSeconds * 6));
  return (
    <div className="generation-panel compact" role="status" aria-live="polite">
      <div className="generation-header">
        <span className="spinner" aria-hidden="true" />
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <em>{progress}%</em>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-meta">
        <span>已等待 {elapsedSeconds}s</span>
        <span>正在等待模型返回</span>
      </div>
    </div>
  );
}

function inferBookMetadata(fileName = "") {
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/\s+/g, " ").trim();
  const authorMatch = baseName.match(/\(([^()]+)\)/);
  const cleanTitle = baseName
    .replace(/\([^()]+\)/g, "")
    .replace(/\s*[|｜].*$/, "")
    .replace(/\s*[-–—]\s*(z[- ]?library|libgen|pdf).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const author = authorMatch && !/z[- ]?library|libgen|pdf|sk|site/i.test(authorMatch[1]) ? authorMatch[1].trim() : "";
  return { title: cleanTitle, author };
}

function BookUploadStep({ project, update, goNext }) {
  const languageBlocked = project.bookLanguageStatus === "english-unsupported";
  const ready = Boolean(project.bookFiles?.length && project.bookTitle.trim() && !languageBlocked);
  function handleBookFiles(files) {
    const metadata = inferBookMetadata(files[0]?.name || "");
    const hasEnglishBook = files.some((file) => file.language === "english");
    update({
      bookFiles: files,
      bookTitle: project.bookTitle.trim() || metadata.title,
      bookAuthor: project.bookAuthor.trim() || metadata.author,
      bookLanguageStatus: hasEnglishBook ? "english-unsupported" : "",
      bookSourceConfirmed: false,
      bookAnalysis: null,
      bookAnalysisConfirmed: false,
      bookDraft: null,
      bookReview: null
    });
  }
  return (
    <>
      <Section
        title="第一步：上传要拆解的书籍"
        intro="从一本书开始，AI 会围绕上传资料提取知识结构，并最终生成一篇完整的书籍拆解文稿。"
        aside={<RuleList items={["建议上传完整 PDF", "书名和作者可手动补充", "纯英文书籍暂不支持解读"]} />}
      >
      <div className="form-grid">
        <label>书名<input value={project.bookTitle} placeholder="例如：思考，快与慢" onChange={(event) => update({ bookTitle: event.target.value, bookSourceConfirmed: false })} /></label>
        <label>作者<input value={project.bookAuthor} placeholder="可选" onChange={(event) => update({ bookAuthor: event.target.value, bookSourceConfirmed: false })} /></label>
      </div>
      <FilePicker
        label="上传书籍资料"
        files={project.bookFiles || []}
        onChange={handleBookFiles}
      />
      {languageBlocked && <Notice type="warning" text="检测到这是一份纯英文书籍，当前暂不支持解读英文书籍。" />}
      {project.bookSourceConfirmed && <Notice type="success" text={`已确认《${project.bookTitle}》，可以开始知识解读。`} />}
      <div className="action-row">
        <button className={project.bookSourceConfirmed ? "confirmed" : "primary"} disabled={!ready || project.bookSourceConfirmed} onClick={() => update({ bookSourceConfirmed: true })}>
          {project.bookSourceConfirmed ? "已确认书籍" : "确认书籍资料"}
        </button>
        <button className="ghost" disabled={!project.bookSourceConfirmed} onClick={goNext}>开始知识解读</button>
      </div>
      </Section>
      {languageBlocked && <LanguageBlockModal onClose={() => update({ bookLanguageStatus: "" })} />}
    </>
  );
}

function LanguageBlockModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="language-modal" role="alertdialog" aria-modal="true" aria-labelledby="language-modal-title">
        <div className="modal-icon">!</div>
        <h3 id="language-modal-title">暂时不支持解读英文书籍</h3>
        <p>当前版本仅支持以中文为主要内容的书籍。中文书籍中的英文术语、英文段落或英文引用不影响正常解读。</p>
        <button className="primary" onClick={onClose}>知道了，重新选择</button>
      </div>
    </div>
  );
}

function BookAnalysisStep({ project, update, logUsage, goNext }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const hasFeedback = project.bookAnalysisFeedback.trim().length > 0;

  async function generateAnalysis() {
    setLoading(true);
    setNotice("");
    try {
      const data = await callAi("generateBookAnalysis", project);
      update({
        bookAnalysis: data.payload.bookAnalysis,
        bookAnalysisHistory: project.bookAnalysis ? [project.bookAnalysis, ...(project.bookAnalysisHistory || [])].slice(0, 3) : project.bookAnalysisHistory,
        bookAnalysisFeedback: "",
        bookAnalysisConfirmed: false,
        bookDraft: null,
        bookReview: null
      });
      logUsage("书籍知识解读", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
      setNotice("已生成书籍知识解读，请确认内容后继续。");
    } catch (error) {
      setNotice(`真实 AI 调用失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section
      title="第二步：书籍知识解读"
      intro={`当前书籍：《${project.bookTitle || "未命名书籍"}》。先形成可核验的知识解读，再进入文稿写作。`}
      aside={<RuleList items={["围绕上传书籍提取内容", "页码或引用不确定时标记人工核验", "确认解读后进入写作设置"]} />}
    >
      <div className="action-row"><button className="primary" disabled={loading} onClick={generateAnalysis}>{loading ? "AI 解读中" : project.bookAnalysis ? "重新生成知识解读" : "生成知识解读"}</button></div>
      {notice && <Notice type={notice.startsWith("真实") ? "warning" : "success"} text={notice} />}
      {project.bookAnalysis && (
        <div className="stack">
          <InfoBlock title="全书核心主题" body={project.bookAnalysis.coreTheme} />
          <InfoBlock title="作者与写作意图" body={`${project.bookAnalysis.authorIntro}\n\n${project.bookAnalysis.authorIntent}`} />
          <div className="list-panel"><h4>章节与核心观点</h4>{(project.bookAnalysis.chapters || []).map((chapter) => <article key={chapter.title} className="idea-row"><strong>{chapter.title}</strong><p>{chapter.summary}</p><div className="source-box"><span>来源线索</span><p>{chapter.source}</p></div></article>)}</div>
          <div className="list-panel"><h4>关键概念</h4>{(project.bookAnalysis.concepts || []).map((concept) => <article key={concept.name} className="idea-row"><strong>{concept.name}</strong><p>{concept.explanation}</p></article>)}</div>
          <textarea className="medium-input" value={project.bookAnalysisFeedback} placeholder="如果解读不准确，请写出需要补充、删减或重新组织的部分。" onChange={(event) => update({ bookAnalysisFeedback: event.target.value, bookAnalysisConfirmed: false })} />
          <div className="action-row">
            <button className={hasFeedback ? "secondary ready" : "secondary"} disabled={!hasFeedback || loading} onClick={generateAnalysis}>按反馈重新解读</button>
            <button className="ghost" disabled={!project.bookAnalysisHistory?.length} onClick={() => update({ bookAnalysis: project.bookAnalysisHistory[0], bookAnalysisHistory: project.bookAnalysisHistory.slice(1), bookAnalysisConfirmed: false })}>撤回上一版</button>
            <button className={project.bookAnalysisConfirmed ? "confirmed" : "primary"} disabled={project.bookAnalysisConfirmed} onClick={() => update({ bookAnalysisConfirmed: true })}>{project.bookAnalysisConfirmed ? "已确认解读" : "确认解读结果"}</button>
            <button className="ghost" disabled={!project.bookAnalysisConfirmed} onClick={goNext}>进入写作设置</button>
          </div>
        </div>
      )}
    </Section>
  );
}

function BookSettingsStep({ project, update, goNext }) {
  const valid = project.bookWritingTitle.trim() && Number(project.bookWordCount) >= 500;
  return (
    <Section title="第三步：确定书籍拆解文稿方向" intro="先确认这篇文稿写给谁、以什么形式呈现，再开始生成正文。" aside={<RuleList items={["标题决定文稿主线", "文稿类型影响表达方式", "建议默认分模块写作"]} />}>
      <div className="form-grid">
        <label>文稿标题<input value={project.bookWritingTitle} placeholder={`例如：《${project.bookTitle || "这本书"}》核心解读`} onChange={(event) => update({ bookWritingTitle: event.target.value, bookSettingsConfirmed: false })} /></label>
        <label>目标读者<select value={project.bookAudience} onChange={(event) => update({ bookAudience: event.target.value, bookSettingsConfirmed: false })}><option>普通读者</option><option>课程学员</option><option>管理者</option><option>亲子家庭</option></select></label>
        <label>文稿类型<select value={project.bookWritingType} onChange={(event) => update({ bookWritingType: event.target.value, bookSettingsConfirmed: false })}><option>读书拆解稿</option><option>课程讲稿</option><option>音频稿</option><option>公众号文章</option><option>知识分享稿</option></select></label>
        <label>目标字数<input type="number" min="500" step="100" value={project.bookWordCount} onChange={(event) => update({ bookWordCount: Number(event.target.value), bookSettingsConfirmed: false })} /></label>
      </div>
      <textarea className="medium-input" value={project.bookTopic} placeholder="可补充希望重点讲解的主题、案例或行动建议；也可以留空。" onChange={(event) => update({ bookTopic: event.target.value, bookSettingsConfirmed: false })} />
      <div className="segmented"><button className={project.bookWritingMode === "one-shot" ? "selected" : ""} onClick={() => update({ bookWritingMode: "one-shot", bookSettingsConfirmed: false })}>一次性写作</button><button className={project.bookWritingMode === "modular" ? "selected" : ""} onClick={() => update({ bookWritingMode: "modular", bookSettingsConfirmed: false })}>分模块写作</button></div>
      <div className="action-row"><button className={project.bookSettingsConfirmed ? "confirmed" : "primary"} disabled={!valid || project.bookSettingsConfirmed} onClick={() => update({ bookSettingsConfirmed: true })}>{project.bookSettingsConfirmed ? "已确认写作设置" : "确认写作设置"}</button><button className="ghost" disabled={!project.bookSettingsConfirmed} onClick={goNext}>生成书籍拆解稿</button></div>
    </Section>
  );
}

function BookDraftStep({ project, update, logUsage, goNext }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  async function generateDraft() {
    setLoading(true); setNotice("");
    try {
      const data = await callAi("generateBookDraft", project);
      update({ bookDraft: data.payload.draft, bookReview: null });
      logUsage("生成书籍拆解文稿", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
      setNotice("已生成书籍拆解文稿，可以进入 AI 审核。");
    } catch (error) { setNotice(`真实 AI 调用失败：${error.message}`); } finally { setLoading(false); }
  }
  return (
    <Section title="第四步：生成书籍拆解文稿" intro="AI 会结合上传书籍、知识解读和写作设置生成完整成品稿。" aside={<RuleList items={["优先依据上传书籍", "保留作者观点和章节脉络", "生成后仍需 AI 审核"]} />}>
      <div className="action-row"><button className="primary" disabled={loading} onClick={generateDraft}>{loading ? "AI 写作中" : project.bookDraft ? "重新生成文稿" : "生成成品文稿"}</button><button className="ghost" disabled={!project.bookDraft} onClick={goNext}>进入 AI 审核</button></div>
      {notice && <Notice type={notice.startsWith("真实") ? "warning" : "success"} text={notice} />}
      {project.bookDraft && <div className="draft-preview"><div className="draft-meta"><span>{project.bookWritingType}</span><span>{project.bookWordRule === "minimum" ? "不少于" : "控制在"} {project.bookWordCount} 字</span></div><pre>{project.bookDraft.fullText}</pre></div>}
    </Section>
  );
}

function BookReviewStep({ project, update, logUsage, completeCurrentRound }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const allPassed = Boolean(project.bookReview?.length) && project.bookReview.every((item) => item.status === "通过");
  async function reviewDraft() {
    setLoading(true); setNotice("");
    try {
      const data = await callAi("reviewBookDraft", project);
      update({ bookReview: data.payload.review || [], copyStatus: "" });
      logUsage("书籍拆解文稿审核", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
      setNotice("已生成书籍拆解审核报告。");
    } catch (error) { setNotice(`真实 AI 调用失败：${error.message}`); } finally { setLoading(false); }
  }
  function markPassed(key) { update({ bookReview: project.bookReview.map((item) => item.key === key ? { ...item, status: "通过" } : item) }); }
  return (
    <Section title="第五步：AI 审核与交付" intro="重点检查书籍观点准确性、来源线索和文稿表达。" aside={<RuleList items={["核对是否忠实原书", "引用和页码需要人工复核", "全部通过后确认交付"]} />}>
      <div className="action-row"><button className="primary" disabled={loading} onClick={reviewDraft}>{loading ? "审核中" : "生成审核报告"}</button></div>
      {notice && <Notice type={notice.startsWith("真实") ? "warning" : "success"} text={notice} />}
      {project.bookReview && <div className="review-grid">{project.bookReview.map((item) => <article key={item.key} className={`review-card ${item.status === "通过" ? "passed-card" : ""}`}><span>{item.status}</span><h4>{item.type}</h4><p>{item.detail}</p>{item.status !== "通过" && <button className="secondary ready" onClick={() => markPassed(item.key)}>人工确认通过</button>}</article>)}</div>}
      {allPassed && <div className="approved-output"><div className="approved-header"><div><h4>书籍拆解文稿已审核通过</h4><p>现在可以确认本轮任务完结并保存到历史记录。</p></div><button className="primary" onClick={completeCurrentRound}>确认本轮任务完结</button></div><pre>{project.bookDraft?.fullText}</pre></div>}
    </Section>
  );
}

function HistoryStep({ history, workflowType }) {
  return (
    <Section
      title="历史记录"
      intro={`这里保留“${workflowType === "book" ? "书籍拆解" : "读书会写作"}”最近 10 篇已确认完结的生成稿件，方便回看。`}
      aside={<RuleList items={["仅保存在当前浏览器", "最多保留最近 10 篇", "正式版会保存到数据库"]} />}
    >
      {!history.length && <Notice type="warning" text="还没有历史稿件。完成一次审核通过并确认完结后，这里会出现记录。" />}
      <div className="history-list">
        {history.map((item) => (
          <article key={item.id} className="history-card">
            <div className="history-meta">
              <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
              <span>{item.wordTarget}</span>
            </div>
            <h4>{item.title}</h4>
            <p>书籍：{item.bookTitle}</p>
            <details>
              <summary>查看文字稿</summary>
              <pre>{item.content}</pre>
            </details>
          </article>
        ))}
      </div>
    </Section>
  );
}

function ReviewStep({ project, update, logUsage, setActiveStep, completeCurrentRound }) {
  const allPassed = Boolean(project.review?.length) && project.review.every((item) => item.status === "通过");
  const [loading, setLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  function updateReviewItem(key, patch) {
    update({
      review: project.review.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      copyStatus: ""
    });
  }

  function markPassed(item) {
    updateReviewItem(item.key, {
      status: "通过",
      detail: `${item.detail} 人工已确认无误。`
    });
  }

  function markFailed(item) {
    const target = buildRevisionTarget(item);
    update({
      review: project.review.map((entry) => (
        entry.key === item.key
          ? { ...entry, status: "不通过", detail: `${entry.detail} AI 判断：${target.reason}` }
          : entry
      )),
      revisionTarget: target,
      copyStatus: ""
    });
    setActiveStep(target.route);
  }

  async function copyApprovedDraft() {
    const text = project.draft?.fullText || "";
    try {
      await navigator.clipboard.writeText(text);
      update({ copyStatus: "已复制审核通过的文字稿。" });
    } catch {
      update({ copyStatus: "复制失败，请手动选中文字稿复制。" });
    }
  }

  return (
    <Section
      title="AI 审核"
      intro="流程图只供写作前参考；完整产品仍保留 AI 审核与人工交付。"
      aside={<RuleList items={["审核清单提示，不强制拦截", "覆盖事实、逻辑、谬误、版权", "检查错别字、逻辑谬误、语法错误", "给内容总监二次判断"]} />}
    >
      <div className="action-row">
        <button
          className="primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setAiNotice("");
            try {
              const data = await callAi("reviewDraft", project);
              update({ review: data.payload.review || buildReview(project), revisionTarget: null, copyStatus: "" });
              logUsage("AI 审核", data.model || "openai-api", data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);
              setAiNotice("已使用 OpenAI API 生成审核报告。");
            } catch (error) {
              setAiNotice(`真实 AI 调用失败：${error.message}`);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "AI 审核中" : "生成审核报告"}
        </button>
      </div>
      {aiNotice && <Notice type={aiNotice.startsWith("已使用") ? "success" : "warning"} text={aiNotice} />}
      {project.review && (
        <div className="review-grid">
          {project.review.map((item) => (
            <article
              key={item.type}
              className={`review-card ${item.status === "不通过" ? "failed-card" : item.status === "通过" ? "passed-card" : ""}`}
              onClick={() => {
                if (item.status === "不通过") markFailed(item);
              }}
            >
              <span className={item.status === "不通过" ? "failed" : ""}>
                {item.status === "通过" ? "AI审核通过" : item.status}
              </span>
              <h4>{item.type}</h4>
              <p>{item.detail}</p>
              {item.status !== "不通过" && (
                <div className="review-actions">
                  {item.status !== "通过" && (
                    <button
                      className="secondary ready"
                      onClick={(event) => {
                        event.stopPropagation();
                        markPassed(item);
                      }}
                    >
                      确认审核通过
                    </button>
                  )}
                  <button
                    className="danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      markFailed(item);
                    }}
                  >
                    标记不通过并返回修改
                  </button>
                </div>
              )}
              {item.status === "不通过" && (
                <p className="click-hint">点击此卡片返回上一步修改</p>
              )}
            </article>
          ))}
        </div>
      )}
      {allPassed && project.draft && (
        <div className="approved-output">
          <div className="approved-header">
            <div>
              <h4>审核通过文字稿</h4>
              <p>所有审核项均已通过，可以复制到其他文字编辑工具继续加工。</p>
            </div>
            <div className="approved-actions">
              <button className="secondary ready" onClick={completeCurrentRound}>确认本轮任务完结</button>
              <button className="primary" onClick={copyApprovedDraft}>一键复制</button>
            </div>
          </div>
          {project.copyStatus && <Notice type="success" text={project.copyStatus} />}
          <pre>{project.draft.fullText}</pre>
        </div>
      )}
    </Section>
  );
}

function FilePicker({ label, files, onChange, beforeRead }) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  return (
    <label className="file-picker">
      <span>{label}</span>
      <input
        className="file-input"
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md"
        disabled={reading}
        onChange={async (event) => {
          const picked = Array.from(event.target.files || []);
          setError("");
          if (beforeRead && beforeRead(picked) === false) {
            event.target.value = "";
            return;
          }
          setReading(true);
          try {
            const payloads = await uploadFiles(picked);
            onChange(payloads);
          } catch {
            setError("文件读取失败，请重新选择文件。");
          } finally {
            event.target.value = "";
            setReading(false);
          }
        }}
      />
      <span className="file-picker-control">{reading ? "正在读取文件…" : files.length ? "重新选择文件" : "选择文件"}</span>
      <small>{reading ? "正在读取文件..." : files.length ? files.map((file) => file.name).join(" / ") : "支持 PDF、Word、TXT、Markdown"}</small>
      {error && <small className="file-error">{error}</small>}
    </label>
  );
}

function RuleList({ items }) {
  return (
    <div className="rule-list">
      <h4>关键规则</h4>
      {items.map((item) => <p key={item}>{item}</p>)}
    </div>
  );
}

function Notice({ type, text }) {
  return <p className={`notice ${type}`}>{text}</p>;
}

function InfoBlock({ title, body }) {
  return (
    <article className="info-block">
      <h4>{title}</h4>
      <p>{body}</p>
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
