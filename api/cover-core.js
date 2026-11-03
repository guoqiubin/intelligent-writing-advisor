const MAX_REFERENCE_IMAGES = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ratioSizes = {
  "1:1": "1024x1024",
  "4:3": "1536x1024",
  "3:4": "1024x1536",
  "16:9": "1536x1024",
  "9:16": "1024x1536"
};

function dataUrlToBlob(dataUrl, fallbackName) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error(`${fallbackName} 图片格式无法读取`);
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error(`${fallbackName} 图片不能超过 8MB`);
  return new Blob([bytes], { type: match[1] });
}

function promptFor({ ratio, mainText, subText, hasReferences }) {
  return `Create a polished Chinese book-poster background in ${ratio} aspect ratio. The input images have two different jobs: the first image is the target book cover and is a palette/material reference only; the following images are design examples. ${hasReferences ? "Study the design examples rigorously: imitate their stable composition, with the main title and subtitle on the left, a clean divider/accent near the title, generous negative space, and an unchanged book-cover presentation area on the right. Learn their visual grammar without copying their text, logos, or exact artwork." : "Use the target book cover to derive the palette, texture, contrast, and visual mood, while keeping the same professional left-copy/right-book layout."}

The target book cover determines the poster's color system and material feeling. Do not replace it with generic pastel colors. The design examples determine layout and art direction. The final composition must reserve a bold, highly legible editorial title area on the left (large display typography will be added later), with a clear subtitle area and a refined accent rule. Reserve a balanced, visually integrated area on the right for the unchanged target book cover to be inserted later. Do not draw a fake book, white card, white frame, or placeholder cover in that area; only create supporting atmosphere, shadow, texture, or composition around it.

Do not generate any readable words, letters, logos, fake book covers, or watermarks in the background. Keep the visual hierarchy editorial, intentional, and as refined as the design examples.

Main copy to design around: ${mainText || "未提供"}
Secondary copy to design around: ${subText || "无"}`;
}

async function requestImage({ apiKey, prompt, size, inputImages, model }) {
  const endpoint = inputImages.length ? "https://api.openai.com/v1/images/edits" : "https://api.openai.com/v1/images/generations";
  if (!inputImages.length) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size, quality: "high", output_format: "jpeg" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `封面生成失败：${response.status}`);
    return data.data?.[0]?.b64_json ? `data:image/jpeg;base64,${data.data[0].b64_json}` : data.data?.[0]?.url;
  }

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", "high");
  form.append("output_format", "jpeg");
  inputImages.forEach((dataUrl, index) => form.append("image[]", dataUrlToBlob(dataUrl, index === 0 ? "书籍封面" : `参考图 ${index}`), `cover-style-${index}.jpg`));
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `参考图风格生成失败：${response.status}`);
  return data.data?.[0]?.b64_json ? `data:image/jpeg;base64,${data.data[0].b64_json}` : data.data?.[0]?.url;
}

export async function handleCoverRequest(body, env = process.env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const ratio = ratioSizes[body?.ratio] ? body.ratio : "9:16";
  const mainText = String(body?.mainText || "").trim();
  const subText = String(body?.subText || "").trim();
  const bookCover = String(body?.bookCover || "");
  const referenceImages = Array.isArray(body?.referenceImages) ? body.referenceImages.slice(0, MAX_REFERENCE_IMAGES) : [];
  if (!mainText) throw new Error("请先填写主文案");
  if (!bookCover) throw new Error("请先粘贴书籍封面");
  if (body?.hasReferences && !referenceImages.length) throw new Error("已选择参考图模式，请至少上传 1 张参考图");
  const prompt = promptFor({ ratio, mainText, subText, hasReferences: referenceImages.length > 0 });
  const imageModel = env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const imageUrl = await requestImage({ apiKey, prompt, size: ratioSizes[ratio], inputImages: [bookCover, ...referenceImages], model: imageModel });
  if (!imageUrl) throw new Error("生成接口没有返回图片");
  return { imageUrl, prompt, ratio, model: imageModel };
}
