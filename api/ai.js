import { handleAiRequest } from "./ai-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await handleAiRequest(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || "AI request failed" });
  }
}
