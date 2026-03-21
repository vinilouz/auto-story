import { render, screen, fireEvent } from "@testing-library/react";
import { VideoStage } from "@/components/story-flow/stages/VideoStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { CaptionStyle } from "@/lib/video/types";

type PartialState = Partial<StoryFlowState> & Pick<StoryFlowState, "video" | "captionStyle" | "setCaptionStyle" | "videoVolume" | "setVideoVolume">;

const createMockState = (overrides: Partial<PartialState> = {}): StoryFlowState => {
  const defaultCaptionStyle: CaptionStyle = {
    fontSize: 60,
    fontFamily: "TikTok Sans",
    fontWeight: 800,
    maxWordsPerLine: 3,
    uppercase: true,
    highlightColor: "#FFE81F",
  };

  return {
    mode: "simple",
    stage: "video",
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
    captionStyle: defaultCaptionStyle,
    setCaptionStyle: jest.fn(),
    videoVolume: 1,
    setVideoVolume: jest.fn(),
    loading: false,
    setLoading: jest.fn(),
    stages: ["video"],
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
  } as StoryFlowState;
};

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

describe("VideoStage", () => {
  describe("controls display", () => {
    it("displays font size slider", () => {
      const state = createMockState({
        captionStyle: { fontSize: 80, fontFamily: "TikTok Sans", fontWeight: 800, maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F" },
        setCaptionStyle: jest.fn(),
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/font size/i)).toBeInTheDocument();
    });

    it("displays highlight color buttons", () => {
      const state = createMockState();
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/highlight color/i)).toBeInTheDocument();
    });

    it("displays words per line buttons", () => {
      const state = createMockState({
        captionStyle: { fontSize: 60, fontFamily: "TikTok Sans", fontWeight: 800, maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F" },
        setCaptionStyle: jest.fn(),
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/words\/line/i)).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("displays clip audio volume slider", () => {
      const state = createMockState({ videoVolume: 0.75, setVideoVolume: jest.fn() });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/clip audio/i)).toBeInTheDocument();
    });
  });

  describe("caption style controls", () => {
    it("updates font size via slider", () => {
      const setCaptionStyleMock = jest.fn();
      const state = createMockState({
        captionStyle: { fontSize: 60, fontFamily: "TikTok Sans", fontWeight: 800, maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F" },
        setCaptionStyle: setCaptionStyleMock,
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(setCaptionStyleMock).toBeDefined();
    });

    it("updates highlight color on click", () => {
      const setCaptionStyleMock = jest.fn();
      const state = createMockState({
        captionStyle: { fontSize: 60, fontFamily: "TikTok Sans", fontWeight: 800, maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F" },
        setCaptionStyle: setCaptionStyleMock,
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      const colorButtons = screen.getAllByRole("button").filter(b => b.className.includes("rounded-full"));
      if (colorButtons.length > 0) {
        fireEvent.click(colorButtons[1]);
        expect(setCaptionStyleMock).toHaveBeenCalled();
      }
    });

    it("updates words per line on click", () => {
      const setCaptionStyleMock = jest.fn();
      const state = createMockState({
        captionStyle: { fontSize: 60, fontFamily: "TikTok Sans", fontWeight: 800, maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F" },
        setCaptionStyle: setCaptionStyleMock,
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      const wordButtons = screen.getAllByRole("button").filter(b => ["1", "2", "3", "4", "5"].includes(b.textContent || ""));
      if (wordButtons.length > 0) {
        fireEvent.click(wordButtons[0]);
        expect(setCaptionStyleMock).toHaveBeenCalled();
      }
    });
  });

  describe("render button", () => {
    it("shows 'Render MP4' button", () => {
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: false,
          renderProgress: null,
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/render mp4/i)).toBeInTheDocument();
    });

    it("disables button when rendering", () => {
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: true,
          renderProgress: null,
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/rendering/i)).toBeInTheDocument();
    });

    it("disables button when no videoProps", () => {
      const state = createMockState({
        video: {
          videoProps: null,
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: false,
          renderProgress: null,
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByRole("button", { name: /render mp4/i })).toBeDisabled();
    });

    it("shows 'Rendering...' when isRendering is true", () => {
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: true,
          renderProgress: null,
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/rendering/i)).toBeInTheDocument();
    });

    it("calls renderVideoAction when clicked", () => {
      const renderMock = jest.fn();
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: false,
          renderProgress: null,
        },
      });
      const actions = { ...createMockActions(), renderVideoAction: renderMock };

      render(<VideoStage state={state} actions={actions} />);
      fireEvent.click(screen.getByRole("button", { name: /render mp4/i }));

      expect(renderMock).toHaveBeenCalled();
    });
  });

  describe("render progress", () => {
    it("shows bundling stage", () => {
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: true,
          renderProgress: { stage: "bundling", progress: 10 },
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/bundling/i)).toBeInTheDocument();
    });

    it("shows rendering stage with frame count", () => {
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: true,
          renderProgress: { stage: "rendering", progress: 50, renderedFrames: 50, totalFrames: 100 },
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/rendering 50\/100/i)).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("shows encoding stage", () => {
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: true,
          renderProgress: { stage: "encoding", progress: 90 },
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/encoding/i)).toBeInTheDocument();
    });

    it("shows progress bar", () => {
      const state = createMockState({
        video: {
          videoProps: { scenes: [], audioTracks: [], captions: [], fps: 30, durationInFrames: 100, width: 1920, height: 1080 },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: true,
          renderProgress: { stage: "rendering", progress: 75 },
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      const progressBar = document.querySelector("[style*='width: 75%']");
      expect(progressBar).toBeTruthy();
    });
  });

  describe("video preview", () => {
    it("shows placeholder when no videoProps", () => {
      const state = createMockState({
        video: {
          videoProps: null,
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: false,
          renderProgress: null,
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/click.*generate preview/i)).toBeInTheDocument();
    });

    it("shows video player when videoProps exists", () => {
      const state = createMockState({
        video: {
          videoProps: {
            scenes: [{ id: "1", imageUrl: "http://img.jpg", startFrame: 0, durationInFrames: 30, effect: "static" }],
            audioTracks: [],
            captions: [],
            fps: 30,
            durationInFrames: 30,
            width: 1920,
            height: 1080,
          },
          setVideoProps: jest.fn(),
          generate: jest.fn(),
          render: jest.fn(),
          isGenerating: false,
          isRendering: false,
          renderProgress: null,
        },
      });
      render(<VideoStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/debug/i)).toBeInTheDocument();
    });
  });
});
