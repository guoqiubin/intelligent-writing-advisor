import { handleCoverRequest } from "./cover-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    return res.status(200).json(await handleCoverRequest(req.body || {}));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Cover generation failed" });
  }
}
