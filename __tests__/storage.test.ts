import { StorageService, ProjectData } from '@/lib/storage';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Change storage location for tests so we don't mess up real data
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'projects');

describe('StorageService', () => {
  const mockProject: ProjectData = {
    id: 'test-project-id-1234',
    name: 'Test Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flowType: 'simple',
    scriptText: 'This is a test script.',
    segmentSize: 150,
    language: 'english',
    style: 'Anime Style',
    voice: 'NarratorVoice1',
    consistency: true,
    entities: [
      { name: 'John Doe', description: 'A test entity', status: 'pending' }
    ],
    segments: ['Scene 1', 'Scene 2'],
    visualDescriptions: [],
    audioUrls: [],
    audioBatches: [],
    transcriptionResults: []
  };

  afterAll(async () => {
    // Cleanup the test project directory
    await StorageService.deleteProject(mockProject.id);
  });

  it('should save a project with all custom properties and reload them accurately', async () => {
    // 1. Save Project
    const savedId = await StorageService.saveProject(mockProject);

    expect(savedId).toBe(mockProject.id);

    // 2. Fetch Project Back
    const loadedProject = await StorageService.getProject(mockProject.id);

    // 3. Verify it exists
    expect(loadedProject).not.toBeNull();
    if (!loadedProject) return;

    // 4. Assert all specific fields survived the serialization roundtrip
    expect(loadedProject.id).toBe(mockProject.id);
    expect(loadedProject.name).toBe(mockProject.name);
    expect(loadedProject.consistency).toBe(mockProject.consistency);
    expect(loadedProject.style).toBe(mockProject.style);
    expect(loadedProject.voice).toBe(mockProject.voice);
    expect(loadedProject.entities).toEqual(mockProject.entities);

    // Assert strictly on fields that cause regressions
    expect(loadedProject).toHaveProperty('consistency', true);
    expect(loadedProject).toHaveProperty('voice', 'NarratorVoice1');
    expect(loadedProject).toHaveProperty('style', 'Anime Style');
    expect(loadedProject.entities).toBeDefined();
    expect(loadedProject.entities?.length).toBe(1);
  });

  it('should extract base64 images to file system on save', async () => {
    const projectWithBase64: ProjectData = {
      ...mockProject,
      id: 'test-project-id-5678',
      visualDescriptions: [
        {
          imagePrompt: 'A simple scene',
          status: 'completed',
          imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        }
      ]
    };

    await StorageService.saveProject(projectWithBase64);

    const loadedProject = await StorageService.getProject(projectWithBase64.id);
    expect(loadedProject).not.toBeNull();
    if (!loadedProject) return;

    // Assert that the base64 payload was extracted to a path
    const extractedUrl = loadedProject.visualDescriptions?.[0].imageUrl;
    expect(extractedUrl).not.toContain('data:image/');
    expect(extractedUrl).toMatch(/\/projects\/test-project-test\/images\/scene-0-\d+\.png/);

    // Check if file actually exists
    const shortId = loadedProject.id.split('-')[0];
    const filepath = path.join(DATA_DIR, `test-project-${shortId}`, 'images', extractedUrl!.split('/').pop()!);
    expect(existsSync(filepath)).toBe(true);

    // Cleanup
    await StorageService.deleteProject(projectWithBase64.id);
  });
});
