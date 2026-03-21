import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { type ProjectData, StorageService } from "@/lib/storage";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const DATA_DIR = path.join(PUBLIC_DIR, "projects");

describe("StorageService", () => {
  const mockProject: ProjectData = {
    id: "test-project-id-1234",
    name: "Test Project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flowType: "simple",
    scriptText: "This is a test script.",
    segmentSize: 150,
    language: "english",
    style: "Anime Style",
    voice: "NarratorVoice1",
    consistency: true,
    entities: [
      { name: "John Doe", description: "A test entity", status: "pending" },
    ],
    segments: [{ text: "Scene 1" }, { text: "Scene 2" }],
    audioUrls: [],
    audioBatches: [],
    transcriptionResults: [],
  };

  afterAll(async () => {
    await StorageService.deleteProject(mockProject.id);
  });

  it("should save a project with all custom properties and reload them accurately", async () => {
    const savedId = await StorageService.saveProject(mockProject);

    expect(savedId).toBe(mockProject.id);

    const loadedProject = await StorageService.getProject(mockProject.id);

    expect(loadedProject).not.toBeNull();
    if (!loadedProject) return;

    expect(loadedProject.id).toBe(mockProject.id);
    expect(loadedProject.name).toBe(mockProject.name);
    expect(loadedProject.consistency).toBe(mockProject.consistency);
    expect(loadedProject.style).toBe(mockProject.style);
    expect(loadedProject.voice).toBe(mockProject.voice);
    expect(loadedProject.entities).toEqual(mockProject.entities);

    expect(loadedProject).toHaveProperty("consistency", true);
    expect(loadedProject).toHaveProperty("voice", "NarratorVoice1");
    expect(loadedProject).toHaveProperty("style", "Anime Style");
    expect(loadedProject.entities).toBeDefined();
    expect(loadedProject.entities?.length).toBe(1);
  });

  it("should extract base64 images to file system on save", async () => {
    const projectWithBase64: ProjectData = {
      ...mockProject,
      id: "test-project-id-5678",
      segments: [
        {
          text: "A simple scene",
          imagePrompt: "A simple scene",
          imagePath:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        },
      ],
    };

    await StorageService.saveProject(projectWithBase64);

    const loadedProject = await StorageService.getProject(projectWithBase64.id);
    expect(loadedProject).not.toBeNull();
    if (!loadedProject) return;

    const extractedUrl = loadedProject.segments?.[0]?.imagePath;
    expect(extractedUrl).not.toContain("data:image/");
    expect(extractedUrl).toMatch(/\/projects\/.*\/images\/img-\d+\.png/);

    const shortId = loadedProject.id.split("-")[0];
    const dirName = `test-project-${shortId}`;
    const dirs = await fs.readdir(DATA_DIR);
    const actualDir = dirs.find((d) => d.includes(shortId)) || dirName;
    const fileName = extractedUrl?.split("/").pop();
    const filepath = path.join(DATA_DIR, actualDir, "images", fileName ?? "");
    expect(existsSync(filepath)).toBe(true);

    await StorageService.deleteProject(projectWithBase64.id);
  });
});
