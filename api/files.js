import os from "node:os";
import path from "node:path";
import fsp from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

const MAX_FILE_BYTES = 12 * 1024 * 1024;

export const config = {
  api: {
    bodyParser: false
  }
};

function inferType(name = "", type = "") {
  if (type) return type;
  return name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
}

function detectPrimaryLanguage(buffer, fileName = "") {
  const sample = buffer.toString("latin1").slice(0, 4 * 1024 * 1024);
  const chineseCount = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (sample.match(/[A-Za-z]/g) || []).length;
  if (latinCount >= 500 && chineseCount === 0) return "english";
  if (chineseCount >= 20) return "chinese";
  if (/\b(english|novel|psychology|business|the art of)\b/i.test(fileName) && chineseCount === 0) return "english";
  return "unknown";
}

async function uploadToOpenAi(file, apiKey) {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", file, file.name || "source.pdf");
  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `OpenAI 文件上传失败：${response.status}`);
  return data.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const request = new Request("http://vercel-upload/api/files", {
      method: "POST",
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: "half"
    });
    const form = await request.formData();
    const uploaded = [];
    const uploadDir = path.join(os.tmpdir(), "intelligent-writing-advisor-uploads");
    await fsp.mkdir(uploadDir, { recursive: true });

    for (const item of form.getAll("files")) {
      if (!item || typeof item.arrayBuffer !== "function") continue;
      if (item.size > MAX_FILE_BYTES) {
        throw new Error(`文件过大：${item.name || "未命名文件"}，单个文件暂限 12MB。`);
      }

      const ext = path.extname(item.name || "");
      const buffer = Buffer.from(await item.arrayBuffer());
      const fileInfo = {
        name: item.name,
        size: item.size,
        type: inferType(item.name, item.type),
        language: detectPrimaryLanguage(buffer, item.name)
      };

      if (fileInfo.type === "application/pdf" && process.env.OPENAI_API_KEY) {
        fileInfo.openaiFileId = await uploadToOpenAi(item, process.env.OPENAI_API_KEY);
      } else if (/text|markdown|json|csv|xml|html/.test(fileInfo.type) || /\.(txt|md|csv|json)$/i.test(fileInfo.name)) {
        fileInfo.text = buffer.toString("utf8");
      } else {
        const serverPath = path.join(uploadDir, `${randomUUID()}${ext}`);
        await fsp.writeFile(serverPath, buffer);
        fileInfo.serverPath = serverPath;
      }

      uploaded.push(fileInfo);
    }

    return res.status(200).json({ files: uploaded });
  } catch (error) {
    return res.status(500).json({ error: error.message || "File upload failed" });
  }
}
