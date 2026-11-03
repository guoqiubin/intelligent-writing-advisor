const PAGE_MARKER = /(?:\[\s*第\s*(\d+)\s*(张\s*PPT|页)\s*\]|\[\s*PPT\s*(\d+)\s*[-—–:：]?\s*\]|^\s*PPT\s*(\d+)\s*[-—–:：]?\s*$)/gim;
let pdfjsPromise;
const PDF_RENDER_WIDTH = 2560;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")
    ]).then(([pdfjsLib, worker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

export function parseMarkedScript(text) {
  const matches = [...text.matchAll(PAGE_MARKER)];
  const getPageNumber = (match) => Number(match[1] || match[3] || match[4]);
  const pages = matches.map((match, index) => ({
    page: getPageNumber(match),
    marker: match[0],
    markerType: match[2] ? (/PPT/i.test(match[2]) ? "ppt" : "page") : "ppt",
    text: text.slice((matches[index]?.index ?? 0) + (matches[index]?.[0].length ?? 0), matches[index + 1]?.index ?? text.length).trim()
  }));
  const errors = [];
  matches.forEach((match, index) => {
    const currentPage = getPageNumber(match);
    const previousPage = index > 0 ? getPageNumber(matches[index - 1]) : null;
    if (!Number.isInteger(currentPage) || currentPage < 1) errors.push(`第 ${index + 1} 个分页标记无法识别页码`);
    else if (previousPage !== null && currentPage !== previousPage + 1) errors.push(`页码顺序异常：第 ${index + 1} 个标记是第 ${currentPage} 页，上一标记是第 ${previousPage} 页`);
  });
  if (!matches.length) errors.push("没有找到分页标记，请使用 PPT29 -、[PPT29 -] 或 [第 29 张 PPT]");
  return { pages, errors, markerCount: matches.length };
}

export async function extractDocxText(file) {
  const { default: mammoth } = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.replace(/\r\n/g, "\n").trim();
}

export async function renderPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(4.5, Math.max(2, PDF_RENDER_WIDTH / baseViewport.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建 PDF 画布");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push({ page: pageNumber, url: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, scale });
  }
  return pages;
}

export function demoCues() {
  return [
    { page: 1, anchorText: "今天我们先建立一个共同的问题框架", startMs: 0, confidence: 1 },
    { page: 2, anchorText: "接下来进入第二部分，来看具体方法", startMs: 9200, confidence: 1 },
    { page: 3, anchorText: "最后我们把三个关键点放在一起", startMs: 19800, confidence: 1 }
  ];
}

export function demoCaptions() {
  return [
    { text: "今天我们先建立一个共同的问题框架", startMs: 0, endMs: 4600 },
    { text: "这一步的重点，是让音频和画面的节奏先对齐。", startMs: 4600, endMs: 9200 },
    { text: "接下来进入第二部分，来看具体方法", startMs: 9200, endMs: 14400 },
    { text: "最后我们把三个关键点放在一起。", startMs: 14400, endMs: 26000 }
  ];
}
