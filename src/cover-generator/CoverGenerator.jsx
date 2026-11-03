import React, { useEffect, useMemo, useState } from "react";

const RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const DIMENSIONS = { "1:1": [1200, 1200], "4:3": [1200, 900], "3:4": [900, 1200], "16:9": [1600, 900], "9:16": [900, 1600] };
const STYLES_KEY = "intelligent-writing-advisor-cover-styles-v1";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressReferenceImage(file) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .84);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function trimOuterLightBackground(source) {
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const { data } = imageData;
  const visited = new Uint8Array(sourceWidth * sourceHeight);
  const queue = [];
  const threshold = 238;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= sourceWidth || y >= sourceHeight) return;
    const index = y * sourceWidth + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (data[offset] < threshold || data[offset + 1] < threshold || data[offset + 2] < threshold) return;
    visited[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < sourceWidth; x += 1) { push(x, 0); push(x, sourceHeight - 1); }
  for (let y = 0; y < sourceHeight; y += 1) { push(0, y); push(sourceWidth - 1, y); }
  let head = 0;
  while (head < queue.length) {
    const index = queue[head++];
    const x = index % sourceWidth;
    const y = Math.floor(index / sourceWidth);
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  const removedRatio = queue.length / (sourceWidth * sourceHeight);
  if (removedRatio < .015 || removedRatio > .82) return source;
  queue.forEach((index) => { data[index * 4 + 3] = 0; });
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function drawCoverFit(ctx, image, x, y, width, height) {
  const cutout = trimOuterLightBackground(image);
  const sourceWidth = cutout.naturalWidth || cutout.width;
  const sourceHeight = cutout.naturalHeight || cutout.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.save();
  ctx.shadowColor = "rgba(36,49,47,.34)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 14;
  ctx.drawImage(cutout, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function composeCover({ backgroundUrl, coverUrl, ratio, mainText, subText }) {
  const [width, height] = DIMENSIONS[ratio];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const background = await loadImage(backgroundUrl);
  const cover = coverUrl ? await loadImage(coverUrl) : null;
  const scale = Math.max(width / background.width, height / background.height);
  const bgWidth = background.width * scale;
  const bgHeight = background.height * scale;
  ctx.drawImage(background, (width - bgWidth) / 2, (height - bgHeight) / 2, bgWidth, bgHeight);
  const wash = ctx.createLinearGradient(0, 0, width, 0);
  wash.addColorStop(0, "rgba(255,250,240,.94)");
  wash.addColorStop(.56, "rgba(255,250,240,.48)");
  wash.addColorStop(1, "rgba(255,250,240,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  if (cover) drawCoverFit(ctx, cover, width * .63, height * .15, width * .31, height * .67);
  const textWidth = width * .54;
  const left = width * .065;
  let titleSize = Math.max(42, Math.round(width * (ratio === "16:9" || ratio === "4:3" ? .104 : .09)));
  ctx.fillStyle = "#24312f";
  ctx.font = `900 ${titleSize}px Georgia, 'Songti SC', serif`;
  ctx.textBaseline = "top";
  let titleLines = wrapLines(ctx, mainText, textWidth);
  while (titleLines.length > 3 && titleSize > 42) {
    titleSize -= 3;
    ctx.font = `900 ${titleSize}px Georgia, 'Songti SC', serif`;
    titleLines = wrapLines(ctx, mainText, textWidth);
  }
  const titleY = height * .14;
  titleLines.forEach((line, index) => ctx.fillText(line, left, titleY + index * titleSize * 1.04));
  const titleBottom = titleY + titleLines.length * titleSize * 1.04;
  ctx.fillStyle = "#2a9d8f";
  ctx.fillRect(left, titleBottom + titleSize * .18, Math.min(width * .2, 180), Math.max(6, Math.round(titleSize * .07)));
  if (subText) {
    const subSize = Math.max(22, Math.round(titleSize * .38));
    ctx.font = `700 ${subSize}px Georgia, 'Songti SC', serif`;
    ctx.fillStyle = "#51635f";
    const subY = titleBottom + titleSize * .38;
    wrapLines(ctx, subText, textWidth).slice(0, 3).forEach((line, index) => ctx.fillText(line, left, subY + index * subSize * 1.35));
  }
  ctx.fillStyle = "rgba(36,49,47,.36)";
  ctx.fillRect(left, height * .76, width * .38, 2);
  return canvas.toDataURL("image/png");
}

function readSavedStyles() {
  try { return JSON.parse(localStorage.getItem(STYLES_KEY) || "[]"); } catch { return []; }
}

export function CoverGenerator() {
  const [ratio, setRatio] = useState("9:16");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverStyleUrl, setCoverStyleUrl] = useState("");
  const [referenceImages, setReferenceImages] = useState([]);
  const [hasReferences, setHasReferences] = useState(false);
  const [mainText, setMainText] = useState("");
  const [subText, setSubText] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [styles, setStyles] = useState(readSavedStyles);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("");

  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setInterval(() => setGenerationProgress((value) => Math.min(88, value + Math.max(1, Math.round((88 - value) / 18)))), 650);
    return () => window.clearInterval(timer);
  }, [loading]);

  const canSubmit = useMemo(() => Boolean(coverUrl && mainText.trim() && (!hasReferences || referenceImages.length)), [coverUrl, mainText, hasReferences, referenceImages]);

  async function handleCoverPaste(event) {
    const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    const original = await readFileAsDataUrl(file);
    setCoverUrl(original);
    setCoverStyleUrl(await compressReferenceImage(file));
    setNotice("书籍封面已载入，生成时会原样插入海报，不会修改封面内容。");
  }

  async function handleReferenceFiles(event) {
    const files = [...(event.target.files || [])].filter((file) => file.type.startsWith("image/")).slice(0, 3);
    setReferenceImages(await Promise.all(files.map(compressReferenceImage)));
    setNotice(files.length ? `已载入 ${files.length} 张参考图，将用于模仿风格。` : "请选择图片格式的参考图。");
  }

  async function generate() {
    if (!canSubmit) {
      setNotice("请先粘贴书籍封面、填写主文案；如果选择参考图，至少上传 1 张。 ");
      return;
    }
    setLoading(true);
    setGenerationProgress(8);
    setGenerationStage("正在读取参考图和书籍封面");
    setNotice("正在分析风格并生成海报背景……");
    try {
      setGenerationStage(hasReferences ? "正在学习参考图的版式与设计语言" : "正在提取书籍封面的配色与材质");
      const response = await fetch("/api/cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ratio, mainText, subText, hasReferences, bookCover: coverStyleUrl, referenceImages }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.imageUrl) throw new Error(data.error || "封面生成失败");
      setGenerationProgress(91);
      setGenerationStage("正在精确合成书籍封面与文案");
      const composed = await composeCover({ backgroundUrl: data.imageUrl, coverUrl, ratio, mainText, subText });
      setGenerationProgress(100);
      setGenerationStage("封面生成完成");
      setResultUrl(composed);
      setPrompt(data.prompt || "");
      setNotice("封面已生成。文字和书籍封面由系统后期精确合成。 ");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "封面生成失败，请稍后重试");
    } finally { window.setTimeout(() => setLoading(false), 350); }
  }

  function saveStyle() {
    if (!prompt) return setNotice("请先生成一张满意的封面，再保存风格。");
    const record = { id: Date.now(), createdAt: new Date().toISOString(), ratio, mainText, subText, prompt, referenceImages };
    const next = [record, ...styles].slice(0, 12);
    try { localStorage.setItem(STYLES_KEY, JSON.stringify(next)); setStyles(next); setNotice("风格已保存，下次可以直接沿用这套配置。 "); } catch { setNotice("风格已生成，但参考图较大，暂时无法完整保存到浏览器。 "); }
  }

  function applyStyle(style) {
    setRatio(style.ratio); setMainText(style.mainText); setSubText(style.subText); setReferenceImages(style.referenceImages || []); setHasReferences(Boolean(style.referenceImages?.length)); setNotice("已沿用保存的风格配置，请粘贴新的书籍封面后生成。 ");
  }

  return <section className="cover-generator-page">
    <header className="cover-generator-heading"><div><p className="eyebrow">CONTENT PRODUCTION / COVER GENERATOR</p><h3>封面生成</h3><p>粘贴书籍封面，配置文案和视觉参考，一键生成适合发布的海报封面。</p></div><span className="status-pill">本地保存配置</span></header>
    <div className="cover-generator-grid">
      <section className="cover-generator-form">
        <div className="cover-field"><label>图片尺寸</label><div className="cover-ratio-grid">{RATIOS.map((item) => <button type="button" className={ratio === item ? "selected" : ""} key={item} onClick={() => setRatio(item)}>{item}</button>)}</div></div>
        <div className="cover-field"><label>书籍封面 <small>直接复制图片后粘贴到这里</small></label><div className={`cover-paste-zone ${coverUrl ? "has-image" : ""}`} tabIndex="0" onPaste={handleCoverPaste}>{coverUrl ? <><img src={coverUrl} alt="已粘贴的书籍封面" /><button type="button" onClick={() => setCoverUrl("")}>更换封面</button></> : <><strong>点击这里，然后按 ⌘V / Ctrl+V</strong><span>系统只会把书籍封面原样插入海报，不会修改它</span></>}</div></div>
        <div className="cover-field"><label htmlFor="cover-main-text">主文案</label><textarea id="cover-main-text" value={mainText} onChange={(event) => setMainText(event.target.value)} placeholder="例如：为什么青春期孩子最容易冲动？" rows="3" /></div>
        <div className="cover-field"><label htmlFor="cover-sub-text">副文案 <small>可选</small></label><textarea id="cover-sub-text" value={subText} onChange={(event) => setSubText(event.target.value)} placeholder="例如：理解情绪背后的成长信号" rows="2" /></div>
        <div className="cover-field"><label>参考图风格</label><div className="cover-reference-choice"><button type="button" className={hasReferences ? "selected" : ""} onClick={() => setHasReferences(true)}>有参考图</button><button type="button" className={!hasReferences ? "selected" : ""} onClick={() => { setHasReferences(false); setReferenceImages([]); }}>无参考图</button></div>{hasReferences && <label className="cover-reference-upload"><span>上传参考图（最多 3 张，至少 1 张）</span><input type="file" accept="image/*" multiple onChange={handleReferenceFiles} /></label>}{referenceImages.length > 0 && <div className="cover-reference-count">已选择 {referenceImages.length} 张参考图</div>}</div>
        {notice && <p className="cover-generator-notice">{notice}</p>}
        {loading && <div className="cover-generation-progress" role="status" aria-live="polite"><div><span>{generationStage}</span><strong>{generationProgress}%</strong></div><i><b style={{ width: `${generationProgress}%` }} /></i><small>生成过程可能需要一点时间，请保持当前页面打开。</small></div>}
        <button type="button" className="cover-submit" onClick={generate} disabled={loading}>{loading ? "生成中……" : resultUrl ? "再次生成" : "提交并生成封面"}</button>
      </section>
      <section className="cover-generator-result"><div className="cover-result-heading"><div><p className="eyebrow">OUTPUT / ONE VERSION</p><h4>生成结果</h4></div>{resultUrl && <span className="cover-result-ratio">{ratio}</span>}</div>{resultUrl ? <><img className="cover-result-image" src={resultUrl} alt="生成的封面" /><div className="cover-result-actions"><a href={resultUrl} download={`cover-${ratio.replace(":", "-")}.png`}>下载 PNG</a><button type="button" onClick={saveStyle}>保存风格</button></div></> : <div className="cover-result-empty"><span>✦</span><strong>你的封面会出现在这里</strong><small>先完成左侧配置，系统只生成一个版本，满意后可以保存风格。</small></div>}</section>
    </div>
    {styles.length > 0 && <section className="cover-saved-styles"><div><p className="eyebrow">SAVED STYLE</p><h4>已保存的风格</h4></div><div className="cover-style-list">{styles.map((style) => <button type="button" key={style.id} onClick={() => applyStyle(style)}><strong>{style.mainText || "未命名风格"}</strong><small>{style.ratio} · {style.referenceImages?.length || 0} 张参考图 · 沿用配置</small></button>)}</div></section>}
  </section>;
}
