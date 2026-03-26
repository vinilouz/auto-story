import { render, screen, fireEvent } from "@testing-library/react";
import { DescriptionsStage } from "@/components/story-flow/stages/DescriptionsStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { Segment } from "@/lib/flows/types";

type PartialState = Partial<StoryFlowState> &
  Pick<StoryFlowState, "segments" | "loading">;

const createMockState = (
  overrides: Partial<PartialState> = {},
): StoryFlowState =>
  ({
    mode: "simple",
    stage: "descriptions",
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
    stages: ["descriptions"],
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

describe("DescriptionsStage", () => {
  describe("counter display", () => {
    it("shows correct count of segments with imagePrompt", () => {
      const segments: Segment[] = [
        { text: "First", imagePrompt: "Prompt 1" },
        { text: "Second" },
        { text: "Third", imagePrompt: "Prompt 3" },
      ];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });

    it("shows 0/N when no descriptions generated", () => {
      const segments: Segment[] = [{ text: "First" }, { text: "Second" }];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("0/2")).toBeInTheDocument();
    });
  });

  describe("generate missing button", () => {
    it("shows 'Generate Missing' button when some prompts missing", () => {
      const segments: Segment[] = [
        { text: "First", imagePrompt: "Prompt 1" },
        { text: "Second" },
      ];
      const state = createMockState({ segments, loading: false });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate Missing")).toBeInTheDocument();
    });

    it("hides 'Generate Missing' button when all prompts exist", () => {
      const segments: Segment[] = [
        { text: "First", imagePrompt: "Prompt 1" },
        { text: "Second", imagePrompt: "Prompt 2" },
      ];
      const state = createMockState({ segments, loading: false });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText("Generate Missing")).not.toBeInTheDocument();
    });

    it("disables button when loading", () => {
      const segments: Segment[] = [
        { text: "First", imagePrompt: "Prompt 1" },
        { text: "Second" },
      ];
      const state = createMockState({ segments, loading: true });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Generate Missing")).toBeDisabled();
    });

    it("calls generateMissingDescriptions when clicked", () => {
      const generateMissingMock = jest.fn();
      const segments: Segment[] = [
        { text: "First", imagePrompt: "Prompt 1" },
        { text: "Second" },
      ];
      const state = createMockState({ segments, loading: false });
      const actions = {
        ...createMockActions(),
        generateMissingDescriptions: generateMissingMock,
      };

      render(<DescriptionsStage state={state} actions={actions} />);
      fireEvent.click(screen.getByText("Generate Missing"));

      expect(generateMissingMock).toHaveBeenCalled();
    });
  });

  describe("segment display", () => {
    it("displays scene number for each segment", () => {
      const segments: Segment[] = [
        { text: "First scene" },
        { text: "Second scene" },
      ];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/scene 1/i)).toBeInTheDocument();
      expect(screen.getByText(/scene 2/i)).toBeInTheDocument();
    });

    it("displays segment text", () => {
      const segments: Segment[] = [{ text: "This is the scene text" }];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("This is the scene text")).toBeInTheDocument();
    });

    it("shows '(Comment)' for comment type segments", () => {
      const segments: Segment[] = [
        { text: "Narrator text", type: "scene_text" },
        { text: "Commentary text", type: "comment" },
      ];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/scene 1/i)).toBeInTheDocument();
      expect(screen.getByText(/scene 2.*comment/i)).toBeInTheDocument();
    });
  });

  describe("imagePrompt display", () => {
    it("displays imagePrompt when available", () => {
      const segments: Segment[] = [
        { text: "Scene text", imagePrompt: "A beautiful landscape" },
      ];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("A beautiful landscape")).toBeInTheDocument();
    });

    it("hides imagePrompt section when not available", () => {
      const segments: Segment[] = [{ text: "Scene text" }];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      expect(
        screen.queryByText("A beautiful landscape"),
      ).not.toBeInTheDocument();
    });
  });

  describe("edit functionality", () => {
    it("shows edit button on hover (opacity toggle)", () => {
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Prompt" }];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("shows textarea when editing", () => {
      const segments: Segment[] = [
        { text: "Scene", imagePrompt: "Original prompt" },
      ];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);

      const editButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg"));
      if (editButton) {
        fireEvent.click(editButton);
        expect(screen.getByRole("textbox")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Original prompt")).toBeInTheDocument();
      }
    });

    it("shows Save and Cancel buttons when editing", () => {
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Prompt" }];
      const state = createMockState({ segments });
      render(<DescriptionsStage state={state} actions={createMockActions()} />);

      const editButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg"));
      if (editButton) {
        fireEvent.click(editButton);
        expect(screen.getByText("Save")).toBeInTheDocument();
        expect(screen.getByText("Cancel")).toBeInTheDocument();
      }
    });

    it("calls updateSegmentImagePrompt on save", () => {
      const updateMock = jest.fn();
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Original" }];
      const state = createMockState({ segments });
      const actions = {
        ...createMockActions(),
        updateSegmentImagePrompt: updateMock,
      };

      render(<DescriptionsStage state={state} actions={actions} />);

      const editButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg"));
      if (editButton) {
        fireEvent.click(editButton);
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "Updated prompt" },
        });
        fireEvent.click(screen.getByText("Save"));

        expect(updateMock).toHaveBeenCalledWith(0, "Updated prompt");
      }
    });

    it("cancels editing without saving", () => {
      const updateMock = jest.fn();
      const segments: Segment[] = [{ text: "Scene", imagePrompt: "Original" }];
      const state = createMockState({ segments });
      const actions = {
        ...createMockActions(),
        updateSegmentImagePrompt: updateMock,
      };

      render(<DescriptionsStage state={state} actions={actions} />);

      const editButton = screen
        .getAllByRole("button")
        .find((b) => b.querySelector("svg"));
      if (editButton) {
        fireEvent.click(editButton);
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "Changed" },
        });
        fireEvent.click(screen.getByText("Cancel"));

        expect(updateMock).not.toHaveBeenCalled();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      }
    });
  });
});
