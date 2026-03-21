import { render, screen } from "@testing-library/react";
import { CommentsStage } from "@/components/story-flow/stages/CommentsStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { Segment } from "@/lib/flows/types";

type PartialState = Partial<StoryFlowState> & Pick<StoryFlowState, "segments" | "commentator" | "hasComments">;

const createMockState = (overrides: Partial<PartialState> = {}): StoryFlowState => ({
  mode: "commentator",
  stage: "comments",
  setStage: jest.fn(),
  projectId: "test-project",
  title: "",
  setTitle: jest.fn(),
  scriptText: "",
  setScriptText: jest.fn(),
  segmentSize: [200],
  setSegmentSize: jest.fn(),
  language: "english",
  setLanguage: jest.fn(),
  imagePromptStyle: "",
  setImagePromptStyle: jest.fn(),
  audioVoice: "default-voice",
  setAudioVoice: jest.fn(),
  consistency: false,
  setConsistency: jest.fn(),
  music: false,
  setMusic: jest.fn(),
  musicUrl: null,
  setMusicUrl: jest.fn(),
  commentator: null,
  setCommentator: jest.fn(),
  commName: "",
  setCommName: jest.fn(),
  commPersonality: "",
  setCommPersonality: jest.fn(),
  commImagePrompt: "",
  setCommImagePrompt: jest.fn(),
  commImage: null,
  setCommImage: jest.fn(),
  audioSystemPrompt: "",
  setAudioSystemPrompt: jest.fn(),
  segments: [],
  setSegments: jest.fn(),
  entities: [],
  setEntities: jest.fn(),
  imageStatuses: new Map(),
  setImageStatuses: jest.fn(),
  captionStyle: { fontSize: 60, fontFamily: "TikTok Sans", fontWeight: 800, maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F" },
  setCaptionStyle: jest.fn(),
  videoVolume: 1,
  setVideoVolume: jest.fn(),
  loading: false,
  setLoading: jest.fn(),
  stages: ["comments"],
  stageIdx: 0,
  maxStep: 0,
  hasPrompts: false,
  hasImages: false,
  hasClips: false,
  hasMusic: false,
  hasComments: false,
  hasAudio: false,
  hasTranscription: false,
  clipDuration: 5,
  audio: {
    batches: [],
    setBatches: jest.fn(),
    generate: jest.fn(),
    regenerateBatch: jest.fn(),
    isLoading: false,
  },
  transcription: {
    results: [],
    setResults: jest.fn(),
    transcribe: jest.fn(),
    retry: jest.fn(),
    isLoading: false,
  },
  videoClips: {
    clipStatuses: new Map(),
    generateAll: jest.fn(),
    regenerateClip: jest.fn(),
    isLoading: false,
  },
  video: {
    videoProps: null,
    setVideoProps: jest.fn(),
    generate: jest.fn(),
    render: jest.fn(),
    isGenerating: false,
    isRendering: false,
    renderProgress: null,
  },
  project: {
    projectId: "test-project",
    setProjectId: jest.fn(),
    load: jest.fn(),
    save: jest.fn(),
    isSaving: false,
  },
  dl: {
    downloadZip: jest.fn(),
    isDownloading: false,
  },
  ...overrides,
} as StoryFlowState);

const createMockActions = () => ({
  save: jest.fn(),
  audioOpts: jest.fn(),
  splitScenes: jest.fn(),
  saveCommentator: jest.fn(),
  generateComments: jest.fn(),
  generateDescriptions: jest.fn(),
  generateMissingDescriptions: jest.fn(),
  extractAndGenerateEntities: jest.fn(),
  generateEntities: jest.fn(),
  generateSingleEntity: jest.fn(),
  generateSingleImage: jest.fn(),
  generateAllImages: jest.fn(),
  generateAudioAction: jest.fn(),
  transcribeAction: jest.fn(),
  splitByDuration: jest.fn(),
  generateAllClips: jest.fn(),
  generateVideoPreview: jest.fn(),
  renderVideoAction: jest.fn(),
  downloadZipAction: jest.fn(),
  updateSegmentImagePrompt: jest.fn(),
  generateMusic: jest.fn(),
  generateCommentatorImage: jest.fn(),
});

describe("CommentsStage", () => {
  describe("empty state", () => {
    it("shows 'Click below to generate' when hasComments is false", () => {
      const state = createMockState({
        hasComments: false,
        segments: [],
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/click below to generate/i)).toBeInTheDocument();
    });
  });

  describe("with segments", () => {
    it("filters segments to only show those with type", () => {
      const segments: Segment[] = [
        { text: "Narrator text", type: "scene_text" },
        { text: "Comment text", type: "comment" },
        { text: "No type text" },
      ];
      const state = createMockState({
        hasComments: true,
        segments,
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Narrator text")).toBeInTheDocument();
      expect(screen.getByText("Comment text")).toBeInTheDocument();
      expect(screen.queryByText("No type text")).not.toBeInTheDocument();
    });
  });

  describe("segment types", () => {
    it("displays scene_text segments with default styling", () => {
      const segments: Segment[] = [
        { text: "Scene text here", type: "scene_text" },
      ];
      const state = createMockState({
        hasComments: true,
        segments,
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);
      const element = screen.getByText("Scene text here");
      expect(element.className).not.toMatch(/bg-blue/i);
    });

    it("displays comment segments with blue styling", () => {
      const segments: Segment[] = [
        { text: "Comment text here", type: "comment" },
      ];
      const state = createMockState({
        hasComments: true,
        segments,
        commentator: null,
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);
      const container = screen.getByText("Comment text here").closest("div");
      expect(container?.className).toMatch(/bg-blue/i);
    });

    it("shows commentator image for comment segments when available", () => {
      const segments: Segment[] = [
        { text: "Comment with image", type: "comment" },
      ];
      const state = createMockState({
        hasComments: true,
        segments,
        commentator: {
          id: "1",
          name: "John",
          personality: "Funny",
          appearance: {
            type: "generated",
            imageUrl: "http://commentator.jpg",
          },
        },
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);
      const img = document.querySelector("img");
      expect(img).toHaveAttribute("src", "http://commentator.jpg");
    });

    it("does not show commentator image when not available", () => {
      const segments: Segment[] = [
        { text: "Comment without image", type: "comment" },
      ];
      const state = createMockState({
        hasComments: true,
        segments,
        commentator: {
          id: "1",
          name: "John",
          personality: "Funny",
          appearance: {
            type: "generated",
          },
        },
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("does not show image for scene_text segments", () => {
      const segments: Segment[] = [
        { text: "Scene text", type: "scene_text" },
      ];
      const state = createMockState({
        hasComments: true,
        segments,
        commentator: {
          id: "1",
          name: "John",
          personality: "Funny",
          appearance: {
            type: "generated",
            imageUrl: "http://commentator.jpg",
          },
        },
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("mixed content", () => {
    it("displays multiple segment types correctly", () => {
      const segments: Segment[] = [
        { text: "First scene", type: "scene_text" },
        { text: "First comment", type: "comment" },
        { text: "Second scene", type: "scene_text" },
        { text: "Second comment", type: "comment" },
      ];
      const state = createMockState({
        hasComments: true,
        segments,
        commentator: {
          id: "1",
          name: "Commentator",
          personality: "Witty",
          appearance: { type: "upload" },
        },
      });
      render(<CommentsStage state={state} actions={createMockActions()} />);

      expect(screen.getByText("First scene")).toBeInTheDocument();
      expect(screen.getByText("First comment")).toBeInTheDocument();
      expect(screen.getByText("Second scene")).toBeInTheDocument();
      expect(screen.getByText("Second comment")).toBeInTheDocument();
    });
  });
});
