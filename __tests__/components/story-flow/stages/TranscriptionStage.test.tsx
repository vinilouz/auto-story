import { render, screen } from "@testing-library/react";
import { TranscriptionStage } from "@/components/story-flow/stages/TranscriptionStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { AudioBatch, TranscriptionResult } from "@/lib/flows/types";

type PartialState = Partial<StoryFlowState> &
  Pick<StoryFlowState, "transcription" | "audio" | "language">;

const createMockState = (
  overrides: Partial<PartialState> = {},
): StoryFlowState => {
  const transcriptionResults: TranscriptionResult[] = [];
  const audioBatches: AudioBatch[] = [];

  return {
    mode: "simple",
    stage: "transcription",
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
    stages: ["transcription"],
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
    transcription: {
      results: transcriptionResults,
      setResults: jest.fn(),
      transcribe: jest.fn(),
      retry: jest.fn(),
      isLoading: false,
    },
    audio: {
      batches: audioBatches,
      setBatches: jest.fn(),
      generate: jest.fn(),
      regenerateBatch: jest.fn(),
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

describe("TranscriptionStage", () => {
  describe("empty/loading states", () => {
    it("shows 'Click Transcribe' when no results and not loading", () => {
      const state = createMockState({
        transcription: {
          results: [],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: false,
        },
        audio: {
          batches: [],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(screen.getByText(/click.*transcribe/i)).toBeInTheDocument();
    });

    it("shows 'Finding proxies' when loading with no results", () => {
      const state = createMockState({
        transcription: {
          results: [],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: true,
        },
        audio: {
          batches: [],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(screen.getByText(/finding proxies/i)).toBeInTheDocument();
    });
  });

  describe("with audio batches", () => {
    it("shows list of completed batches with their transcription status", () => {
      const state = createMockState({
        transcription: {
          results: [
            {
              url: "http://audio1.mp3",
              status: "completed",
              data: { words: [] },
            },
            { url: "http://audio2.mp3", status: "error", error: "Failed" },
          ],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: false,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: "First batch of text here",
              status: "completed",
              url: "http://audio1.mp3",
            },
            {
              index: 1,
              text: "Second batch of text here",
              status: "completed",
              url: "http://audio2.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );

      expect(screen.getByText("Done")).toBeInTheDocument();
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText(/first batch of text/i)).toBeInTheDocument();
    });

    it("filters to only show completed batches with urls", () => {
      const state = createMockState({
        transcription: {
          results: [
            {
              url: "http://audio1.mp3",
              status: "completed",
              data: { words: [] },
            },
          ],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: false,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: "Completed batch",
              status: "completed",
              url: "http://audio1.mp3",
            },
            { index: 1, text: "Pending batch", status: "pending" },
            {
              index: 2,
              text: "Error batch",
              status: "error",
              url: "http://audio3.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );

      expect(screen.getByText(/completed batch/i)).toBeInTheDocument();
      expect(screen.queryByText(/pending batch/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/error batch/i)).not.toBeInTheDocument();
    });
  });

  describe("transcription result statuses", () => {
    it("shows 'Done' for completed transcription", () => {
      const state = createMockState({
        transcription: {
          results: [
            {
              url: "http://audio1.mp3",
              status: "completed",
              data: { words: [] },
            },
          ],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: false,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: "Test text",
              status: "completed",
              url: "http://audio1.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    it("shows 'Error' with retry button for failed transcription", () => {
      const retryMock = jest.fn();
      const state = createMockState({
        transcription: {
          results: [
            { url: "http://audio1.mp3", status: "error", error: "Failed" },
          ],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: retryMock,
          isLoading: false,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: "Test text",
              status: "completed",
              url: "http://audio1.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
        language: "english",
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "" })).toBeInTheDocument();
    });

    it("shows 'Pending' when no result exists and not loading", () => {
      const state = createMockState({
        transcription: {
          results: [{ url: "http://audio1.mp3", status: "pending" }],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: false,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: "Test text",
              status: "completed",
              url: "http://audio1.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(screen.getByText(/test text/i)).toBeInTheDocument();
    });

    it("shows spinner when loading and result pending", () => {
      const state = createMockState({
        transcription: {
          results: [{ url: "http://audio1.mp3", status: "pending" }],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: true,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: "Test text",
              status: "completed",
              url: "http://audio1.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(screen.getByText(/test text/i)).toBeInTheDocument();
    });
  });

  describe("batch display", () => {
    it("truncates long batch text", () => {
      const longText =
        "This is a very long text that should be truncated at fifty characters";
      const state = createMockState({
        transcription: {
          results: [
            {
              url: "http://audio1.mp3",
              status: "completed",
              data: { words: [] },
            },
          ],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: false,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: longText,
              status: "completed",
              url: "http://audio1.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(
        screen.getByText(/this is a very long text that should be trun/i),
      ).toBeInTheDocument();
    });

    it("shows batch index number", () => {
      const state = createMockState({
        transcription: {
          results: [
            {
              url: "http://audio1.mp3",
              status: "completed",
              data: { words: [] },
            },
          ],
          setResults: jest.fn(),
          transcribe: jest.fn(),
          retry: jest.fn(),
          isLoading: false,
        },
        audio: {
          batches: [
            {
              index: 0,
              text: "First",
              status: "completed",
              url: "http://audio1.mp3",
            },
            {
              index: 1,
              text: "Second",
              status: "completed",
              url: "http://audio2.mp3",
            },
          ],
          setBatches: jest.fn(),
          generate: jest.fn(),
          regenerateBatch: jest.fn(),
          isLoading: false,
        },
      });
      render(
        <TranscriptionStage state={state} actions={createMockActions()} />,
      );
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});
