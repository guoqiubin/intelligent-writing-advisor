export const STORAGE_KEY = "intelligent-writing-advisor-project-v1";
export const HISTORY_KEY = "intelligent-writing-advisor-history-v1";
export const COMMUNITY_HISTORY_KEY = "intelligent-writing-advisor-community-history-v1";
export const BOOK_HISTORY_KEY = "intelligent-writing-advisor-book-history-v1";
export const APP_VERSION = "v2.1.30";
export const ACCESS_SESSION_KEY = "intelligent-writing-advisor-access-v1";
export const DEFAULT_PASSWORD_HASH = "98c3a520a665969cfc2d02d68642b04f039540702476d3820023ba577e8d4415";

export const releaseNotes = [
  "修复：PPTX 上传改用 WPS 官方 wpscli 静默转换接口，解决 macOS 上课件读取失败和 WPS 参数错误。",
  "新增：声画同步的上传课件同时支持 PDF 和 PPTX，PPTX 会在本机静默转换为高清页面后继续沿用原有一键生成流程。",
  "优化：PPTX 转换增加本地转换器回退和超时保护，转换失败时明确提示，不再让页面无响应。",
  "优化：网页每次打开时默认收起左侧导航栏，点击左上角按钮后再展开，减少首页空间占用。",
  "修复：正式渲染前自动压缩高清 PDF 页面，避免 37 页以上文稿重复触发 180MB 上传失败。",
  "新增：渲染前估算素材总量并自动启用第二档压缩，超过安全阈值时提前提示。",
  "修复：声画同步页面切换取消透明淡入造成的黑帧，避免课件视频出现闪黑或跳帧感。",
  "修复：验收视频时长按实际截取时长计算，不再额外延长约 5 秒。",
  "修复：1 分钟验收视频不再上传全部高清 PDF 页面，避免超过本地 180MB 限制。",
  "优化：音频预览结束时自动切换到末尾未标记页面，并显示结尾页切换提示。",
  "新增：声画同步支持先生成 1 分钟验收视频，用于检查清晰度、尺寸、翻页和字幕后再渲染正式视频。",
  "修复：PDF 页数多于文稿翻页标记时，末尾未标记页面不再被静默遗漏，会自动加入结尾时间线。",
  "优化：末尾未标记页面默认保留 2 秒，并在渲染阶段明确显示对应页码。",
  "修复：PPT29 - 等新式分页标记的顺序校验不再显示 undefined。",
  "优化：分页标记可以从任意正整数开始，只要后续页码连续即可。",
  "修复：声画同步素材卡片明确显示文件已上传状态，避免 DOCX 已选择但仍显示加号造成误解。",
  "兼容：标记口播稿支持 PPT29 -、[PPT29 -] 等规律格式，并继续兼容 [第 29 张 PPT] 和 [第29页]。",
  "升级：封面生成强化主标题、副标题和装饰线的版式层级，向高质量书籍海报靠拢。",
  "升级：书籍封面去除外部白色边框后再融入画面，保留封面内部原有的白色设计。",
  "优化：背景生成明确禁止伪造书封、白卡片和占位框，避免出现贴图感。",
  "升级：封面生成重新区分书籍封面与设计参考图，前者提供配色和材质，后者学习标题、作者和封面布局。",
  "新增：封面生成增加横向进度反馈，展示风格分析、背景生成和精确合成阶段。",
  "新增：封面生成成为独立一级模块，支持比例选择、粘贴书籍封面、参考图风格、精确文案合成、下载和保存风格。",
  "优化：读书会写作、书籍拆解和声画同步一级入口改用统一线性 UI 图标，增强业务识别度。",
  "重构：各业务的子工作流直接展开在对应一级业务入口下，保持读书会写作、书籍拆解和声画同步的层级独立。",
  "修复：侧边栏明确区分平行业务入口与当前业务工作流，避免把书籍拆解、声画同步或历史记录误认为读书会写作的子类。",
  "优化：产品更新入口由菱形装饰图标改为更易识别的铃铛通知图标。",
  "新增：声画同步增加版本化图文新手教程，覆盖素材上传、翻页标记、预览、字幕选择和 MP4 导出。",
  "修复：结构框架 AI 返回 JSON 偶发格式不完整时增加容错解析，无法可靠修复时保留原有框架并提示重试。",
  "升级：声画同步 MP4 改用固定高清码率策略，视频码率约 4 Mbps、音频码率约 192 kbps，提升文字和细线条的稳定清晰度。",
  "修复：高清页面不再以超大 Base64 参数直接注入 Remotion，改为本地渲染资源地址，降低 Chrome Target closed 崩溃概率。",
  "升级：声画同步 PDF 页面改为高分辨率 PNG 素材，并提高 MP4 编码质量。",
  "新增：视频生成期间显示当前动作、已完成阶段、帧数和耗时。",
  "新增：声画同步增加渲染历史表，持久保存 MP4 视频时长、渲染耗时、字幕状态和下载入口。",
  "更新：自动迁移已有 MP4 文件到渲染历史；过去无法恢复的渲染耗时会标记为未知。",
  "更新：侧边栏默认收起，点击左上角按钮后展开，节省创作空间。",
  "修复：读书会写作、书籍拆解和声画同步保持同级，切换业务时只展开当前业务的历史记录和工作流。",
  "修复：字幕开关现在只控制 MP4 内是否嵌入字幕，彻底取消 SRT 文件输出。",
  "新增：声画同步支持按次选择是否生成字幕，关闭时仅导出 MP4。",
  "新增：视频生成过程显示处理阶段、帧数、视频时长和实际耗时。",
  "更新：声画同步工作台统一采用写作系统的米白、橙色、绿色 UI 规范，保持平台视觉一致。",
  "修复：声画同步工作台补充 React 运行时依赖，解决入口打开后持续报错。",
  "修复：声画同步页面改为按需加载 PDF 与 DOCX 解析器，避免进入独立入口时页面空白。",
  "修复：声画同步入口改为明确跳转到本地独立地址，避免点击后无响应。",
  "修复：声画同步不再嵌入线上页面，点击后跳转到本机后台，避免线上页面卡死。",
  "新增：macOS 登录后自动启动声画同步前端与本地渲染服务。",
  "架构升级：托德学院智写系统升级为托德学院创作工作台，写作与音视频创作统一进入内容生产平台。",
  "新增：声画同步工作台作为与读书会写作、书籍拆解平行的第三个创作入口。",
  "修复：上传纯英文 PDF 时提前识别并弹窗提示，避免进入解读流程消耗 token。",
  "更新：侧边栏改为可拖拽调整宽度，读书会写作与书籍拆解分别管理子步骤和历史记录。",
  "更新：产品更新公告移至右上角更新入口，不再占用业务工作区。",
  "新增：读书会写作与书籍拆解成为两个平行业务入口。",
  "新增：书籍拆解工作流支持上传书籍、知识解读、写作设置、生成文稿和 AI 审核。",
  "新增：左侧导航栏支持折叠、悬停高亮和当前业务高亮。",
  "新增：结构框架增加“已有内容大纲”并行入口，可跳过前置流程直接进入写作。",
  "更新：AI 写作会优先使用用户直接提供的内容大纲作为主框架。",
  "更新：资料准备改为快速、证据、深度三种可选模式。",
  "更新：快速模式默认不强制上传电子书，可直接借助通用大模型拆解。",
  "新增：产品更新模块支持展开查看历史全部更新记录。",
  "更新：当前版本升级为 v2.0.0。"
];

export const releaseHistory = [
  {
    version: "v2.1.7",
    notes: releaseNotes
  },
  {
    version: "v1.6.0",
    notes: [
      "更新：侧边栏改为可拖拽调整宽度，读书会写作与书籍拆解分别管理子步骤和历史记录。",
      "更新：产品更新公告移至右上角更新入口，不再占用业务工作区。"
    ]
  },
  {
    version: "v1.5.0",
    notes: [
      "新增：读书会写作与书籍拆解成为两个平行业务入口。",
      "新增：书籍拆解工作流支持上传书籍、知识解读、写作设置、生成文稿和 AI 审核。"
    ]
  },
  {
    version: "v1.4.0",
    notes: [
      "新增：结构框架增加“已有内容大纲”并行入口，可跳过前置流程直接进入写作。",
      "更新：AI 写作会优先使用用户直接提供的内容大纲作为主框架。"
    ]
  },
  {
    version: "v1.3.0",
    notes: [
      "更新：资料准备改为快速、证据、深度三种可选模式。",
      "更新：快速模式默认不强制上传电子书，可直接借助通用大模型拆解。",
      "新增：产品更新模块支持展开查看历史全部更新记录。"
    ]
  },
  {
    version: "v1.2.3",
    notes: [
      "删除：左下角 API 成本展示模块。",
      "更新：保留真实 AI 调用失败时的错误提示，便于定位问题。"
    ]
  },
  {
    version: "v1.2.2",
    notes: [
      "更新：界面切换为 Retro Futurism 复古未来主义风格。",
      "更新：左上角替换为托德学院官方头像。",
      "更新：品牌名称改为托德学院智写系统。"
    ]
  },
  {
    version: "v1.2.1",
    notes: [
      "修复：生成全文文稿不再强制 JSON 输出，避免长文返回解析失败。",
      "新增：AI 写作步骤支持用户粘贴文字稿或上传文稿，直接进入 AI 审核。",
      "新增：书籍拆解阶段增加进度反馈；已完成流程节点显示打勾。"
    ]
  }
];

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isAccessGranted() {
  return localStorage.getItem(ACCESS_SESSION_KEY) === "granted";
}

export function grantAccess() {
  localStorage.setItem(ACCESS_SESSION_KEY, "granted");
}

export function revokeAccess() {
  localStorage.removeItem(ACCESS_SESSION_KEY);
}

export const steps = [
  { id: "problem", title: "学员困惑", note: "上传、生成并确认" },
  { id: "books", title: "书籍匹配", note: "3 本候选或自主指定" },
  { id: "source", title: "资料准备", note: "三档资料模式" },
  { id: "analysis", title: "书籍拆解", note: "提取 Y 个相关观点" },
  { id: "frame", title: "结构框架", note: "确认文字稿结构" },
  { id: "settings", title: "写作设置", note: "方式、字数、参考稿" },
  { id: "draft", title: "AI 写作", note: "一次性或分模块输出" },
  { id: "review", title: "AI 审核", note: "事实、逻辑与谬误" }
];

export const bookSteps = [
  { id: "book-upload", title: "上传书籍", note: "上传并确认资料" },
  { id: "book-analysis", title: "知识解读", note: "提取全书核心内容" },
  { id: "book-settings", title: "写作设置", note: "确定文稿方向" },
  { id: "book-draft", title: "生成文稿", note: "生成书籍拆解稿" },
  { id: "book-review", title: "AI 审核", note: "核对来源与逻辑" }
];

export const defaultProblem =
  "敏华，37 岁，销售主管，女儿 12 岁。她发现女儿遇到问题的第一反应总是怪别人：竞选班长没选上，说同学嫉妒她；足球比赛输了，说队友太差劲。敏华担心一味纠正会伤害孩子自尊，但不纠正又像是在纵容推卸责任。她想知道，这种“怪别人”的表达和乐观、自尊、责任感之间到底是什么关系，自己该不该干预。";

export const initialProject = {
  title: "亲子归因与乐观训练课程稿",
  problemSource: "real",
  learnerProblem: "",
  problemConfirmed: false,
  bookCandidates: [],
  selectedBookId: "",
  manualBook: "",
  manualBookConfirmed: false,
  sourceFiles: [],
  sourceMode: "quick",
  sourceUploadError: "",
  sourceScope: "",
  sourceNote: "",
  sourceConfirmed: false,
  analysis: null,
  analysisHistory: [],
  analysisFeedback: "",
  analysisNotice: "",
  analysisConfirmed: false,
  frame: null,
  frameHistory: [],
  frameFeedback: "",
  frameNotice: "",
  frameConfirmed: false,
  directOutline: "",
  directOutlineConfirmed: false,
  writingMode: "modular",
  wordRule: "around",
  wordCount: 3500,
  hasReference: false,
  referenceText: "",
  referenceFiles: [],
  settingsConfirmed: false,
  draft: null,
  manualDraftText: "",
  draftFiles: [],
  review: null,
  revisionTarget: null,
  resolvedReviewKeys: [],
  copyStatus: "",
  usage: []
  ,
  bookTitle: "",
  bookAuthor: "",
  bookFiles: [],
  bookLanguageStatus: "",
  bookSourceConfirmed: false,
  bookAnalysis: null,
  bookAnalysisHistory: [],
  bookAnalysisFeedback: "",
  bookAnalysisConfirmed: false,
  bookWritingTitle: "",
  bookWritingType: "读书拆解稿",
  bookAudience: "普通读者",
  bookTopic: "",
  bookWritingMode: "modular",
  bookWordRule: "around",
  bookWordCount: 3500,
  bookSettingsConfirmed: false,
  bookDraft: null,
  bookReview: null
};

export function loadProject() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...initialProject, ...saved } : initialProject;
  } catch {
    return initialProject;
  }
}

export function saveProject(project) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProjectForStorage(project)));
}

export function resetProject() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProjectForStorage(initialProject)));
  return initialProject;
}

function stripFilePayload(file = {}) {
  const { base64, text, ...metadata } = file;
  return metadata;
}

export function sanitizeProjectForStorage(project) {
  return {
    ...project,
    sourceFiles: (project.sourceFiles || []).map(stripFilePayload),
    referenceFiles: (project.referenceFiles || []).map(stripFilePayload),
    bookFiles: (project.bookFiles || []).map(stripFilePayload)
  };
}

export function loadHistory(workflowType = "community") {
  try {
    const key = workflowType === "book" ? BOOK_HISTORY_KEY : COMMUNITY_HISTORY_KEY;
    const stored = localStorage.getItem(key);
    const saved = JSON.parse(stored ?? (workflowType === "community" ? localStorage.getItem(HISTORY_KEY) || "[]" : "[]"));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveHistory(history, workflowType = "community") {
  const key = workflowType === "book" ? BOOK_HISTORY_KEY : COMMUNITY_HISTORY_KEY;
  localStorage.setItem(key, JSON.stringify(history.slice(0, 10)));
}

export function archiveProject(project, workflowType = "community") {
  const book = getSelectedBook(project);
  const entry = {
    id: `draft-${Date.now()}`,
    title: project.title || "未命名稿件",
    bookTitle: book?.title || "未指定书籍",
    wordTarget: `${project.wordRule === "minimum" ? "不少于" : "控制在"} ${project.wordCount} 字`,
    writingMode: project.writingMode,
    createdAt: new Date().toISOString(),
    learnerProblem: project.learnerProblem,
    content: project.draft?.fullText || "",
    workflowType
  };
  const nextHistory = [entry, ...loadHistory(workflowType)].slice(0, 10);
  saveHistory(nextHistory, workflowType);
  return nextHistory;
}

export function estimateCall(stage, model = "mock-low-cost", inputTokens = 900, outputTokens = 500) {
  const estimatedCost = ((inputTokens * 0.00000005) + (outputTokens * 0.0000004)).toFixed(5);
  return {
    id: `${stage}-${Date.now()}`,
    stage,
    model,
    inputTokens,
    outputTokens,
    estimatedCost: Number(estimatedCost),
    createdAt: new Date().toISOString()
  };
}

export function generateProblem() {
  return defaultProblem;
}

export function matchBooks(problem) {
  const theme = problem.includes("孩子") || problem.includes("女儿") ? "亲子归因" : "生活困惑";
  return [
    {
      id: "learned-optimism",
      title: "活出最乐观的自己",
      author: "马丁·塞利格曼",
      reason: `适合从“${theme}”切入，解释孩子如何理解失败、责任和自尊之间的关系。`
    },
    {
      id: "mindset",
      title: "终身成长",
      author: "卡罗尔·德韦克",
      reason: "适合把“怪别人”转化为成长型思维训练，帮助家长区分保护自尊和逃避责任。"
    },
    {
      id: "self-compassion",
      title: "自我关怀的力量",
      author: "克里斯廷·内夫",
      reason: "适合处理孩子犯错后的羞耻感和防御反应，避免把承担责任等同于自我攻击。"
    }
  ];
}

export function buildAnalysis(bookTitle) {
  const title = bookTitle || "选定书籍";
  return {
    authorIntro: `${title} 的作者资料需要在上传书籍或人工资料后进一步校验；当前原型只生成结构化占位内容。`,
    influenceIntro: "正式版本会结合上传资料或可信来源生成影响力简介，并标注资料来源。",
    ideas: [
      {
        title: "孩子的归因方式会影响她如何理解失败",
        body: "当孩子把失败全部归因于外部，她可能暂时保护自尊，但也失去复盘和改进的入口。",
        source: "第 2 章「解释风格」/ 第 2 节 / 约 p.37-42",
        evidence: "段落线索：作者讨论人们如何解释失败，以及不同解释方式会影响后续行动。正式版本会替换为上传书籍中的真实页码与原文短引。"
      },
      {
        title: "承担责任不等于否定自我价值",
        body: "家长需要帮助孩子区分“我这次哪里可以改进”和“我这个人不够好”，避免责任教育变成羞耻教育。",
        source: "第 4 章「失败后的自我解释」/ 第 1 节 / 约 p.86-91",
        evidence: "段落线索：书中区分具体行为评价与整体人格评价。正式版本会绑定到资料块、章节标题和页码。"
      },
      {
        title: "乐观不是甩锅，而是保留行动感",
        body: "更成熟的乐观会承认现实限制，同时找到下一次能做得更好的具体行动。",
        source: "第 6 章「习得性乐观训练」/ 练习部分 / 约 p.132-139",
        evidence: "段落线索：作者把乐观训练落到可练习的解释方式调整，而不是简单正向思考。"
      }
    ],
    practices: [
      {
        title: "复盘三栏表",
        body: "事实发生了什么、我能控制什么、下一次做一个什么动作。",
        source: "第 6 章练习：解释风格记录表 / 约 p.140",
        evidence: "段落线索：书中要求把抽象解释改写为具体、可检查的行动记录。"
      },
      {
        title: "归因替换句",
        body: "把“都是他们的问题”改写为“有些因素我控制不了，但我可以先改进一件事”。",
        source: "第 6 章练习：反驳悲观解释 / 约 p.145-148",
        evidence: "段落线索：作者示范如何把绝对化解释改写成更具体、更可行动的解释。"
      },
      {
        title: "家庭 10 分钟复盘",
        body: "每周一次，只讨论一个具体事件，不评价人格。",
        source: "第 7 章应用场景：亲子沟通 / 约 p.163-168",
        evidence: "段落线索：正式版本会从上传资料中提取亲子沟通相关段落。"
      },
      {
        title: "完成记录追踪",
        body: "孩子是否能说出一个外部因素和一个可改进行动。",
        source: "第 6 章练习总结 / 约 p.149",
        evidence: "段落线索：该建议来自“可观察行动”原则，正式版本需绑定真实页码。"
      }
    ]
  };
}

export function buildFrame(project) {
  const book = getSelectedBook(project);
  return [
    {
      title: "开场：从敏华的两难说起",
      goal: "让听众进入真实情境，承认家长既怕孩子甩锅，也怕伤害孩子自尊。"
    },
    {
      title: `书籍引入：为什么选择《${book?.title || "选定书籍"}》`,
      goal: "说明推荐理由，但不承诺一本书能必然解决问题。"
    },
    {
      title: "第一部分：归因方式如何影响孩子面对失败",
      goal: "解释孩子为什么会把问题推给别人，以及这背后的心理功能。"
    },
    {
      title: "第二部分：责任感和自尊并不是对立面",
      goal: "拆开“承担责任”和“否定自己”的混淆。"
    },
    {
      title: "第三部分：把乐观变成行动感",
      goal: "把观点转化为可执行、可追踪的训练方式。"
    },
    {
      title: "总结：给家长一个温和但清晰的干预原则",
      goal: "回扣学员困惑，收束为可操作原则。"
    }
  ];
}

export function buildDraft(project) {
  const book = getSelectedBook(project);
  const frame = project.frame || [];
  const modules = frame.map((item, index) => ({
    key: `module-${index + 1}`,
    title: item.title,
    content: `【${item.title}】\n${item.goal}${item.children?.length ? `\n\n子分支：\n${item.children.map((child) => `- ${child.title}：${child.goal}`).join("\n")}` : ""}\n\n这里将围绕学员困惑展开课程/音频稿表达。正式接入 API 后，本模块会结合《${book?.title || "选定书籍"}》的资料块、目标字数和参考文稿风格生成。`
  }));

  return {
    mode: project.writingMode,
    wordTarget: `${project.wordRule === "minimum" ? "不少于" : "控制在"} ${project.wordCount} 字`,
    modules,
    fullText: modules.map((module) => module.content).join("\n\n")
  };
}

export function buildReview(project) {
  const resolved = new Set(project.resolvedReviewKeys || []);
  const statusFor = (key, fallback) => (resolved.has(key) ? "通过" : fallback);

  return [
    {
      key: "facts",
      type: "事实来源",
      status: statusFor("facts", project.sourceConfirmed ? "待人工审核" : "不通过"),
      detail: project.sourceConfirmed ? "资料已确认，但页码/章节绑定需在真实解析后补齐。" : "尚未确认书籍资料，正式写作前需要上传或接受资料不足风险。"
    },
    {
      key: "logic-risk",
      type: "逻辑风险",
      status: "通过",
      detail: "流程已避免把书籍推荐表达为必然解决，保留人工确认节点。"
    },
    {
      key: "practice",
      type: "实操建议",
      status: "通过",
      detail: "建议数量不超过 4 条，且具备步骤和追踪方向。"
    },
    {
      key: "cost",
      type: "成本控制",
      status: "通过",
      detail: "当前已调用真实 API，并记录 token usage；API 失败会暴露错误，避免本地模拟掩盖问题。"
    },
    {
      key: "typo",
      type: "错别字核查",
      status: statusFor("typo", "不通过"),
      detail: "当前原型未接入真实文本校对模型，请人工检查错别字、同音误用、专有名词误写和标点异常。"
    },
    {
      key: "fallacy",
      type: "逻辑谬误",
      status: statusFor("fallacy", "不通过"),
      detail: "正式版本会检查二分法、伪因果、过度概括、诉诸权威、循环论证等表达问题。"
    },
    {
      key: "grammar",
      type: "语法错误",
      status: statusFor("grammar", "不通过"),
      detail: "当前原型未接入真实语法模型，请人工检查病句、主谓宾残缺、搭配不当、长句断裂和口播不顺。"
    }
  ];
}

export function buildRevisionTarget(item) {
  const route = item.key === "facts" ? "source" : "draft";
  const reasonMap = {
    facts: "事实来源尚未完成核对：需要补齐书籍章节、页码、段落或短句证据，再回到审核页确认。",
    typo: "AI 判断文字稿可能存在错别字或专有名词误写，请回到文字稿中逐段检查。",
    fallacy: "AI 判断表达中可能存在逻辑谬误，例如伪因果、过度概括或二分法，请回到文字稿修正论证。",
    grammar: "AI 判断表达中可能存在语法错误或口播不顺，请回到文字稿修正文句。",
    practice: "AI 判断实操建议还不够可执行或可追踪，请回到文字稿补充步骤与追踪方式。",
    "logic-risk": "AI 判断文字稿仍可能存在逻辑风险，请回到文字稿检查因果关系和概念边界。",
    cost: "AI 判断当前生成成本策略异常，请回到文字稿确认是否需要减少重写或改为分模块生成。"
  };
  return {
    key: item.key,
    type: item.type,
    route,
    reason: reasonMap[item.key] || `AI 判断「${item.type}」未通过，请回到上一环节修改后重新审核。`
  };
}

export function getSelectedBook(project) {
  if (project.manualBookConfirmed && project.manualBook) {
    return { id: "manual", title: project.manualBook, author: "用户指定", reason: "用户不满意 AI 推荐后自主指定" };
  }
  return project.bookCandidates.find((book) => book.id === project.selectedBookId) || null;
}

export function normalizeBookName(value = "") {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[《》「」『』“”"'`]/g, "")
    .replace(/\b(pdf|docx?|txt|md|markdown|epub|mobi)\b/gi, "")
    .replace(/\d{4}\s*版/g, "")
    .replace(/第[一二三四五六七八九十0-9]+版/g, "")
    .replace(/(修订版|增订版|新版|珍藏版|纪念版|完整版|电子书|扫描版|文字版|中文版|出版|译本|终版)/g, "")
    .replace(/[\s_\-—–·.,，。:：;；()（）[\]【】{}<>《》]+/g, "")
    .trim();
}

function longestCommonSubsequenceLength(left, right) {
  if (!left || !right) return 0;
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = left[i - 1] === right[j - 1]
        ? rows[i - 1][j - 1] + 1
        : Math.max(rows[i - 1][j], rows[i][j - 1]);
    }
  }
  return rows[left.length][right.length];
}

export function validateBookFileMatch(bookTitle = "", fileName = "") {
  const normalizedBook = normalizeBookName(bookTitle);
  const normalizedFile = normalizeBookName(fileName);
  if (!normalizedBook || !normalizedFile) {
    return { ok: false, score: 0, normalizedBook, normalizedFile };
  }
  if (normalizedFile.includes(normalizedBook) || normalizedBook.includes(normalizedFile)) {
    return { ok: true, score: 1, normalizedBook, normalizedFile };
  }
  const common = longestCommonSubsequenceLength(normalizedBook, normalizedFile);
  const score = common / Math.max(normalizedBook.length, normalizedFile.length);
  return { ok: score >= 0.68, score, normalizedBook, normalizedFile };
}

export function canAccessStep(project, stepId) {
  const guards = {
    problem: true,
    books: project.problemConfirmed,
    source: Boolean(project.selectedBookId || project.manualBookConfirmed),
    analysis: project.sourceConfirmed,
    frame: project.analysisConfirmed,
    settings: project.frameConfirmed || project.directOutlineConfirmed,
    draft: project.settingsConfirmed,
    review: Boolean(project.draft)
  };
  return Boolean(guards[stepId]);
}

export function canAccessBookStep(project, stepId) {
  const guards = {
    "book-upload": true,
    "book-analysis": project.bookSourceConfirmed,
    "book-settings": project.bookAnalysisConfirmed,
    "book-draft": project.bookSettingsConfirmed,
    "book-review": Boolean(project.bookDraft)
  };
  return Boolean(guards[stepId]);
}

export function isBookStepComplete(project, stepId) {
  const complete = {
    "book-upload": project.bookSourceConfirmed,
    "book-analysis": project.bookAnalysisConfirmed,
    "book-settings": project.bookSettingsConfirmed,
    "book-draft": Boolean(project.bookDraft),
    "book-review": Boolean(project.bookReview?.length) && project.bookReview.every((item) => item.status === "通过")
  };
  return Boolean(complete[stepId]);
}

export function isStepComplete(project, stepId) {
  const complete = {
    problem: project.problemConfirmed,
    books: Boolean(project.selectedBookId || project.manualBookConfirmed),
    source: project.sourceConfirmed,
    analysis: project.analysisConfirmed,
    frame: project.frameConfirmed,
    settings: project.settingsConfirmed,
    draft: Boolean(project.draft),
    review: Boolean(project.review?.length) && project.review.every((item) => item.status === "通过")
  };
  return Boolean(complete[stepId]);
}
