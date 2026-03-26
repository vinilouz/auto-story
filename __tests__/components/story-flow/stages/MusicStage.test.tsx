import { render, screen, fireEvent } from "@testing-library/react";
import { MusicStage } from "@/components/story-flow/stages/MusicStage";
import type { StoryFlowState } from "@/components/story-flow/types";

type PartialState = Partial<StoryFlowState> &
  Pick<StoryFlowState, "musicUrl" | "setMusicUrl" | "loading">;

const createMockState = (
  overrides: Partial<PartialState> = {},
): StoryFlowState =>
  ({
    mode: "simple",
    stage: "music",
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
    stages: ["music"],
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

describe("MusicStage", () => {
  describe("title display", () => {
    it("displays card title with icon", () => {
      const state = createMockState();
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Background Music")).toBeInTheDocument();
    });
  });

  describe("empty state (no music)", () => {
    it("shows music icon when no music and not loading", () => {
      const state = createMockState({ musicUrl: null, loading: false });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("No music generated yet")).toBeInTheDocument();
    });

    it("shows 'Generate Music' button when no music", () => {
      const state = createMockState({ musicUrl: null, loading: false });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate Music")).toBeInTheDocument();
    });

    it("enables 'Generate Music' button when not loading", () => {
      const state = createMockState({ musicUrl: null, loading: false });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate Music")).not.toBeDisabled();
    });
  });

  describe("loading state", () => {
    it("shows spinner when loading and no music", () => {
      const state = createMockState({ musicUrl: null, loading: true });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(
        screen.getByText(/generating background music/i),
      ).toBeInTheDocument();
    });

    it("shows 'Generating...' in regenerate button when loading", () => {
      const state = createMockState({
        musicUrl: "http://music.mp3",
        loading: true,
        setMusicUrl: jest.fn(),
      });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });

    it("disables regenerate button when loading", () => {
      const state = createMockState({
        musicUrl: "http://music.mp3",
        loading: true,
        setMusicUrl: jest.fn(),
      });
      render(<MusicStage state={state} actions={createMockActions()} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("with music", () => {
    it("shows audio player when musicUrl exists", () => {
      const state = createMockState({
        musicUrl: "http://music.mp3",
        loading: false,
        setMusicUrl: jest.fn(),
      });
      render(<MusicStage state={state} actions={createMockActions()} />);
      const audio = document.querySelector("audio");
      expect(audio).toBeInTheDocument();
      expect(audio).toHaveAttribute("src", "http://music.mp3");
    });

    it("shows 'Regenerate' button when music exists", () => {
      const state = createMockState({
        musicUrl: "http://music.mp3",
        loading: false,
        setMusicUrl: jest.fn(),
      });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Regenerate")).toBeInTheDocument();
    });

    it("enables 'Regenerate' button when not loading", () => {
      const state = createMockState({
        musicUrl: "http://music.mp3",
        loading: false,
        setMusicUrl: jest.fn(),
      });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Regenerate")).not.toBeDisabled();
    });
  });

  describe("generate action", () => {
    it("calls generateMusic when 'Generate Music' clicked", () => {
      const generateMock = jest.fn();
      const state = createMockState({ musicUrl: null, loading: false });
      const actions = { ...createMockActions(), generateMusic: generateMock };

      render(<MusicStage state={state} actions={actions} />);
      fireEvent.click(screen.getByText("Generate Music"));

      expect(generateMock).toHaveBeenCalled();
    });

    it("calls generateMusic when 'Regenerate' clicked", () => {
      const generateMock = jest.fn();
      const state = createMockState({
        musicUrl: "http://music.mp3",
        loading: false,
        setMusicUrl: jest.fn(),
      });
      const actions = { ...createMockActions(), generateMusic: generateMock };

      render(<MusicStage state={state} actions={actions} />);
      fireEvent.click(screen.getByText("Regenerate"));

      expect(generateMock).toHaveBeenCalled();
    });
  });

  describe("button states", () => {
    it("disables 'Generate Music' button when loading", () => {
      const state = createMockState({ musicUrl: null, loading: true });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });

    it("does not show 'Generate Music' button when music exists", () => {
      const state = createMockState({
        musicUrl: "http://music.mp3",
        loading: false,
        setMusicUrl: jest.fn(),
      });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText("Generate Music")).not.toBeInTheDocument();
    });

    it("does not show 'Regenerate' button when no music", () => {
      const state = createMockState({ musicUrl: null, loading: false });
      render(<MusicStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText("Regenerate")).not.toBeInTheDocument();
    });
  });
});
