import type { Stage, FlowMode } from "./types";

export const STAGE_LABELS: Record<Stage, string> = {
  input: "Input",
  commentator: "Commentator",
  comments: "Comments",
  descriptions: "Descriptions",
  entities: "Entities",
  images: "Images",
  audio: "Audio",
  transcription: "Transcription",
  video: "Video",
  download: "Download",
  split: "Split",
  clips: "Video Clips",
};

export function getStages(mode: FlowMode, consistency: boolean): Stage[] {
  if (mode === "video-story") {
    return [
      "input",
      "audio",
      "transcription",
      "split",
      ...(consistency ? ["entities" as Stage] : []),
      "descriptions",
      "images",
      "clips",
      "video",
      "download",
    ];
  }
  return (
    [
      "input",
      "commentator",
      "comments",
      ...(consistency ? ["entities" as Stage] : []),
      "descriptions",
      "images",
      "audio",
      "transcription",
      "video",
      "download",
    ] as Stage[]
  ).filter((s) => {
    if (s === "commentator" || s === "comments") return mode === "commentator";
    return true;
  });
}
