import React, { useEffect, useMemo, useRef, useState } from "react";
import { demoCaptions, demoCues, extractDocxText, parseMarkedScript, renderPdf } from "./parser";

const demoPages = [1, 2, 3].map((page) => ({ page, url: "" }));
const UNMAPPED_PAGE_HOLD_MS = 2000;

export function SyncStudioWorkbench() {
  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [audioSelected, setAudioSelected] = useState(false);
  const [audioName, setAudioName] = useState("尚未上传 MP3");
  const [scriptSelected, setScriptSelected] = useState(false);
  const [scriptName, setScriptName] = useState("尚未上传 DOCX");
  const [pdfSelected, setPdfSelected] = useState(false);
  const [pdfName, setPdfName] = useState("尚未上传 PDF / PPTX");
  const [scriptPages, setScriptPages] = useState([]);
  const [cues, setCues] = useState(demoCues);
  const [captions, setCaptions] = useState(demoCaptions);
  const [pages, setPages] = useState(demoPages);
  const [currentMs, setCurrentMs] = useState(0);
  const [status, setStatus] = useState("演示模式：上传素材后开始解析");
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [includeSubtitles, setIncludeSubtitles] = useState(false);
  const [renderStartedAt, setRenderStartedAt] = useState(null);
  const [renderElapsedMs, setRenderElapsedMs] = useState(0);
  const [renderStage, setRenderStage] = useState("尚未开始");
  const [renderDetail, setRenderDetail] = useState("生成视频后，这里会显示当前处理阶段和帧数");
  const [renderStageHistory, setRenderStageHistory] = useState([]);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadKind, setDownloadKind] = useState("");
  const [validationIssues, setValidationIssues] = useState([]);

  const activeCaption = useMemo(() => captions.find((item) => currentMs >= item.startMs && currentMs < item.endMs), [captions, currentMs]);

  useEffect(() => {
    if (!rendering || !renderStartedAt) return undefined;
    const timer = window.setInterval(() => setRenderElapsedMs(Date.now() - renderStartedAt), 250);
    return () => window.clearInterval(timer);
  }, [rendering, renderStartedAt]);

  function onAudio(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".mp3")) return setStatus("请上传 MP3 音频文件");
    setAudioSelected(true);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setAudioDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
    setAudioName(file.name);
    setStatus("音频已载入，等待文稿和课件");
  }

  async function onDocx(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScriptSelected(true);
    setScriptName(file.name);
    setScriptPages([]);
    setStatus("文稿已选择，正在识别分页标记……");
    try {
      const parsed = parseMarkedScript(await extractDocxText(file));
      if (parsed.errors.length) return setStatus(`文稿已上传，但分页标记需要检查：${parsed.errors.join("；")}`);
      setScriptPages(parsed.pages);
      setCues(parsed.pages.map((page, index) => ({ page: page.page, anchorText: page.text.slice(0, 36) || `第 ${page.page} 页`, startMs: index * 5000, confidence: null })));
      setCaptions(parsed.pages.map((page, index) => ({ text: page.text || `第 ${page.page} 页`, startMs: index * 5000, endMs: (index + 1) * 5000 })));
      setStatus(`已识别 ${parsed.pages.length} 个页面标记，等待音频对齐`);
    } catch {
      setStatus("DOCX 读取失败，请确认文件没有损坏");
    }
  }

  async function onCourseware(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const isPptx = fileName.endsWith(".pptx") || fileName.endsWith(".ppt");
    if (!isPdf && !isPptx) return setStatus("课件格式不支持，请上传 PDF 或 PPTX");
    setPdfSelected(true);
    setPdfName(file.name);
    setStatus(isPptx ? "正在本地静默转换 PPTX，并生成高清页面……" : "正在本地渲染 PDF 页面……");
    try {
      let sourceFile = file;
      if (isPptx) {
        const fileDataUrl = await readFileAsDataUrl(file);
        const response = await fetch("http://127.0.0.1:8787/api/convert-pptx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileDataUrl }) });
        const converted = await response.json().catch(() => ({}));
        if (!response.ok || !converted.ok || !converted.pdfDataUrl) throw new Error(converted.error || "PPTX 转换失败");
        sourceFile = dataUrlToFile(converted.pdfDataUrl, `${file.name.replace(/\.pptx?$/i, "")}.pdf`, "application/pdf");
      }
      const rendered = await renderPdf(sourceFile);
      setPages(rendered);
      setStatus(`已载入 ${rendered.length} 页课件，可以开始预览`);
    } catch (error) {
      setPages([]);
      setStatus(`课件读取失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  function playPreview() {
    if (!audioRef.current) return setStatus("请先上传 MP3；当前可以先查看演示时间线");
    void audioRef.current.play();
    setStatus("正在播放并按时间线自动翻页");
  }

  function noteRenderStage(stage, detail) {
    setRenderStageHistory((current) => {
      const existing = current.findIndex((item) => item.stage === stage);
      if (existing >= 0) return current.map((item, index) => index === existing ? { ...item, detail, active: true } : { ...item, active: false });
      return [...current.map((item) => ({ ...item, active: false })), { stage, detail, active: true }];
    });
  }

  async function renderVideo(renderKind = "full") {
    const isPreview = renderKind === "preview";
    const issues = [];
    if (!audioDataUrl) issues.push({ title: "音频未完成", detail: "请上传可用的 MP3 音频文件。" });
    if (!scriptPages.length) issues.push({ title: "文稿分页标记未完成", detail: "请上传包含 [第 N 张 PPT] 标记的 DOCX 文稿。" });
    const renderedPages = pages.filter((page) => page.url);
    if (!renderedPages.length) issues.push({ title: "课件未完成", detail: "请上传 PDF 或 PPTX，并等待页面解析完成。" });
    const referencedPages = [...new Set(scriptPages.map((page) => page.page))].sort((a, b) => a - b);
    const missingPages = referencedPages.filter((page) => !renderedPages.some((item) => item.page === page));
    if (missingPages.length) issues.push({ title: "课件页面无法覆盖文稿", detail: `文稿引用了第 ${missingPages.join("、")} 页，但上传课件中没有对应页面。` });
    if (scriptPages.some((page, index) => index > 0 && page.page !== scriptPages[index - 1].page + 1)) issues.push({ title: "分页顺序异常", detail: "文稿中的 PPT 编号需要连续递增。" });
    if (issues.length) {
      setValidationIssues(issues);
      setStatus("生成前检查未通过，请先处理提示项");
      return;
    }
    setValidationIssues([]);
    setStatus(isPreview ? "素材检查通过，正在准备生成 1 分钟验收视频……" : "素材检查通过，正在准备生成正式视频……");
    setRendering(true);
    setRenderProgress(0);
    setRenderStartedAt(Date.now());
    setRenderElapsedMs(0);
    setRenderStage("读取素材");
    setRenderDetail("正在检查音频、文稿分页和课件页面");
    setRenderStageHistory([{ stage: "读取素材", detail: "正在检查音频、文稿分页和课件页面", active: true }]);
    setVideoDurationMs(0);
    setDownloadUrl("");
    setDownloadKind(renderKind);
    try {
      noteRenderStage("生成时间轴", "正在读取音频时长，并根据文稿内容计算翻页节点");
      setRenderStage("生成时间轴");
      setRenderDetail("正在读取音频时长，并根据文稿内容计算翻页节点");
      setStatus("正在根据口播稿计算时间线……");
      const alignResponse = await fetch("http://127.0.0.1:8787/api/align", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioDataUrl, pages: scriptPages }) });
      const aligned = await alignResponse.json().catch(() => ({}));
      if (!alignResponse.ok || !aligned.ok) throw new Error(aligned.error || "音频时间对齐失败");
      setCues(aligned.cues || []);
      setCaptions(aligned.captions || []);
      const referencedPageNumbers = new Set((aligned.cues || []).map((cue) => cue.page));
      const lastReferencedPage = Math.max(...referencedPageNumbers);
      const trailingPages = renderedPages.filter((page) => page.page > lastReferencedPage && !referencedPageNumbers.has(page.page));
      const trailingCues = trailingPages.map((page, index) => ({ page: page.page, anchorText: `第 ${page.page} 页（文稿未单独标记，结尾展示）`, scriptText: "", startMs: (aligned.durationMs || 0) + index * UNMAPPED_PAGE_HOLD_MS, confidence: null }));
      const effectiveCues = [...(aligned.cues || []), ...trailingCues];
      const effectiveDurationMs = (aligned.durationMs || 0) + trailingCues.length * UNMAPPED_PAGE_HOLD_MS;
      const outputDurationMs = isPreview ? Math.min(60 * 1000, effectiveDurationMs) : effectiveDurationMs;
      const outputCues = effectiveCues.filter((cue) => cue.startMs < outputDurationMs);
      const outputCaptions = (aligned.captions || []).filter((caption) => caption.startMs < outputDurationMs).map((caption) => ({ ...caption, endMs: Math.min(caption.endMs, outputDurationMs) }));
      const outputPageNumbers = new Set(outputCues.map((cue) => cue.page));
      const outputPages = isPreview ? renderedPages.filter((page) => outputPageNumbers.has(page.page)) : renderedPages;
      noteRenderStage("压缩渲染素材", "正在把课件页面转换为适合 1920×1080 视频的高清素材");
      setRenderStage("压缩渲染素材");
      setRenderDetail("正在优化页面数据大小，避免上传超过本地服务限制");
      let renderPages = await prepareRenderPages(outputPages, 1920, .9);
      let estimatedBytes = estimateRenderPayloadBytes(audioDataUrl, renderPages);
      if (estimatedBytes > 150 * 1024 * 1024) {
        noteRenderStage("优化渲染素材", `首轮素材约 ${(estimatedBytes / 1024 / 1024).toFixed(1)}MB，正在使用第二档高清压缩`);
        setRenderStage("优化渲染素材");
        setRenderDetail("正在进一步压缩页面图片，保持视频清晰度并确保任务可执行");
        renderPages = await prepareRenderPages(outputPages, 1600, .78);
        estimatedBytes = estimateRenderPayloadBytes(audioDataUrl, renderPages);
      }
      if (estimatedBytes > 170 * 1024 * 1024) throw new Error(`渲染素材仍约 ${(estimatedBytes / 1024 / 1024).toFixed(1)}MB，超过安全上传阈值。请减少 PDF 页数或拆分视频后重试。`);
      setCues(effectiveCues);
      setCaptions(aligned.captions || []);
      setVideoDurationMs(outputDurationMs);
      noteRenderStage("时间轴已生成", isPreview ? `已截取前 ${formatDuration(outputDurationMs)}，准备生成验收视频` : trailingCues.length ? `发现 ${trailingCues.length} 页未单独标记，已加入结尾展示；视频时长 ${formatDuration(effectiveDurationMs)}` : `视频时长 ${formatDuration(effectiveDurationMs)}，准备进入本地渲染`);
      setRenderStage("时间轴已生成");
      setRenderDetail(isPreview ? "只渲染前 1 分钟，用于验收清晰度、尺寸、翻页和字幕" : trailingCues.length ? `第 ${trailingCues.map((cue) => cue.page).join("、")} 页将在结尾展示 ${UNMAPPED_PAGE_HOLD_MS / 1000} 秒` : `视频时长 ${formatDuration(effectiveDurationMs)}，准备进入本地渲染`);
      setStatus(includeSubtitles ? (isPreview ? "时间线已生成，正在合成 1 分钟验收视频……" : "时间线已生成，正在合成带字幕的 MP4……") : (isPreview ? "时间线已生成，正在合成 1 分钟验收视频……" : "时间线已生成，正在合成 MP4……"));
      const response = await fetch("http://127.0.0.1:8787/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioDataUrl, audioName, scriptName, pdfName, pages: renderPages, cues: outputCues, captions: outputCaptions, audioDurationMs: outputDurationMs, includeSubtitles, renderKind }) });
      const submitted = await response.json().catch(() => ({}));
      if (!response.ok || !submitted.ok || !submitted.jobId) throw new Error(submitted.error || "视频合成任务创建失败");
      let finished = false;
      while (!finished) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        const progressResponse = await fetch(`http://127.0.0.1:8787/api/render/${submitted.jobId}`);
        const job = await progressResponse.json().catch(() => ({}));
        if (!progressResponse.ok || job.status === "failed") throw new Error(job.message || "视频合成失败");
        const percent = Math.round((job.progress || 0) * 100);
        setRenderProgress(percent);
        setRenderStage(job.stage || "正在合成");
        setRenderDetail(job.detail || "");
        noteRenderStage(job.stage || "正在合成", job.detail || "");
        if (job.elapsedMs) setRenderElapsedMs(job.elapsedMs);
        setStatus(`${job.stage || "正在合成"} ${percent}%`);
        if (job.status === "completed") {
          setDownloadUrl(`http://127.0.0.1:8787${job.result.videoUrl}`);
          finished = true;
        }
      }
      setDownloadKind(renderKind);
      setStatus(isPreview ? "1 分钟验收视频已生成，可以下载检查" : includeSubtitles ? "字幕已嵌入 MP4，可以下载" : "MP4 已生成，可以下载");
    } catch (error) {
      noteRenderStage("生成失败", error instanceof Error ? error.message : "请确认本地渲染服务已启动");
      setRenderStage("生成失败");
      setRenderDetail(error instanceof Error ? error.message : "请确认本地渲染服务已启动");
      setStatus(error instanceof Error ? error.message : "视频合成失败，请确认本地渲染服务已启动");
    } finally {
      setRendering(false);
    }
  }

  return <main className="sync-studio-root">
    <header className="sync-header">
      <div><p className="sync-eyebrow">CONTENT PRODUCTION / SYNC STUDIO</p><h1>声画同步工作台</h1><p className="sync-subtitle">把口播、页面和字幕放进同一条时间轴，作为内容生产工作台的音视频创作入口。</p></div>
      <div className="sync-header-actions"><span className="sync-local-badge">● 本地创作模式</span><button className="sync-secondary" onClick={playPreview}>开始预览</button><label className="sync-subtitle-toggle"><input type="checkbox" checked={includeSubtitles} onChange={(event) => setIncludeSubtitles(event.target.checked)} disabled={rendering} /><span>本轮生成字幕</span></label><button className="sync-preview-render-button" onClick={() => renderVideo("preview")} disabled={rendering}>{rendering && downloadKind === "preview" ? `验收片 ${renderProgress}%` : "生成 1 分钟验收视频"}</button><button className="sync-render-button" onClick={() => renderVideo("full")} disabled={rendering}>{rendering && downloadKind !== "preview" ? `合成中 ${renderProgress}%` : includeSubtitles ? "生成 MP4 + 嵌入字幕" : "生成 MP4"}</button><span className="sync-status">{status}</span></div>
    </header>
    <section className="sync-grid">
      <aside className="sync-panel sync-sidebar">
        <div className="sync-section-heading"><div><p className="sync-eyebrow">01 / INPUTS</p><h2>输入素材</h2></div><span className="sync-step-dot">1</span></div>
        <SyncUpload label="MiniMax MP3" name={audioName} accept="audio/mpeg,.mp3" onChange={onAudio} ready={audioSelected} statusText={audioUrl ? "已载入，可用于对齐" : "文件已选择"} />
        <SyncUpload label="标记口播稿 DOCX" name={scriptName} accept=".docx" onChange={onDocx} ready={scriptSelected} statusText={scriptPages.length ? "已识别分页标记" : scriptSelected ? "文件已上传，分页标记待检查" : ""} statusTone={scriptSelected && !scriptPages.length ? "warning" : ""} />
        <SyncUpload label="上传课件 PDF / PPTX" name={pdfName} accept="application/pdf,.pdf,.pptx,.ppt" onChange={onCourseware} ready={pdfSelected} statusText={pages.some((page) => page.url) ? "已载入页面" : pdfSelected ? "文件已选择，正在解析" : ""} />
        <div className="sync-marker-note"><strong>标记格式</strong><code>[第 1 张 PPT]</code><p>标记只用于翻页，不会被朗读或显示在字幕中。系统也兼容旧格式 [第1页]。</p></div>
      </aside>
      <section className="sync-preview-column">
        <div className="sync-panel sync-preview-card"><div className="sync-toolbar"><div><p className="sync-eyebrow">02 / PREVIEW</p><h2>同步预览</h2></div><span className="sync-meta">页面 {currentPage} / {Math.max(pages.length, cues.length)} · {formatTime(currentMs)}</span></div>
          <div className="sync-stage"><div className="sync-stage-grid" />{pages.find((page) => page.page === currentPage)?.url ? <img className="sync-page-image" src={pages.find((page) => page.page === currentPage).url} alt={`第 ${currentPage} 页`} /> : <div className="sync-slide"><span>SYNC STUDIO / PAGE {String(currentPage).padStart(2, "0")}</span><h3>{currentPage === 1 ? "让声音和画面\n自然对齐" : currentPage === 2 ? "先解决翻页\n再扩展动画" : "把每一次切换\n放进时间轴"}</h3><p>{cues.find((cue) => cue.page === currentPage)?.anchorText || "上传标记文稿后，这里会显示对应页面内容。"}</p></div>}<span className="sync-page-chip">PAGE {currentPage}</span></div>
          <div className="sync-caption">{activeCaption?.text || "上传并播放音频后，字幕将在这里跟随播放。"}</div>
          <audio ref={audioRef} src={audioUrl || undefined} controls onTimeUpdate={(event) => { const nextMs = event.currentTarget.currentTime * 1000; setCurrentMs(nextMs); const nextPage = [...cues].reverse().find((cue) => nextMs >= cue.startMs)?.page; if (nextPage) setCurrentPage(nextPage); }} onPlay={() => setStatus("正在播放并按时间线自动翻页")} onPause={() => setStatus("预览已暂停")} onEnded={() => { const lastCue = cues[cues.length - 1]; if (lastCue && lastCue.startMs >= (audioRef.current?.duration || 0) * 1000 - 120) { setCurrentPage(lastCue.page); setStatus(`音频已结束，已切换到结尾页：第 ${lastCue.page} 页`); } }} />
        </div>
        <div className="sync-panel sync-timeline-card"><div className="sync-toolbar"><div><p className="sync-eyebrow">03 / TIMELINE</p><h2>翻页时间线</h2></div><span className="sync-pill">{cues.length} 个翻页节点</span></div><div className="sync-timeline-list">{cues.map((cue) => <button type="button" className={`sync-cue-row ${currentPage === cue.page ? "active" : ""}`} key={cue.page} onClick={() => { setCurrentPage(cue.page); if (audioRef.current) audioRef.current.currentTime = cue.startMs / 1000; }}><span>{formatTime(cue.startMs)}</span><strong>第 {cue.page} 页</strong><span>{cue.anchorText}</span><small>{cue.confidence === null ? "待对齐" : "已对齐"}</small></button>)}</div></div>
        {renderStartedAt && <div className="sync-render-info"><div><span>本轮视频时长</span><strong>{formatDuration(videoDurationMs)}</strong></div><div><span>已用渲染时间</span><strong>{formatDuration(renderElapsedMs)}</strong></div><div className="sync-render-info-wide"><span>当前阶段</span><strong>{renderStage}</strong><small>{renderDetail}</small></div><div className="sync-progress-track"><i style={{ width: `${renderProgress}%` }} /></div></div>}
        {downloadUrl && <div className="sync-download-actions"><a href={downloadUrl} download={downloadKind === "preview" ? "sync-studio-1min-preview.mp4" : "sync-studio.mp4"}>{downloadKind === "preview" ? "下载 1 分钟验收视频 →" : "下载合成 MP4 →"}</a></div>}
        <div className="sync-service-note"><strong>本地渲染服务</strong><span>PDF 在浏览器解析；PPTX 会由本机 WPS/LibreOffice 静默转换为高清页面；点击生成后调用本机 8787 端口的 Remotion + Chrome + FFmpeg 服务。</span></div>
      </section>
    </section>
    {rendering && <RenderProgressModal progress={renderProgress} elapsedMs={renderElapsedMs} stages={renderStageHistory} preview={downloadKind === "preview"} />}
    {validationIssues.length > 0 && <ValidationModal issues={validationIssues} onClose={() => setValidationIssues([])} />}
  </main>;
}

function RenderProgressModal({ progress, elapsedMs, stages, preview }) {
  return <div className="sync-render-modal-backdrop" role="status" aria-live="polite">
    <section className="sync-render-modal" aria-labelledby="sync-render-title">
      <div className="sync-render-modal-heading"><div><p className="sync-eyebrow">SYNC STUDIO / RENDERING</p><h2 id="sync-render-title">{preview ? "正在生成 1 分钟验收视频" : "正在生成高清 MP4"}</h2></div><strong>{progress}%</strong></div>
      <div className="sync-render-modal-track"><i style={{ width: `${progress}%` }} /></div>
      <div className="sync-render-modal-current"><span>当前动作</span><strong>{stages.find((item) => item.active)?.stage || "准备中"}</strong><small>{stages.find((item) => item.active)?.detail || "正在准备本地渲染环境"}</small></div>
      <div className="sync-render-stage-list">{stages.map((item) => <div className={`sync-render-stage ${item.active ? "active" : "done"}`} key={item.stage}><span>{item.active ? "●" : "✓"}</span><div><strong>{item.stage}</strong><small>{item.detail}</small></div></div>)}</div>
      <div className="sync-render-modal-footer"><span>已用时间</span><strong>{formatDuration(elapsedMs)}</strong><span>窗口可以保持打开，完成后会出现下载按钮。</span></div>
    </section>
  </div>;
}

function ValidationModal({ issues, onClose }) {
  return <div className="sync-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="sync-validation-modal" role="dialog" aria-modal="true" aria-labelledby="sync-validation-title" onClick={(event) => event.stopPropagation()}>
      <p className="sync-eyebrow">SYNC STUDIO / PRE-FLIGHT CHECK</p>
      <h2 id="sync-validation-title">暂时不能生成 MP4</h2>
      <p className="sync-validation-intro">生成前检查发现以下素材还没有满足要求，请处理后再试。</p>
      <div className="sync-validation-list">{issues.map((issue) => <div className="sync-validation-item" key={`${issue.title}-${issue.detail}`}><strong>{issue.title}</strong><span>{issue.detail}</span></div>)}</div>
      <button className="sync-validation-close" type="button" onClick={onClose}>我知道了</button>
    </section>
  </div>;
}

function SyncUpload({ label, name, accept, onChange, ready, statusText, statusTone = "" }) { return <label className="sync-upload"><span className={`sync-file-icon ${ready ? "ready" : ""}`}>{ready ? "✓" : "＋"}</span><span><strong>{label}</strong><small>{name}</small>{statusText && <em className={statusTone}>{statusText}</em>}</span><input type="file" accept={accept} onChange={onChange} /></label>; }
function readFileAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("无法读取课件文件")); reader.readAsDataURL(file); }); }
function dataUrlToFile(dataUrl, fileName, type) { const [header, encoded] = String(dataUrl).split(","); if (!encoded) throw new Error("PPTX 转换结果格式错误"); const binary = atob(encoded); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return new File([bytes], fileName, { type: type || header.match(/data:([^;]+)/)?.[1] || "application/octet-stream" }); }
async function prepareRenderPages(pages, maxWidth, quality) {
  return Promise.all(pages.map(async (page) => {
    if (!page.url || !String(page.url).startsWith("data:image/")) return page;
    const image = await loadRenderImage(page.url);
    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { ...page, url: canvas.toDataURL("image/jpeg", quality), width: canvas.width, height: canvas.height };
  }));
}
function loadRenderImage(source) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; }); }
function estimateDataUrlBytes(dataUrl) { const comma = String(dataUrl || "").indexOf(","); return comma < 0 ? 0 : Math.ceil((dataUrl.length - comma - 1) * .75); }
function estimateRenderPayloadBytes(audioDataUrl, pages) { return estimateDataUrlBytes(audioDataUrl) + pages.reduce((sum, page) => sum + estimateDataUrlBytes(page.url), 0); }
function formatTime(ms) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function formatDuration(ms) { const totalSeconds = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}分${String(totalSeconds % 60).padStart(2, "0")}秒`; }
