import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "sync-studio");
const historyFile = path.join(outputDir, "render-history.json");
const browserExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const execFileAsync = promisify(execFile);
const jobs = new Map();
let serveUrl;

async function readRenderHistory() {
  try {
    const content = await fs.readFile(historyFile, "utf8");
    const history = JSON.parse(content);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    if (error?.code === "ENOENT") return migrateExistingOutputs();
    console.warn("[sync-studio] render history read failed", error);
    return [];
  }
}

async function migrateExistingOutputs() {
  try {
    const files = (await fs.readdir(outputDir)).filter((filename) => /^sync-studio-\d+\.mp4$/.test(filename));
    const history = await Promise.all(files.map(async (filename) => {
      const match = filename.match(/^sync-studio-(\d+)\.mp4$/);
      const fileStat = await fs.stat(path.join(outputDir, filename));
      let videoDurationMs = null;
      try {
        const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path.join(outputDir, filename)]);
        const seconds = Number.parseFloat(stdout.trim());
        if (Number.isFinite(seconds)) videoDurationMs = Math.round(seconds * 1000);
      } catch { /* 旧文件没有可用媒体元数据时仍保留记录 */ }
      const createdAt = new Date(Number(match[1])).toISOString();
      return { id: `legacy-${match[1]}`, status: "completed", legacy: true, startedAt: createdAt, finishedAt: createdAt, elapsedMs: null, videoDurationMs, includeSubtitles: null, audioName: "历史文件", scriptName: "历史文件", pdfName: "历史文件", filename, fileSize: fileStat.size, videoUrl: `/api/output/${filename}` };
    }));
    history.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2), "utf8");
    return history;
  } catch (error) {
    console.warn("[sync-studio] render history migration skipped", error);
    return [];
  }
}

async function appendRenderHistory(record) {
  await fs.mkdir(outputDir, { recursive: true });
  const history = await readRenderHistory();
  history.unshift(record);
  await fs.writeFile(historyFile, JSON.stringify(history.slice(0, 100), null, 2), "utf8");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => { size += chunk.length; if (size > 320 * 1024 * 1024) reject(new Error("上传数据超过 320MB 安全限制，请减少素材页数或拆分视频")); else chunks.push(chunk); });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeDataUrl(dataUrl, filePath) {
  const [, encoded] = String(dataUrl).split(",");
  if (!encoded) throw new Error("素材数据格式错误");
  return fs.writeFile(filePath, Buffer.from(encoded, "base64"));
}

async function convertPptxToPdf(fileDataUrl, fileName) {
  if (!fileDataUrl || !/\.pptx?$/i.test(String(fileName || ""))) throw new Error("只支持转换 PPTX 课件");
  await fs.mkdir(outputDir, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(outputDir, "pptx-convert-"));
  const sourcePath = path.join(tempDir, path.basename(fileName).replace(/[^a-z0-9._-]+/gi, "_") || "courseware.pptx");
  try {
    await writeDataUrl(fileDataUrl, sourcePath);
    const outputDirPath = path.join(tempDir, "pdf");
    await fs.mkdir(outputDirPath, { recursive: true });
    const converters = [
      process.env.PPTX_CONVERTER_BIN,
      "soffice",
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
      process.env.WPS_OFFICE_BIN,
      "/Applications/wpsoffice.app/Contents/MacOS/wpsoffice"
    ].filter(Boolean);
    let lastError;
    for (const converter of converters) {
      try {
        await execFileAsync(converter, ["--headless", "--convert-to", "pdf", "--outdir", outputDirPath, sourcePath], { timeout: 60000, killSignal: "SIGKILL" });
        const expectedPath = path.join(outputDirPath, `${path.basename(sourcePath, path.extname(sourcePath))}.pdf`);
        await fs.access(expectedPath);
        const pdf = await fs.readFile(expectedPath);
        return `data:application/pdf;base64,${pdf.toString("base64")}`;
      } catch (error) {
        lastError = error;
      }
    }
    const reason = lastError?.stderr || lastError?.message || "未找到可用的本地 PPTX 转换程序";
    throw new Error(`PPTX 转换失败：请确认本机已安装 WPS 或 LibreOffice。${String(reason).slice(0, 220)}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getAudioDurationMs(audioDataUrl) {
  await fs.mkdir(outputDir, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(outputDir, "align-"));
  const audioPath = path.join(tempDir, "audio.mp3");
  try {
    await writeDataUrl(audioDataUrl, audioPath);
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath]);
    const seconds = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("无法读取 MP3 时长");
    return Math.round(seconds * 1000);
  } finally { await fs.rm(tempDir, { recursive: true, force: true }); }
}

function normalizedLength(text) { return [...String(text).replace(/\s/g, "")].length; }
function makeSentences(text) { const clean = String(text).replace(/\s+/g, " ").trim(); if (!clean) return []; return (clean.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [clean]).map((part) => part.trim()).filter(Boolean); }

async function alignTimeline(payload) {
  if (!payload.audioDataUrl || !Array.isArray(payload.pages) || !payload.pages.length) throw new Error("缺少 MP3 或带标记文稿");
  const durationMs = await getAudioDurationMs(payload.audioDataUrl);
  const pages = payload.pages.map((page) => ({ page: Number(page.page), text: String(page.text || "").trim() }));
  const totalWeight = pages.reduce((sum, page) => sum + Math.max(1, normalizedLength(page.text)), 0);
  let cursorMs = 0;
  const cues = [];
  const captions = [];
  for (const [index, page] of pages.entries()) {
    const pageWeight = Math.max(1, normalizedLength(page.text));
    const pageDuration = index === pages.length - 1 ? durationMs - cursorMs : Math.max(300, Math.round(durationMs * pageWeight / totalWeight));
    cues.push({ page: page.page, anchorText: page.text.slice(0, 36) || `第 ${page.page} 页`, scriptText: page.text, startMs: cursorMs, confidence: 0.86 });
    const sentences = makeSentences(page.text);
    const sentenceWeight = sentences.reduce((sum, sentence) => sum + Math.max(1, normalizedLength(sentence)), 0);
    let sentenceCursor = cursorMs;
    for (const [sentenceIndex, sentence] of sentences.entries()) {
      const sentenceDuration = sentenceIndex === sentences.length - 1 ? cursorMs + pageDuration - sentenceCursor : Math.max(250, Math.round(pageDuration * normalizedLength(sentence) / Math.max(1, sentenceWeight)));
      captions.push({ text: sentence, startMs: sentenceCursor, endMs: sentenceCursor + sentenceDuration, timestampMs: sentenceCursor, confidence: 0.86 });
      sentenceCursor += sentenceDuration;
    }
    cursorMs += pageDuration;
  }
  return { durationMs, cues, captions };
}

async function ensureBundle() {
  if (!serveUrl) serveUrl = await bundle({ entryPoint: path.join(root, "src/sync-render/index.jsx") });
  return serveUrl;
}

async function prepareRenderAssets(jobId, payload, onProgress) {
  const assetDir = path.join(outputDir, "render-assets", jobId);
  await fs.mkdir(assetDir, { recursive: true });
  onProgress(0.02, "准备高清素材", "正在把音频和高清页面写入本地渲染资源");
  await writeDataUrl(payload.audioDataUrl, path.join(assetDir, "audio.mp3"));
  const pages = [];
  for (const [index, page] of payload.pages.entries()) {
    const extension = String(page.url).startsWith("data:image/png") ? "png" : "jpg";
    const filename = `page-${String(index + 1).padStart(3, "0")}.${extension}`;
    await writeDataUrl(page.url, path.join(assetDir, filename));
    pages.push({ ...page, url: `http://127.0.0.1:8787/api/render-asset/${jobId}/${filename}` });
  }
  return { assetDir, audioSrc: `http://127.0.0.1:8787/api/render-asset/${jobId}/audio.mp3`, pages };
}

async function renderVideo(jobId, payload, onProgress = () => {}) {
  if (!payload.audioDataUrl || !Array.isArray(payload.pages) || !payload.pages.length) throw new Error("缺少音频或 PDF 页面");
  await fs.mkdir(outputDir, { recursive: true });
  const includeSubtitles = Boolean(payload.includeSubtitles);
  const assets = await prepareRenderAssets(jobId, payload, onProgress);
  const props = { audioSrc: assets.audioSrc, audioDurationMs: payload.audioDurationMs || 30000, pages: assets.pages, cues: payload.cues || [], captions: includeSubtitles ? (payload.captions || []) : [] };
  onProgress(0.04, "整理时间轴", "正在整理音频、页面和时间轴");
  const url = await ensureBundle();
  onProgress(0.1, "启动视频渲染器", "正在加载 Remotion 渲染环境");
  const composition = await selectComposition({ serveUrl: url, id: "SyncVideo", inputProps: props, browserExecutable });
  const filename = `${payload.renderKind === "preview" ? "sync-studio-preview" : "sync-studio"}-${Date.now()}.mp4`;
  const outputLocation = path.join(outputDir, filename);
  const totalFrames = composition.durationInFrames;
  await renderMedia({ composition, serveUrl: url, codec: "h264", outputLocation, inputProps: props, audioCodec: "aac", audioBitrate: "192K", videoBitrate: "4M", x264Preset: "slow", pixelFormat: "yuv420p", onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
    const stage = stitchStage === "muxing" ? "封装音频和视频" : progress < 1 ? "逐帧渲染视频" : "完成高清编码";
    const frameDetail = `${Math.round(renderedFrames || progress * totalFrames).toLocaleString()} / ${totalFrames.toLocaleString()} 帧`;
    const encodeDetail = encodedFrames ? `，已编码 ${encodedFrames.toLocaleString()} 帧` : "";
    onProgress(0.1 + progress * 0.86, stage, `${frameDetail}${encodeDetail}`);
  } });
  onProgress(1, includeSubtitles ? "MP4 字幕已嵌入" : "MP4 已生成", includeSubtitles ? "字幕已直接嵌入视频画面" : "视频文件已准备完成");
  return { videoUrl: `/api/output/${filename}`, assetDir: assets.assetDir };
}

async function runRenderJob(jobId, payload) {
  const job = jobs.get(jobId); if (!job) return;
  job.status = "running";
  try {
    job.result = await renderVideo(jobId, payload, (progress, message, detail) => { job.progress = Math.max(0, Math.min(1, progress)); job.stage = message; job.detail = detail || ""; job.elapsedMs = Date.now() - job.startedAt; });
    job.progress = 1;
    job.elapsedMs = Date.now() - job.startedAt;
    job.stage = payload.includeSubtitles ? "MP4 字幕已嵌入" : "MP4 已生成";
    job.detail = "本地渲染任务已完成";
    job.status = "completed";
    job.finishedAt = Date.now();
    const filename = path.basename(job.result.videoUrl);
    const fileStat = await fs.stat(path.join(outputDir, filename));
    await appendRenderHistory({
      id: jobId,
      status: "completed",
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      elapsedMs: job.elapsedMs,
      videoDurationMs: payload.audioDurationMs || 0,
      renderKind: payload.renderKind || "full",
      includeSubtitles: Boolean(payload.includeSubtitles),
      audioName: payload.audioName || "未记录",
      scriptName: payload.scriptName || "未记录",
      pdfName: payload.pdfName || "未记录",
      filename,
      fileSize: fileStat.size,
      videoUrl: job.result.videoUrl
    });
  }
  catch (error) {
    job.status = "failed";
    job.message = error instanceof Error ? error.message : "视频合成失败";
    job.finishedAt = Date.now();
    job.elapsedMs = Date.now() - job.startedAt;
    await appendRenderHistory({
      id: jobId,
      status: "failed",
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      elapsedMs: job.elapsedMs,
      videoDurationMs: payload.audioDurationMs || 0,
      renderKind: payload.renderKind || "full",
      includeSubtitles: Boolean(payload.includeSubtitles),
      audioName: payload.audioName || "未记录",
      scriptName: payload.scriptName || "未记录",
      pdfName: payload.pdfName || "未记录",
      error: job.message
    });
  } finally {
    const assetDir = job.result?.assetDir || path.join(outputDir, "render-assets", jobId);
    await fs.rm(assetDir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && /^(https?:\/\/)(127\.0\.0\.1|localhost):\d+$/.test(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  try {
    if (request.method === "POST" && request.url === "/api/align") { const result = await alignTimeline(JSON.parse(await readBody(request))); response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: true, ...result })); return; }
    if (request.method === "POST" && request.url === "/api/convert-pptx") { const payload = JSON.parse(await readBody(request)); const pdfDataUrl = await convertPptxToPdf(payload.fileDataUrl, payload.fileName); response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: true, pdfDataUrl })); return; }
    if (request.method === "POST" && request.url === "/api/render") { const jobId = crypto.randomUUID(); jobs.set(jobId, { status: "queued", progress: 0, stage: "等待开始合成", detail: "任务已进入本地渲染队列", startedAt: Date.now(), elapsedMs: 0 }); void runRenderJob(jobId, JSON.parse(await readBody(request))); response.writeHead(202, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: true, jobId })); return; }
    if (request.method === "GET" && request.url === "/api/render-history") { const history = await readRenderHistory(); response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: true, history })); return; }
    if (request.method === "GET" && request.url?.startsWith("/api/render-asset/")) {
      const parts = request.url.slice("/api/render-asset/".length).split("/").map((part) => decodeURIComponent(part));
      const [jobId, filename] = parts;
      if (!/^[0-9a-f-]{36}$/.test(jobId) || !/^[a-z0-9-]+\.(?:mp3|png|jpg)$/.test(filename || "")) { response.writeHead(400); response.end("Invalid render asset"); return; }
      const file = await fs.readFile(path.join(outputDir, "render-assets", jobId, filename));
      const contentType = filename.endsWith(".mp3") ? "audio/mpeg" : filename.endsWith(".png") ? "image/png" : "image/jpeg";
      response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store", "Content-Length": file.length }); response.end(file); return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/render/")) { const job = jobs.get(request.url.slice("/api/render/".length).split("?")[0]); if (!job) { response.writeHead(404); response.end("Render job not found"); return; } response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: true, ...job })); return; }
    if (request.method === "GET" && request.url?.startsWith("/api/output/")) { const filename = path.basename(request.url.slice("/api/output/".length)); const file = await fs.readFile(path.join(outputDir, filename)); response.writeHead(200, { "Content-Type": filename.endsWith(".srt") ? "application/x-subrip; charset=utf-8" : "video/mp4", "Content-Length": file.length }); response.end(file); return; }
    response.writeHead(404); response.end("Not found");
  } catch (error) { response.writeHead(500, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "本地渲染失败" })); }
});

server.listen(8787, "127.0.0.1", () => console.log("[sync-studio] renderer ready at http://127.0.0.1:8787"));
