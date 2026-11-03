import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { defineConfig } from "vite";
import { handleAiRequest } from "./api/ai-core.js";
import { handleCoverRequest } from "./api/cover-core.js";

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), "../.env");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function aiApiPlugin() {
  return {
    name: "local-ai-api",
    configureServer(server) {
      server.middlewares.use("/api/files", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const request = new Request("http://local-upload/api/files", {
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
            const ext = path.extname(item.name || "");
            const serverPath = path.join(uploadDir, `${randomUUID()}${ext}`);
            const buffer = Buffer.from(await item.arrayBuffer());
            await fsp.writeFile(serverPath, buffer);
            uploaded.push({
              name: item.name,
              size: item.size,
              type: item.type || (ext.toLowerCase() === ".pdf" ? "application/pdf" : "application/octet-stream"),
              serverPath
            });
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ files: uploaded }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message || "File upload failed" }));
        }
      });

      server.middlewares.use("/api/ai", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const body = await readJson(req);
          const result = await handleAiRequest(body, { ...process.env, ...loadLocalEnv() });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message || "AI request failed" }));
        }
      });
      server.middlewares.use("/api/cover", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const body = await readJson(req);
          const result = await handleCoverRequest(body, { ...process.env, ...loadLocalEnv() });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message || "Cover generation failed" }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [aiApiPlugin()]
});
