import { render, screen, fireEvent } from "@testing-library/react";
import { AudioStage } from "@/components/story-flow/stages/AudioStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { AudioBatch } from "@/lib/flows/types";

const createMockState = (batches: AudioBatch[] = [], isLoading = false): StoryFlowState => ({
  mode: "simple",
  stage: "audio",
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
  stages: ["audio"],
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
    batches,
    setBatches: jest.fn(),
    generate: jest.fn(),
    regenerateBatch: jest.fn(),
    isLoading,
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
} as StoryFlowState);

const createMockActions = () => ({
  save: jest.fn(),
  audioOpts: jest.fn().mockReturnValue({
    text: "test text",
    voice: "test-voice",
    systemPrompt: "",
    projectId: "test-project",
    projectName: "test",
  }),
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

describe("AudioStage", () => {
  describe("empty/loading states", () => {
    it("shows 'Click below to generate' when no batches and not loading", () => {
      const state = createMockState([], false);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/click below to generate/i)).toBeInTheDocument();
    });

    it("shows 'Generating...' when loading with no batches", () => {
      const state = createMockState([], true);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });
  });

  describe("batch status display", () => {
    it("shows completed count in header when batches exist", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "First", status: "completed", url: "http://audio1.mp3" },
        { index: 1, text: "Second", status: "generating" },
        { index: 2, text: "Third", status: "completed", url: "http://audio3.mp3" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });

    it("displays batch text for pending status", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Pending batch text here", status: "pending" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Pending batch text here")).toBeInTheDocument();
    });

    it("displays batch text for generating status", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Generating batch text", status: "generating" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generating batch text")).toBeInTheDocument();
    });

    it("displays batch text for completed status", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Completed batch text", status: "completed", url: "http://audio.mp3" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Completed batch text")).toBeInTheDocument();
    });

    it("displays batch text for error status", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Error batch text", status: "error", error: "Failed" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Error batch text")).toBeInTheDocument();
    });
  });

  describe("batch styling", () => {
    it("applies red styling for error batches", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Error batch", status: "error", error: "Failed" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      const container = screen.getByText("Error batch").closest("div");
      expect(container?.className).toMatch(/bg-red/i);
    });

    it("applies green styling for completed batches", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Completed batch", status: "completed", url: "http://audio.mp3" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      const container = screen.getByText("Completed batch").closest("div");
      expect(container?.className).toMatch(/bg-green/i);
    });
  });

  describe("batch actions", () => {
    it("shows Retry button for error batches", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Error batch", status: "error", error: "Failed" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("shows Redo button for completed batches", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Completed", status: "completed", url: "http://audio.mp3" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Redo")).toBeInTheDocument();
    });

    it("disables redo button when generating", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Generating", status: "generating" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      const button = screen.getByRole("button", { name: /redo|retry/i });
      expect(button).toBeDisabled();
    });
  });

  describe("audio controls", () => {
    it("renders audio element for completed batch with url", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Completed", status: "completed", url: "http://audio.mp3" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      const audio = document.querySelector("audio");
      expect(audio).toBeInTheDocument();
      expect(audio).toHaveAttribute("src", "http://audio.mp3");
    });

    it("does not render audio element for batches without url", () => {
      const batches: AudioBatch[] = [
        { index: 0, text: "Pending", status: "pending" },
      ];
      const state = createMockState(batches);
      render(<AudioStage state={state} actions={createMockActions()} />);
      const audio = document.querySelector("audio");
      expect(audio).not.toBeInTheDocument();
    });
  });

  describe("regenerate action", () => {
    it("calls regenerateBatch with correct options when button clicked", () => {
      const regenerateBatchMock = jest.fn();
      const audioOptsMock = jest.fn().mockReturnValue({
        text: "test text",
        voice: "test-voice",
        systemPrompt: "system",
        projectId: "proj-1",
        projectName: "Test Project",
      });
      const batches: AudioBatch[] = [
        { index: 0, text: "Completed", status: "completed", url: "http://audio.mp3" },
      ];
      const state = {
        ...createMockState(batches),
        audio: {
          ...createMockState(batches).audio,
          regenerateBatch: regenerateBatchMock,
        },
      };
      const actions = { ...createMockActions(), audioOpts: audioOptsMock };

      render(<AudioStage state={state} actions={actions} />);
      fireEvent.click(screen.getByText("Redo"));

      expect(regenerateBatchMock).toHaveBeenCalledWith(0, {
        text: "test text",
        voice: "test-voice",
        systemPrompt: "system",
        projectId: "proj-1",
        projectName: "Test Project",
      });
    });
  });
});
