import fs from "node:fs/promises";

const DEFAULT_MODEL = "gpt-5.4-mini";
const LONG_DRAFT_MODEL = "gpt-5.4";
const MAX_TEXT_CHARS = 60000;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

function jsonInstruction(shape) {
  return `只输出严格 JSON，不要 Markdown，不要代码块。JSON 结构如下：${JSON.stringify(shape)}`;
}

function truncateText(text = "", limit = MAX_TEXT_CHARS) {
  const value = String(text || "");
  return value.length > limit ? `${value.slice(0, limit)}\n\n[内容已截断，真实版本应分块处理]` : value;
}

function getOutputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const chunks = [];
  for (const item of response.output || []) {
    for (const part of item.content || []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractJsonCandidate(text) {
  const source = String(text || "").trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const value = fenced ? fenced[1].trim() : source;
  const start = value.search(/[\[{]/);
  if (start < 0) return value;
  const stack = [];
  let quoted = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack.at(-1) !== expected) return value.slice(start, index + 1);
      stack.pop();
      if (!stack.length) return value.slice(start, index + 1);
    }
  }
  return value.slice(start);
}

function repairCommonJsonMistakes(value) {
  let repaired = "";
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quoted) {
      repaired += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      repaired += char;
      continue;
    }
    if ((char === "}" || char === "]") && /^\s*[\[{]/.test(value.slice(index + 1))) {
      repaired += `${char},`;
      continue;
    }
    repaired += char;
  }
  return repaired.replace(/,\s*([}\]])/g, "$1");
}

function parseJson(text) {
  const candidate = extractJsonCandidate(text);
  try {
    return JSON.parse(candidate);
  } catch (firstError) {
    try {
      return JSON.parse(repairCommonJsonMistakes(candidate));
    } catch {
      const detail = firstError instanceof Error ? firstError.message : "格式错误";
      throw new Error(`AI 返回内容不是完整有效的 JSON（${detail}）。请重试，原有内容不会被覆盖。`);
    }
  }
}

async function fileBuffer(file) {
  if (file.serverPath) return fs.readFile(file.serverPath);
  return Buffer.from(file.base64 || "", "base64");
}

async function fileToBlob(file) {
  const buffer = await fileBuffer(file);
  return new Blob([buffer], { type: file.type || "application/octet-stream" });
}

async function uploadFile(file, apiKey) {
  if (file?.openaiFileId) return file.openaiFileId;
  if ((!file?.base64 && !file?.serverPath) || file.size > MAX_FILE_BYTES) return null;
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", await fileToBlob(file), file.name || "source.pdf");
  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `文件上传失败：${response.status}`);
  return data.id;
}

async function callResponses({ apiKey, model, prompt, schema, files = [], maxOutputTokens = 2400 }) {
  const content = [];
  for (const file of files.slice(0, 2)) {
    if ((file.base64 || file.serverPath || file.openaiFileId) && file.size <= MAX_FILE_BYTES && file.type === "application/pdf") {
      const fileId = await uploadFile(file, apiKey);
      if (fileId) content.push({ type: "input_file", file_id: fileId });
    }
    let text = file.text || "";
    if (!text && file.serverPath && /text|markdown|json|csv|xml|html/.test(file.type || "")) {
      text = await fs.readFile(file.serverPath, "utf8").catch(() => "");
    }
    if (text) {
      content.push({
        type: "input_text",
        text: `【上传资料：${file.name || "未命名资料"}】\n${truncateText(text, 30000)}`
      });
    }
  }
  content.push({ type: "input_text", text: `${prompt}\n\n${jsonInstruction(schema)}` });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      max_output_tokens: maxOutputTokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `OpenAI 请求失败：${response.status}`);
  return { payload: parseJson(getOutputText(data)), usage: data.usage || null, model };
}

async function callTextResponse({ apiKey, model, prompt, files = [], maxOutputTokens = 6000 }) {
  const content = [];
  for (const file of files.slice(0, 2)) {
    if ((file.base64 || file.serverPath || file.openaiFileId) && file.size <= MAX_FILE_BYTES && file.type === "application/pdf") {
      const fileId = await uploadFile(file, apiKey);
      if (fileId) content.push({ type: "input_file", file_id: fileId });
    }
    let text = file.text || "";
    if (!text && file.serverPath && /text|markdown|json|csv|xml|html/.test(file.type || "")) {
      text = await fs.readFile(file.serverPath, "utf8").catch(() => "");
    }
    if (text) {
      content.push({
        type: "input_text",
        text: `【上传资料：${file.name || "未命名资料"}】\n${truncateText(text, 30000)}`
      });
    }
  }
  content.push({ type: "input_text", text: prompt });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      max_output_tokens: maxOutputTokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `OpenAI 请求失败：${response.status}`);
  return { text: getOutputText(data), usage: data.usage || null, model };
}

function selectedBookLabel(project = {}) {
  if (project.manualBookConfirmed && project.manualBook) return project.manualBook;
  const selected = project.bookCandidates?.find((book) => book.id === project.selectedBookId);
  return selected?.title || project.manualBook || "未指定书籍";
}

function sourceFiles(project = {}) {
  return [...(project.sourceFiles || []), ...(project.referenceFiles || [])];
}

function bookFiles(project = {}) {
  return project.bookFiles || [];
}

export async function handleAiRequest(body, env = process.env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const action = body?.action;
  const project = body?.project || {};
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;

  if (action === "generateProblem") {
    return callResponses({
      apiKey,
      model,
      maxOutputTokens: 1200,
      schema: { learnerProblem: "一段完整的学员生活困惑文字" },
      prompt: "请基于心理学课程创作场景，生成一个真实、具体、有生活细节的学员困惑。必须包含学员基本信息、场景、原话式困惑和核心问题。"
    });
  }

  if (action === "matchBooks") {
    return callResponses({
      apiKey,
      model,
      maxOutputTokens: 1600,
      schema: {
        bookCandidates: [
          { id: "stable-id", title: "书名", author: "作者", reason: "推荐理由，不承诺必然解决" }
        ]
      },
      prompt: `根据以下学员困惑推荐 3 本最适合切入的心理学/教育/自我成长书籍。每本只输出书名、作者、推荐理由。不要说“一定能解决”。\n\n学员困惑：${project.learnerProblem}`
    });
  }

  if (action === "analyzeBook") {
    const book = selectedBookLabel(project);
    const sourceMode = project.sourceMode || "quick";
    const sourceModeInstruction = {
      quick: "当前为快速模式：不强制上传电子书。请基于通用大模型知识拆解，但必须明确提示来源为模型通用知识，不能编造具体页码、译本页数或原文短引；source 可写“通用模型知识，无上传资料页码”。",
      evidence: "当前为证据模式：用户会上传或粘贴目录、章节、摘录、划线内容。必须严格限定在用户指定的章节、摘录、划线和检索边界内拆解；如果资料不足，不要扩展到整本书。",
      deep: "当前为深度模式：用户上传 PDF 用于严肃交付。优先使用上传 PDF 资料，尽量给出章节、页码、段落线索或短引；如果页码无法确认，必须说明“待人工核验”。"
    }[sourceMode];
    return callResponses({
      apiKey,
      model,
      files: sourceMode === "quick" ? [] : sourceFiles(project),
      maxOutputTokens: 3600,
      schema: {
        analysis: {
          authorIntro: "作者简介",
          influenceIntro: "影响力简介",
          ideas: [
            { title: "观点标题", body: "观点解释", source: "第几章/第几节/第几页", evidence: "段落线索或短引" }
          ],
          practices: [
            { title: "实操标题", body: "步骤与追踪方式", source: "第几章/第几节/第几页", evidence: "段落线索或短引" }
          ]
        }
      },
      prompt: `围绕学员困惑拆解《${book}》。只提取与困惑相关的 Y 个观点，不要做整本书摘要。实操建议不超过 4 条，必须可定义、可执行、可追踪。

资料模式规则：${sourceModeInstruction}

用户指定的目录、章节、摘录、划线或检索边界：${project.sourceScope || "无"}

用户资料备注：${project.sourceNote || "无"}

学员困惑：${project.learnerProblem}`
        + `\n\n上一版拆解结果：${JSON.stringify(project.analysis || {})}`
        + `\n\n用户对上一版拆解的反馈：${project.analysisFeedback || "无"}`
        + "\n\n如果用户反馈不为空，请在保留有效来源线索的基础上重做拆解；不要只做措辞微调。"
    });
  }

  if (action === "generateBookAnalysis") {
    const title = project.bookTitle || "未命名书籍";
    const author = project.bookAuthor || "作者未填写";
    return callResponses({
      apiKey,
      model,
      files: bookFiles(project),
      maxOutputTokens: 5000,
      schema: {
        bookAnalysis: {
          coreTheme: "全书核心主题",
          authorIntro: "作者背景简介",
          authorIntent: "作者写作意图",
          chapters: [{ title: "章节或部分标题", summary: "章节核心内容", source: "章节或页码来源线索；无法确认时写待人工核验" }],
          concepts: [{ name: "关键概念", explanation: "概念解释" }]
        }
      },
      prompt: `请基于用户上传的书籍资料，做一份结构化知识解读，不要泛泛总结，也不要补写上传资料中不存在的事实。书名：${title}；作者：${author}。

请覆盖：全书核心主题、作者背景与写作意图、章节脉络、各部分核心内容、关键概念。所有章节和来源线索必须优先来自上传资料；无法确认页码或引用时明确写“待人工核验”。

用户对上一版解读的反馈：${project.bookAnalysisFeedback || "无"}
上一版解读：${JSON.stringify(project.bookAnalysis || {})}`
    });
  }

  if (action === "generateFrame") {
    const result = await callResponses({
      apiKey,
      model,
      maxOutputTokens: 3200,
      schema: {
        frame: [
          {
            title: "模块标题",
            goal: "模块论证功能",
            children: [{ title: "子分支标题", goal: "子分支论证功能" }]
          }
        ]
      },
      prompt: `根据学员困惑、书籍拆解和实操建议，生成课程/音频文字稿结构框架。不要输出全文。

强约束：
1. 框架必须覆盖书籍拆解中的核心观点与实操建议，不能与书籍拆解结构脱节。
2. 如果用户要求“整合”某些模块，只能把它们合并到父模块和子分支中，不能直接删除语义内容。
3. 如果用户只指出局部调整，未被点名的模块应尽量保留。
4. 每个模块的 goal 必须说明它承接了哪个观点、实操建议或学员困惑。

学员困惑：${project.learnerProblem}

书籍拆解：${JSON.stringify(project.analysis || {})}

上一版结构框架：${JSON.stringify(project.frame || [])}

用户调整反馈：${project.frameFeedback || "无"}`
    });
    if (Array.isArray(result.payload)) {
      result.payload = { frame: result.payload };
    }
    return result;
  }

  if (action === "generateDraft") {
    const wordRule = project.wordRule === "minimum" ? "不少于" : "控制在";
    const result = await callTextResponse({
      apiKey,
      model: env.OPENAI_LONG_MODEL || LONG_DRAFT_MODEL,
      files: sourceFiles(project),
      maxOutputTokens: Math.min(Math.max(Number(project.wordCount || 3500) * 2, 2500), 9000),
      prompt: `请生成一篇可供主创二次加工的中文课程/音频文字稿。直接输出正文，不要 JSON，不要 Markdown 代码块，不要解释你如何写作。

要求：${wordRule} ${project.wordCount} 字；写作方式：${project.writingMode}；围绕学员困惑，不要泛泛而谈；结合书籍来源和拆解观点；口语化但逻辑严谨；不要大段复制原文。

学员困惑：${project.learnerProblem}

结构框架：${project.directOutlineConfirmed ? `用户直接提供的内容大纲：\n${truncateText(project.directOutline || "", 18000)}` : JSON.stringify(project.frame || [])}

书籍拆解：${JSON.stringify(project.analysis || {})}

参考文稿风格：${truncateText(project.referenceText || "", 12000)}`
    });
    const fullText = result.text || "";
    return {
      payload: {
        draft: {
          mode: project.writingMode,
          wordTarget: `${wordRule} ${project.wordCount} 字`,
          modules: [{ key: "full-text", title: "完整文字稿", content: fullText }],
          fullText
        }
      },
      usage: result.usage,
      model: result.model
    };
  }

  if (action === "generateBookDraft") {
    const wordRule = project.bookWordRule === "minimum" ? "不少于" : "控制在";
    const result = await callTextResponse({
      apiKey,
      model: env.OPENAI_LONG_MODEL || LONG_DRAFT_MODEL,
      files: bookFiles(project),
      maxOutputTokens: Math.min(Math.max(Number(project.bookWordCount || 3500) * 2, 2500), 9000),
      prompt: `请生成一篇完整的中文书籍拆解成品文稿。直接输出正文，不要 JSON，不要 Markdown 代码块，不要解释写作过程。

书名：${project.bookTitle || "未命名书籍"}
作者：${project.bookAuthor || "作者未填写"}
文稿标题：${project.bookWritingTitle || "书籍核心解读"}
文稿类型：${project.bookWritingType || "读书拆解稿"}
目标读者：${project.bookAudience || "普通读者"}
目标字数：${wordRule} ${project.bookWordCount || 3500} 字
用户希望重点关注：${project.bookTopic || "无"}

写作要求：忠实于上传书籍和知识解读；清晰呈现章节脉络和关键概念；区分原书观点、合理推断和作者不确定的信息；不要伪造页码、引文或案例；语言适合目标读者，形成可直接交付的完整文稿。

知识解读：${JSON.stringify(project.bookAnalysis || {})}`
    });
    return { payload: { draft: { mode: project.bookWritingMode, wordTarget: `${wordRule} ${project.bookWordCount} 字`, modules: [], fullText: result.text || "" } }, usage: result.usage, model: result.model };
  }

  if (action === "reviewBookDraft") {
    return callResponses({
      apiKey,
      model,
      maxOutputTokens: 2400,
      schema: {
        review: [
          { key: "source-fidelity", type: "原书忠实度", status: "待人工审核", detail: "是否忠实呈现上传书籍观点" },
          { key: "citations", type: "来源与引用", status: "待人工审核", detail: "章节、页码和引文是否需要人工核验" },
          { key: "logic", type: "逻辑与结构", status: "通过", detail: "文稿结构和论证是否清晰" },
          { key: "language", type: "语言表达", status: "通过", detail: "是否适合目标读者和文稿类型" }
        ]
      },
      prompt: `请审核以下书籍拆解文稿。重点检查：是否忠实于上传书籍、是否虚构作者观点/页码/引文、是否把 AI 推断说成原书事实、结构逻辑是否清楚、语言是否适合目标读者。无法仅凭资料确认的内容标记为“待人工审核”，不要轻易判定为通过。

书籍知识解读：${JSON.stringify(project.bookAnalysis || {})}

文稿：${(project.bookDraft?.fullText || "").slice(0, 50000)}`
    });
  }

  if (action === "reviewDraft") {
    return callResponses({
      apiKey,
      model,
      files: [...sourceFiles(project), ...(project.draftFiles || [])],
      maxOutputTokens: 2400,
      schema: {
        review: [
          { key: "facts", type: "事实来源", status: "通过/待人工审核/不通过", detail: "原因" }
        ]
      },
      prompt: `审核以下课程/音频文字稿。审核项必须包括：事实来源、逻辑风险、实操建议、成本控制、错别字核查、逻辑谬误、语法错误。通过和不通过互斥；如果需要人工确认，状态为“待人工审核”；如果明显有问题，状态为“不通过”。如果用户上传了待审文稿文件，请以该文件内容作为文字稿审核对象。\n\n文字稿：${truncateText(project.draft?.fullText || "", 50000)}\n\n来源与拆解：${JSON.stringify(project.analysis || {})}`
    });
  }

  throw new Error(`Unsupported AI action: ${action}`);
}
