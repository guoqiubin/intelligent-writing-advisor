import { Composition } from "remotion";
import { SyncVideo } from "./Video";

const defaultProps = { audioSrc: "", audioDurationMs: 30000, pages: [], cues: [], captions: [] };

export const RemotionRoot = () => <Composition id="SyncVideo" component={SyncVideo} defaultProps={defaultProps} durationInFrames={900} fps={30} width={1920} height={1080} calculateMetadata={({ props }) => {
  const lastCaption = props.captions[props.captions.length - 1]?.endMs ?? 0;
  const lastCue = props.cues[props.cues.length - 1]?.startMs ?? 0;
  const durationMs = Math.max(props.audioDurationMs ?? 0, lastCaption, lastCue, 1000);
  return { durationInFrames: Math.max(30, Math.ceil(durationMs / 1000 * 30)), fps: 30, width: 1920, height: 1080 };
}} />;
