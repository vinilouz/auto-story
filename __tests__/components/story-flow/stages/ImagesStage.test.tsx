import { render, screen, fireEvent } from "@testing-library/react";
import { ImagesStage } from "@/components/story-flow/stages/ImagesStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { Segment } from "@/lib/flows/types";

type PartialState = Partial<StoryFlowState> &
  Pick<StoryFlowState, "segments" | "imageStatuses">;

const createMockState = (
  overrides: Partial<PartialState> = {},
): StoryFlowState =>
  ({
    mode: "simple",
    stage: "images",
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
    stages: ["images"],
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

describe("ImagesStage", () => {
  describe("counter display", () => {
    it("shows correct count of images with path", () => {
      const segments: Segment[] = [
        {
          text: "First",
          imagePrompt: "Prompt 1",
          imagePath: "http://img1.jpg",
        },
        { text: "Second", imagePrompt: "Prompt 2" },
        {
          text: "Third",
          imagePrompt: "Prompt 3",
          imagePath: "http://img3.jpg",
        },
      ];
      const state = createMockState({ segments, imageStatuses: new Map() });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });

    it("shows 0/N when no images generated", () => {
      const segments: Segment[] = [
        { text: "First", imagePrompt: "Prompt 1" },
        { text: "Second", imagePrompt: "Prompt 2" },
      ];
      const state = createMockState({ segments, imageStatuses: new Map() });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("0/2")).toBeInTheDocument();
    });
  });

  describe("segment filtering", () => {
    it("only shows segments with imagePrompt", () => {
      const segments: Segment[] = [
        { text: "With prompt", imagePrompt: "A landscape" },
        { text: "Without prompt" },
        { text: "Also with prompt", imagePrompt: "A portrait" },
      ];
      const state = createMockState({ segments, imageStatuses: new Map() });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("A landscape")).toBeInTheDocument();
      expect(screen.getByText("A portrait")).toBeInTheDocument();
      expect(screen.queryByText("Without prompt")).not.toBeInTheDocument();
    });
  });

  describe("image status rendering", () => {
    it("shows image when imagePath exists and not generating", () => {
      const segments: Segment[] = [
        {
          text: "Scene",
          imagePrompt: "A landscape",
          imagePath: "http://image.jpg",
        },
      ];
      const state = createMockState({ segments, imageStatuses: new Map() });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      const img = document.querySelector("img");
      expect(img).toHaveAttribute("src", "http://image.jpg");
    });

    it("shows skeleton when status is generating", () => {
      const segments: Segment[] = [
        { text: "Scene", imagePrompt: "A landscape" },
      ];
      const imageStatuses = new Map<number, "generating" | "error">();
      imageStatuses.set(0, "generating");
      const state = createMockState({ segments, imageStatuses });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(
        document.querySelector("[class*='skeleton']") ||
          document.querySelector("[class*='animate']"),
      ).toBeTruthy();
    });

    it("shows error state with retry button when status is error", () => {
      const segments: Segment[] = [
        { text: "Scene", imagePrompt: "A landscape" },
      ];
      const imageStatuses = new Map<number, "generating" | "error">();
      imageStatuses.set(0, "error");
      const state = createMockState({ segments, imageStatuses });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("shows 'Waiting...' when no image and no status", () => {
      const segments: Segment[] = [
        { text: "Scene", imagePrompt: "A landscape" },
      ];
      const state = createMockState({ segments, imageStatuses: new Map() });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Waiting...")).toBeInTheDocument();
    });
  });

  describe("segment index display", () => {
    it("shows correct index for filtered segments", () => {
      const segments: Segment[] = [
        { text: "No prompt" },
        { text: "Scene 2", imagePrompt: "Prompt 2" },
        { text: "No prompt 2" },
        { text: "Scene 4", imagePrompt: "Prompt 4" },
      ];
      const state = createMockState({ segments, imageStatuses: new Map() });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("#2")).toBeInTheDocument();
      expect(screen.getByText("#4")).toBeInTheDocument();
    });
  });

  describe("retry action", () => {
    it("calls generateSingleImage with correct index on error retry", () => {
      const generateSingleImageMock = jest.fn();
      const segments: Segment[] = [
        { text: "Scene", imagePrompt: "A landscape" },
      ];
      const imageStatuses = new Map<number, "generating" | "error">();
      imageStatuses.set(0, "error");
      const state = createMockState({ segments, imageStatuses });
      const actions = {
        ...createMockActions(),
        generateSingleImage: generateSingleImageMock,
      };

      render(<ImagesStage state={state} actions={actions} />);
      fireEvent.click(screen.getByText("Retry"));

      expect(generateSingleImageMock).toHaveBeenCalledWith(0);
    });
  });

  describe("prompt display", () => {
    it("displays imagePrompt truncated", () => {
      const longPrompt =
        "This is a very long prompt that should be truncated because it exceeds the line clamp limit";
      const segments: Segment[] = [
        {
          text: "Scene",
          imagePrompt: longPrompt,
          imagePath: "http://image.jpg",
        },
      ];
      const state = createMockState({ segments, imageStatuses: new Map() });
      render(<ImagesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(longPrompt)).toBeInTheDocument();
    });
  });
});
