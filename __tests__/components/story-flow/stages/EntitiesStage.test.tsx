import { render, screen, fireEvent } from "@testing-library/react";
import { EntitiesStage } from "@/components/story-flow/stages/EntitiesStage";
import type { StoryFlowState } from "@/components/story-flow/types";
import type { EntityAsset } from "@/lib/flows/types";

type PartialState = Partial<StoryFlowState> &
  Pick<StoryFlowState, "entities" | "loading">;

const createMockState = (
  overrides: Partial<PartialState> = {},
): StoryFlowState =>
  ({
    mode: "simple",
    stage: "entities",
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
    stages: ["entities"],
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

describe("EntitiesStage", () => {
  describe("entity list display", () => {
    it("displays entity names as badges", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", status: "pending" },
        { name: "Villain", status: "pending" },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Hero")).toBeInTheDocument();
      expect(screen.getByText("Villain")).toBeInTheDocument();
    });

    it("displays empty list when no entities", () => {
      const state = createMockState({ entities: [] });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Entities")).toBeInTheDocument();
    });
  });

  describe("entity cards", () => {
    it("shows cards only when entities have description or imageUrl", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", description: "The main character", status: "pending" },
        { name: "Extra", status: "pending" },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("The main character")).toBeInTheDocument();
    });

    it("hides cards when no entity has description or imageUrl", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", status: "pending" },
        { name: "Extra", status: "pending" },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText("description")).not.toBeInTheDocument();
    });

    it("shows card when entity has imageUrl", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", imageUrl: "http://hero.jpg", status: "completed" },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByRole("img")).toBeInTheDocument();
    });
  });

  describe("entity status", () => {
    it("shows 'Pending' when no imageUrl and not generating", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", description: "Main", status: "pending" },
      ];
      const state = createMockState({ entities, loading: false });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("shows spinner when status is generating", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", description: "Main character", status: "generating" },
      ];
      const state = createMockState({ entities, loading: false });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getAllByText("Hero").length).toBeGreaterThan(0);
      expect(screen.getByText("Main character")).toBeInTheDocument();
    });

    it("shows spinner when loading is true", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", description: "Main character", status: "pending" },
      ];
      const state = createMockState({ entities, loading: true });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getAllByText("Hero").length).toBeGreaterThan(0);
      expect(screen.getByText("Main character")).toBeInTheDocument();
    });

    it("shows image when imageUrl exists", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", imageUrl: "http://hero.jpg", status: "completed" },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "http://hero.jpg");
      expect(img).toHaveAttribute("alt", "Hero");
    });
  });

  describe("entity details", () => {
    it("displays entity name in card", () => {
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "Main character",
          status: "completed",
          imageUrl: "http://hero.jpg",
        },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByRole("heading", { name: "Hero" })).toBeInTheDocument();
    });

    it("displays entity description when available", () => {
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "The brave protagonist",
          status: "completed",
          imageUrl: "http://hero.jpg",
        },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText("The brave protagonist")).toBeInTheDocument();
    });

    it("hides description when not available", () => {
      const entities: EntityAsset[] = [
        { name: "Hero", status: "completed", imageUrl: "http://hero.jpg" },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText(/protagonist/i)).not.toBeInTheDocument();
    });

    it("displays segment numbers when available", () => {
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "Main",
          segment: [1, 3, 5],
          status: "completed",
          imageUrl: "http://hero.jpg",
        },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByText(/segments: 1, 3, 5/i)).toBeInTheDocument();
    });

    it("hides segment numbers when not available", () => {
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "Main",
          status: "completed",
          imageUrl: "http://hero.jpg",
        },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText(/segments/i)).not.toBeInTheDocument();
    });

    it("hides segment numbers when empty array", () => {
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "Main",
          segment: [],
          status: "completed",
          imageUrl: "http://hero.jpg",
        },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.queryByText(/segments/i)).not.toBeInTheDocument();
    });
  });

  describe("regenerate action", () => {
    it("shows regenerate button when entity has imageUrl", () => {
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "Main",
          imageUrl: "http://hero.jpg",
          status: "completed",
        },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("disables button when status is generating", () => {
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "Main",
          imageUrl: "http://hero.jpg",
          status: "generating",
        },
      ];
      const state = createMockState({ entities });
      render(<EntitiesStage state={state} actions={createMockActions()} />);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("calls generateSingleEntity with correct index", () => {
      const generateSingleEntityMock = jest.fn();
      const entities: EntityAsset[] = [
        {
          name: "Hero",
          description: "Main",
          imageUrl: "http://hero.jpg",
          status: "completed",
        },
        {
          name: "Villain",
          description: "Bad guy",
          imageUrl: "http://villain.jpg",
          status: "completed",
        },
      ];
      const state = createMockState({ entities });
      const actions = {
        ...createMockActions(),
        generateSingleEntity: generateSingleEntityMock,
      };

      render(<EntitiesStage state={state} actions={actions} />);
      fireEvent.click(screen.getAllByRole("button")[1]);

      expect(generateSingleEntityMock).toHaveBeenCalledWith(1);
    });
  });
});
