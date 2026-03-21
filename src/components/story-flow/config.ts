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
  music: "Música",
};

export function getStages(mode: FlowMode, consistency: boolean, music: boolean): Stage[] {
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
      ...(music ? ["music" as Stage] : []),
      "video",
      "download",
    ];
  }
  return (
    [
      "input",
      ...(music ? ["music" as Stage] : []),
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
