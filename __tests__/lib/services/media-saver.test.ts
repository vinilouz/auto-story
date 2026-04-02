import path from "node:path";
import { saveAudio, saveVideoClip, saveMusic } from "@/lib/services/media-saver";

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock("@/lib/storage", () => ({
  StorageService: {
    patchSegmentClip: jest.fn().mockResolvedValue(undefined),
    patchMusic: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

const { writeFileSync, existsSync, mkdirSync } = require("fs");
const { StorageService } = require("@/lib/storage");

describe("media-saver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (existsSync as jest.Mock).mockReturnValue(true);
  });

  describe("saveAudio", () => {
    it("writes buffer to correct path and returns public URL", async () => {
      const buffer = new ArrayBuffer(8);
      const result = await saveAudio(buffer, "proj1", 0);

      expect(writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "public", "projects", "proj1", "audios", "audio_1.mp3"),
        expect.any(Buffer),
      );
      expect(result).toBe("/projects/proj1/audios/audio_1.mp3");
    });

    it("creates directory if it does not exist", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const buffer = new ArrayBuffer(4);
      await saveAudio(buffer, "proj2", 3);

      expect(mkdirSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "public", "projects", "proj2", "audios"),
        { recursive: true },
      );
      expect(writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "public", "projects", "proj2", "audios", "audio_4.mp3"),
        expect.any(Buffer),
      );
    });
  });

  describe("saveVideoClip", () => {
    it("decodes base64 data URL, writes file, and patches config", async () => {
      const dataUrl = "data:video/mp4;base64,VklERU8=";
      const result = await saveVideoClip(dataUrl, "proj1", 0);

      expect(writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "public", "projects", "proj1", "clips", "clip-1.mp4"),
        expect.any(Buffer),
      );
      expect(StorageService.patchSegmentClip).toHaveBeenCalledWith(
        "proj1",
        0,
        "/projects/proj1/clips/clip-1.mp4",
      );
      expect(result).toBe("/projects/proj1/clips/clip-1.mp4");
    });

    it("creates clips directory if it does not exist", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      await saveVideoClip("data:video/mp4;base64,AA==", "proj1", 2);

      expect(mkdirSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "public", "projects", "proj1", "clips"),
        { recursive: true },
      );
    });
  });

  describe("saveMusic", () => {
    it("decodes base64 data URL, writes file, and patches config", async () => {
      const dataUrl = "data:audio/mp4;base64,AQID";
      const result = await saveMusic(dataUrl, "proj1");

      expect(writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "public", "projects", "proj1", "music", "background.mp4"),
        expect.any(Buffer),
      );
      expect(StorageService.patchMusic).toHaveBeenCalledWith(
        "proj1",
        "/projects/proj1/music/background.mp4",
      );
      expect(result).toBe("/projects/proj1/music/background.mp4");
    });

    it("creates music directory if it does not exist", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      await saveMusic("data:audio/mp4;base64,AA==", "proj1");

      expect(mkdirSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "public", "projects", "proj1", "music"),
        { recursive: true },
      );
    });
  });
});
