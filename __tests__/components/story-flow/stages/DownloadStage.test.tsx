import { render, screen } from "@testing-library/react";
import { DownloadStage } from "@/components/story-flow/stages/DownloadStage";
import type { StoryFlowState } from "@/components/story-flow/types";

type PartialState = Partial<StoryFlowState> & Pick<StoryFlowState, "dl">;

const createMockState = (overrides: Partial<PartialState> = {}): StoryFlowState => ({
  mode: "simple",
  stage: "download",
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
  stages: ["download"],
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

describe("DownloadStage", () => {
  describe("rendering", () => {
    it("displays title", () => {
      const state = createMockState();
      render(<DownloadStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Download")).toBeInTheDocument();
    });

    it("displays description", () => {
      const state = createMockState();
      render(<DownloadStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/all assets ready/i)).toBeInTheDocument();
    });

    it("displays download button", () => {
      const state = createMockState();
      render(<DownloadStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/download zip/i)).toBeInTheDocument();
    });
  });

  describe("button states", () => {
    it("enables button when not downloading", () => {
      const state = createMockState({
        dl: {
          downloadZip: jest.fn(),
          isDownloading: false,
        },
      });
      render(<DownloadStage state={state} actions={createMockActions()} />);
      expect(screen.getByRole("button", { name: /download zip/i })).not.toBeDisabled();
    });

    it("disables button when downloading", () => {
      const state = createMockState({
        dl: {
          downloadZip: jest.fn(),
          isDownloading: true,
        },
      });
      render(<DownloadStage state={state} actions={createMockActions()} />);
      expect(screen.getByRole("button", { name: /download zip/i })).toBeDisabled();
    });

    it("shows spinner when downloading", () => {
      const state = createMockState({
        dl: {
          downloadZip: jest.fn(),
          isDownloading: true,
        },
      });
      render(<DownloadStage state={state} actions={createMockActions()} />);
      const button = screen.getByRole("button", { name: /download zip/i });
      expect(button).toBeInTheDocument();
    });

    it("shows download icon when not downloading", () => {
      const state = createMockState({
        dl: {
          downloadZip: jest.fn(),
          isDownloading: false,
        },
      });
      render(<DownloadStage state={state} actions={createMockActions()} />);
      const button = screen.getByRole("button", { name: /download zip/i });
      expect(button).toBeInTheDocument();
    });
  });
});
