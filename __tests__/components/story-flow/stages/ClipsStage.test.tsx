import { render, screen } from "@testing-library/react";
import { ClipsStage } from "@/components/story-flow/stages/ClipsStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { Segment } from "@/lib/flows/types";

type PartialState = Partial<StoryFlowState> &
  Pick<
    StoryFlowState,
    | "segments"
    | "videoClips"
    | "clipDuration"
    | "project"
    | "projectId"
    | "title"
  >;

const createMockState = (
  overrides: Partial<PartialState> = {},
): StoryFlowState => {
  const clipStatuses = new Map<number, "generating" | "error" | "completed">();

  return {
    mode: "video-story",
    stage: "clips",
    setStage: jest.fn(),
    projectId: "test-project",
    title: "Test Project",
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
    stages: ["clips"],
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
      clipStatuses,
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
  } as StoryFlowState;
};

const createMockActions = () => ({
  save: jest.fn().mockResolvedValue({}),
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

describe("ClipsStage", () => {
  describe("counter display", () => {
    it("shows correct count of clips with videoClipUrl", () => {
      const segments: Segment[] = [
        {
          text: "First",
          imagePrompt: "Prompt 1",
          videoClipUrl: "http://clip1.mp4",
        },
        { text: "Second", imagePrompt: "Prompt 2" },
        {
          text: "Third",
          imagePrompt: "Prompt 3",
          videoClipUrl: "http://clip3.mp4",
        },
      ];
      const state = createMockState({ segments });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });
  });

  describe("segment filtering", () => {
    it("only shows segments with imagePrompt", () => {
      const segments: Segment[] = [
        { text: "With prompt", imagePrompt: "A landscape" },
        { text: "Without prompt" },
      ];
      const state = createMockState({ segments });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("A landscape")).toBeInTheDocument();
      expect(screen.queryByText("Without prompt")).not.toBeInTheDocument();
    });
  });

  describe("clip duration display", () => {
    it("shows clip duration in seconds", () => {
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Prompt" }];
      const state = createMockState({ segments, clipDuration: 6 });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("6s")).toBeInTheDocument();
    });
  });

  describe("clip status rendering", () => {
    it("shows video player when videoClipUrl exists and not generating", () => {
      const segments: Segment[] = [
        {
          text: "Scene",
          imagePrompt: "Prompt",
          videoClipUrl: "http://clip.mp4",
        },
      ];
      const state = createMockState({ segments });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/clip #1/i)).toBeInTheDocument();
    });

    it("shows generating state when status is generating", () => {
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Prompt" }];
      const clipStatuses = new Map<
        number,
        "generating" | "error" | "completed"
      >();
      clipStatuses.set(0, "generating");
      const state = createMockState({
        segments,
        videoClips: {
          clipStatuses,
          generateAll: jest.fn(),
          regenerateClip: jest.fn(),
          isLoading: false,
        },
      });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });

    it("shows error state with retry button when status is error", () => {
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Prompt" }];
      const clipStatuses = new Map<
        number,
        "generating" | "error" | "completed"
      >();
      clipStatuses.set(0, "error");
      const state = createMockState({
        segments,
        videoClips: {
          clipStatuses,
          generateAll: jest.fn(),
          regenerateClip: jest.fn(),
          isLoading: false,
        },
      });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("shows 'Waiting...' when no clip and no status", () => {
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Prompt" }];
      const state = createMockState({ segments });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Waiting...")).toBeInTheDocument();
    });
  });

  describe("clip index display", () => {
    it("shows correct clip number", () => {
      const segments: Segment[] = [
        { text: "Scene 1", imagePrompt: "Prompt 1" },
        { text: "Scene 2", imagePrompt: "Prompt 2" },
      ];
      const state = createMockState({ segments });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Clip #1")).toBeInTheDocument();
      expect(screen.getByText("Clip #2")).toBeInTheDocument();
    });
  });

  describe("prompt display", () => {
    it("displays imagePrompt for each clip", () => {
      const segments: Segment[] = [
        { text: "Scene", imagePrompt: "A beautiful sunset over the ocean" },
      ];
      const state = createMockState({ segments });
      render(<ClipsStage state={state} actions={createMockActions()} />);
      expect(
        screen.getByText("A beautiful sunset over the ocean"),
      ).toBeInTheDocument();
    });
  });
});
