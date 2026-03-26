import { generateSingleImage } from "@/lib/ai/processors/image-generator";
import { generateAndSaveVideoClip } from "@/lib/ai/processors/video-clip-generator";
import { execute } from "@/lib/ai/providers";

jest.mock("@/lib/ai/providers", () => ({ execute: jest.fn() }));
jest.mock("@/lib/storage", () => ({
  StorageService: { patchSegmentClip: jest.fn() },
}));
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe("processors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("image-generator should combine systemPrompt and pass referenceImages", async () => {
    (execute as jest.Mock).mockResolvedValue({ imageUrl: "output.png" });

    await generateSingleImage({
      imagePrompt: "A cat",
      systemPrompt: "Art style: Noir",
      referenceImage: "http://ref.png",
    });

    expect(execute).toHaveBeenCalledWith("generateImage", {
      prompt: "Art style: Noir\nA cat",
      referenceImages: ["http://ref.png"],
      config: undefined,
    });
  });

  it("video-clip-generator should pass duration and referenceImage", async () => {
    (execute as jest.Mock).mockResolvedValue({
      videoUrl: "data:video/mp4;base64,VklERU8=",
    });

    await generateAndSaveVideoClip(
      { prompt: "Zoom in", referenceImage: "img.png", duration: 6 },
      "p1",
      "proj1",
      0,
    );

    expect(execute).toHaveBeenCalledWith("generateVideo", {
      prompt: "Zoom in",
      referenceImage: "img.png",
      duration: 6,
    });
  });
});
