import { render, screen } from "@testing-library/react";
import { SplitStage } from "@/components/story-flow/stages/SplitStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { Segment } from "@/lib/flows/types";

type PartialState = Partial<StoryFlowState> &
  Pick<StoryFlowState, "segments" | "clipDuration">;

const createMockState = (
  overrides: Partial<PartialState> = {},
): StoryFlowState =>
  ({
    mode: "simple",
    stage: "split",
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
    captionStyle: {
      fontSize: 60,
      fontFamily: "TikTok Sans",
      fontWeight: 800,
      maxWordsPerLine: 3,
      uppercase: true,
      highlightColor: "#FFE81F",
    },
    setCaptionStyle: jest.fn(),
    videoVolume: 1,
    setVideoVolume: jest.fn(),
    loading: false,
    setLoading: jest.fn(),
    stages: ["split"],
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
  }) as StoryFlowState;

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

describe("SplitStage", () => {
  describe("empty state", () => {
    it("shows instruction message when no segments", () => {
      const state = createMockState({
        segments: [],
        clipDuration: 5,
      });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/click below to split/i)).toBeInTheDocument();
      expect(screen.getByText(/5s windows/i)).toBeInTheDocument();
    });

    it("shows clip duration in title", () => {
      const state = createMockState({
        segments: [],
        clipDuration: 8,
      });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/8s segments/i)).toBeInTheDocument();
    });
  });

  describe("with segments", () => {
    it("shows segment count in description", () => {
      const segments: Segment[] = [
        { text: "First segment" },
        { text: "Second segment" },
        { text: "Third segment" },
      ];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/3 segments created/i)).toBeInTheDocument();
    });

    it("displays each segment with text", () => {
      const segments: Segment[] = [
        { text: "First segment content" },
        { text: "Second segment content" },
      ];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("First segment content")).toBeInTheDocument();
      expect(screen.getByText("Second segment content")).toBeInTheDocument();
    });

    it("displays segment index numbers", () => {
      const segments: Segment[] = [{ text: "First" }, { text: "Second" }];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("#1")).toBeInTheDocument();
      expect(screen.getByText("#2")).toBeInTheDocument();
    });

    it("displays time range with startMs and endMs", () => {
      const segments: Segment[] = [
        { text: "First", startMs: 0, endMs: 5000 },
        { text: "Second", startMs: 5000, endMs: 10000 },
      ];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("0.0s — 5.0s")).toBeInTheDocument();
      expect(screen.getByText("5.0s — 10.0s")).toBeInTheDocument();
    });

    it("handles missing startMs/endMs with fallback to 0", () => {
      const segments: Segment[] = [{ text: "No timestamps" }];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("0.0s — 0.0s")).toBeInTheDocument();
    });

    it("handles partial timestamps", () => {
      const segments: Segment[] = [
        { text: "Partial", startMs: 3000 },
        { text: "Other", endMs: 8000 },
      ];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("3.0s — 0.0s")).toBeInTheDocument();
      expect(screen.getByText("0.0s — 8.0s")).toBeInTheDocument();
    });
  });

  describe("time formatting", () => {
    it("formats milliseconds to seconds with one decimal", () => {
      const segments: Segment[] = [
        { text: "Test", startMs: 1234, endMs: 5678 },
      ];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("1.2s — 5.7s")).toBeInTheDocument();
    });

    it("handles large millisecond values", () => {
      const segments: Segment[] = [
        { text: "Test", startMs: 60000, endMs: 125000 },
      ];
      const state = createMockState({ segments, clipDuration: 5 });
      render(<SplitStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("60.0s — 125.0s")).toBeInTheDocument();
    });
  });
});
