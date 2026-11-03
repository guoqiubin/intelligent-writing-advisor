import { AbsoluteFill, Audio, Img, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

export const SyncVideo = ({ audioSrc, pages, cues, captions }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentMs = frame / fps * 1000;
  const currentCue = [...cues].reverse().find((cue) => currentMs >= cue.startMs) || cues[0];
  const currentPage = pages.find((page) => page.page === currentCue?.page) || pages[0];
  const caption = captions.find((item) => currentMs >= item.startMs && currentMs < item.endMs);
  const pageStartFrame = Math.round((currentCue?.startMs || 0) / 1000 * fps);

  return <AbsoluteFill style={{ backgroundColor: "#fffaf0", fontFamily: "Arial, sans-serif" }}>
    {audioSrc ? <Audio src={audioSrc} /> : null}
    {currentPage ? <Sequence from={pageStartFrame} durationInFrames={Math.max(1, durationInFrames - pageStartFrame)}><AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 }}><Img src={currentPage.url} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></AbsoluteFill></Sequence> : null}
    {caption ? <div style={{ position: "absolute", left: 120, right: 120, bottom: 72, padding: "18px 28px", borderRadius: 14, backgroundColor: "rgba(8, 12, 8, 0.78)", color: "#f4f6ee", textAlign: "center", fontSize: 38, lineHeight: 1.35, fontWeight: 600 }}>{caption.text}</div> : null}
  </AbsoluteFill>;
};
