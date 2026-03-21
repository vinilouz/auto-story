import { render, screen } from "@testing-library/react";
import { InputStage } from "@/components/story-flow/stages/InputStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { StoryFlowActions } from "@/components/story-flow/useStoryFlowActions";

type PartialState = Partial<StoryFlowState> & Pick<StoryFlowState, "mode" | "title" | "scriptText" | "segmentSize" | "language" | "imagePromptStyle" | "audioVoice" | "consistency" | "music" | "clipDuration" | "setTitle" | "setScriptText" | "setSegmentSize" | "setLanguage" | "setImagePromptStyle" | "setAudioVoice" | "setConsistency" | "setMusic">;

const createMockState = (overrides: Partial<PartialState> = {}): StoryFlowState => ({
  mode: "simple",
  stage: "input",
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
  stages: ["input"],
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

const createMockActions = (): StoryFlowActions => ({
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

describe("InputStage", () => {
  describe("mode variations", () => {
    it("renders with mode='simple'", () => {
      const state = createMockState({ mode: "simple" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Project Settings")).toBeInTheDocument();
      expect(screen.getByText(/segment size/i)).toBeInTheDocument();
      expect(screen.getByText(/character consistency/i)).toBeInTheDocument();
      expect(screen.getByText(/música/i)).toBeInTheDocument();
    });

    it("renders with mode='commentator'", () => {
      const state = createMockState({ mode: "commentator" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Project Settings")).toBeInTheDocument();
      expect(screen.getByText(/segment size/i)).toBeInTheDocument();
      expect(screen.queryByText(/character consistency/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/música/i)).not.toBeInTheDocument();
    });

    it("renders with mode='video-story'", () => {
      const state = createMockState({ mode: "video-story", clipDuration: 6 });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/video models/i)).toBeInTheDocument();
      expect(screen.getByText(/6s segments/i)).toBeInTheDocument();
      expect(screen.queryByText(/segment size/i)).not.toBeInTheDocument();
      expect(screen.getByText(/character consistency/i)).toBeInTheDocument();
      expect(screen.getByText(/música/i)).toBeInTheDocument();
    });
  });

  describe("form fields", () => {
    it("renders title input with value", () => {
      const state = createMockState({ title: "My Story" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByDisplayValue("My Story")).toBeInTheDocument();
    });

    it("renders script textarea with value", () => {
      const state = createMockState({ scriptText: "Once upon a time..." });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByDisplayValue("Once upon a time...")).toBeInTheDocument();
    });

    it("renders segment size slider with value", () => {
      const state = createMockState({ mode: "simple", segmentSize: [350] });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/350 chars/i)).toBeInTheDocument();
    });

    it("renders language select with value", () => {
      const state = createMockState({ language: "portuguese" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Portuguese")).toBeInTheDocument();
    });

    it("renders image style textarea with value", () => {
      const state = createMockState({ imagePromptStyle: "Cinematic style" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByDisplayValue("Cinematic style")).toBeInTheDocument();
    });

    it("renders consistency switch checked when true", () => {
      const state = createMockState({ mode: "simple", consistency: true, music: false });
      render(<InputStage state={state} actions={createMockActions()} />);
      const switches = screen.getAllByRole("switch");
      const consistencySwitch = switches.find((s) => s.getAttribute("data-state") === "checked");
      expect(consistencySwitch).toBeDefined();
    });

    it("renders consistency switch unchecked when false", () => {
      const state = createMockState({ mode: "simple", consistency: false, music: false });
      render(<InputStage state={state} actions={createMockActions()} />);
      const switches = screen.getAllByRole("switch");
      expect(switches.length).toBe(2);
      switches.forEach((s) => {
        expect(s).not.toBeChecked();
      });
    });

    it("renders music switch checked when true", () => {
      const state = createMockState({ mode: "simple", music: true, consistency: false });
      render(<InputStage state={state} actions={createMockActions()} />);
      const switches = screen.getAllByRole("switch");
      const musicSwitch = switches.find((s) => s.getAttribute("data-state") === "checked");
      expect(musicSwitch).toBeDefined();
    });
  });

  describe("conditional rendering", () => {
    it("shows segment size slider for simple mode", () => {
      const state = createMockState({ mode: "simple" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/segment size/i)).toBeInTheDocument();
    });

    it("hides segment size slider for video-story mode", () => {
      const state = createMockState({ mode: "video-story" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText(/segment size/i)).not.toBeInTheDocument();
    });

    it("shows video models info for video-story mode", () => {
      const state = createMockState({ mode: "video-story", clipDuration: 8 });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/video models/i)).toBeInTheDocument();
      expect(screen.getByText(/8s/i)).toBeInTheDocument();
    });

    it("hides video models info for simple mode", () => {
      const state = createMockState({ mode: "simple" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText(/video models/i)).not.toBeInTheDocument();
    });

    it("shows consistency switch for simple mode", () => {
      const state = createMockState({ mode: "simple" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/character consistency/i)).toBeInTheDocument();
    });

    it("shows consistency switch for video-story mode", () => {
      const state = createMockState({ mode: "video-story" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/character consistency/i)).toBeInTheDocument();
    });

    it("hides consistency switch for commentator mode", () => {
      const state = createMockState({ mode: "commentator" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText(/character consistency/i)).not.toBeInTheDocument();
    });

    it("shows music switch for simple mode", () => {
      const state = createMockState({ mode: "simple" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/música/i)).toBeInTheDocument();
    });

    it("shows music switch for video-story mode", () => {
      const state = createMockState({ mode: "video-story" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/música/i)).toBeInTheDocument();
    });

    it("hides music switch for commentator mode", () => {
      const state = createMockState({ mode: "commentator" });
      render(<InputStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText(/música/i)).not.toBeInTheDocument();
    });
  });
});
