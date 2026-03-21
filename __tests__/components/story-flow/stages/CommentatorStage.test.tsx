import { render, screen, fireEvent } from "@testing-library/react";
import { CommentatorStage } from "@/components/story-flow/stages/CommentatorStage";
import type { StoryFlowState } from "@/components/story-flow/types";

type PartialState = Partial<StoryFlowState> & Pick<StoryFlowState, "commName" | "setCommName" | "commPersonality" | "setCommPersonality" | "commImagePrompt" | "setCommImagePrompt" | "commImage" | "setCommImage" | "loading">;

const createMockState = (overrides: Partial<PartialState> = {}): StoryFlowState => ({
  mode: "commentator",
  stage: "commentator",
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
  stages: ["commentator"],
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

describe("CommentatorStage", () => {
  describe("form fields", () => {
    it("displays name input", () => {
      const state = createMockState();
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    });

    it("displays personality textarea", () => {
      const state = createMockState();
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByPlaceholderText(/personality/i)).toBeInTheDocument();
    });

    it("displays appearance textarea", () => {
      const state = createMockState();
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByPlaceholderText(/appearance/i)).toBeInTheDocument();
    });

    it("shows name value in input", () => {
      const state = createMockState({ commName: "John", setCommName: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    it("shows personality value in textarea", () => {
      const state = createMockState({ commPersonality: "Funny and witty", setCommPersonality: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByDisplayValue("Funny and witty")).toBeInTheDocument();
    });

    it("shows imagePrompt value in textarea", () => {
      const state = createMockState({ commImagePrompt: "A tall man", setCommImagePrompt: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByDisplayValue("A tall man")).toBeInTheDocument();
    });
  });

  describe("form interactions", () => {
    it("calls setCommName on name change", () => {
      const setCommNameMock = jest.fn();
      const state = createMockState({ setCommName: setCommNameMock });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Jane" } });
      expect(setCommNameMock).toHaveBeenCalledWith("Jane");
    });

    it("calls setCommPersonality on personality change", () => {
      const setCommPersonalityMock = jest.fn();
      const state = createMockState({ setCommPersonality: setCommPersonalityMock });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      fireEvent.change(screen.getByPlaceholderText(/personality/i), { target: { value: "Serious" } });
      expect(setCommPersonalityMock).toHaveBeenCalledWith("Serious");
    });

    it("calls setCommImagePrompt on imagePrompt change", () => {
      const setCommImagePromptMock = jest.fn();
      const state = createMockState({ setCommImagePrompt: setCommImagePromptMock });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      fireEvent.change(screen.getByPlaceholderText(/appearance/i), { target: { value: "Short hair" } });
      expect(setCommImagePromptMock).toHaveBeenCalledWith("Short hair");
    });
  });

  describe("generate button", () => {
    it("displays generate button", () => {
      const state = createMockState();
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate")).toBeInTheDocument();
    });

    it("disables button when loading", () => {
      const state = createMockState({ loading: true });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate")).toBeDisabled();
    });

    it("disables button when imagePrompt is empty", () => {
      const state = createMockState({ commImagePrompt: "", setCommImagePrompt: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate")).toBeDisabled();
    });

    it("enables button when imagePrompt has content", () => {
      const state = createMockState({ commImagePrompt: "A description", setCommImagePrompt: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate")).not.toBeDisabled();
    });

    it("disables button when imagePrompt is only whitespace", () => {
      const state = createMockState({ commImagePrompt: "   ", setCommImagePrompt: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate")).toBeDisabled();
    });

    it("shows spinner when loading", () => {
      const state = createMockState({ loading: true, commImagePrompt: "Test", setCommImagePrompt: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      const button = screen.getByText("Generate").closest("button");
      expect(button).toBeDisabled();
    });

    it("calls generateCommentatorImage when clicked", () => {
      const generateMock = jest.fn();
      const state = createMockState({ commImagePrompt: "A description", setCommImagePrompt: jest.fn() });
      const actions = { ...createMockActions(), generateCommentatorImage: generateMock };

      render(<CommentatorStage state={state} actions={actions} />);
      fireEvent.click(screen.getByText("Generate"));

      expect(generateMock).toHaveBeenCalled();
    });
  });

  describe("image display", () => {
    it("shows image when commImage exists", () => {
      const state = createMockState({ commImage: "http://image.jpg", setCommImage: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      const img = document.querySelector("img");
      expect(img).toHaveAttribute("src", "http://image.jpg");
    });

    it("shows upload area when no commImage", () => {
      const state = createMockState({ commImage: null, setCommImage: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Upload")).toBeInTheDocument();
    });

    it("has file input for upload", () => {
      const state = createMockState({ commImage: null, setCommImage: jest.fn() });
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByLabelText(/upload/i)).toBeInTheDocument();
    });
  });

  describe("title display", () => {
    it("displays card title", () => {
      const state = createMockState();
      render(<CommentatorStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Configure Commentator")).toBeInTheDocument();
    });
  });
});
