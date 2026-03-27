import { getProvider } from "@/lib/ai/registry";
import "@/lib/ai/providers/louzlabs";
import * as httpClient from "@/lib/ai/http-client";

// Mock the http-client before the tests run
jest.mock("@/lib/ai/http-client", () => ({
  apiRequest: jest.fn(),
  apiRequestRaw: jest.fn(),
  apiRequestSSE: jest.fn(),
  apiRequestMultipart: jest.fn(),
}));

describe("louzlabs provider", () => {
  const provider = getProvider("louzlabs");
  const creds = { baseUrl: "http://api", apiKey: "secret" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generateText should map to /v1/chat/completions", async () => {
    (httpClient.apiRequest as jest.Mock).mockResolvedValue({
      text: "response",
    });
    const res = await provider?.generateText!(
      "model",
      { prompt: "hello" },
      creds,
    );

    expect(httpClient.apiRequest).toHaveBeenCalledWith(
      "http://api/v1/chat/completions",
      "secret",
      { prompt: "hello", model: "model" },
      expect.objectContaining({ actionName: "generateText" }),
    );
    expect(res?.text).toBe("response");
  });

  it("generateImage should map to /v1/images/generations", async () => {
    (httpClient.apiRequest as jest.Mock).mockResolvedValue({ url: "img.png" });
    const res = await provider?.generateImage!(
      "model",
      { prompt: "draw me", referenceImages: ["ref.png"] },
      creds,
    );

    expect(httpClient.apiRequest).toHaveBeenCalledWith(
      "http://api/v1/images/generations",
      "secret",
      {
        prompt: "draw me",
        images: ["ref.png"],
        aspect_ratio: "16:9",
        size: "2K",
      },
      expect.any(Object),
    );
    expect(res?.imageUrl).toBe("img.png");
  });

  it("generateAudio should map to /v1/audio/speech", async () => {
    const buf = new ArrayBuffer(0);
    (httpClient.apiRequestRaw as jest.Mock).mockResolvedValue(buf);

    // Test ignores empty buffer check in mock to verify mapping
    Object.defineProperty(buf, "byteLength", { value: 10 });

    const res = await provider?.generateAudio!(
      "model",
      { text: "speak", voice: "v1" },
      creds,
    );

    expect(httpClient.apiRequestRaw).toHaveBeenCalledWith(
      "http://api/v1/audio/speech",
      "secret",
      { prompt: "speak", voice: "v1" },
      expect.any(Object),
    );
    expect(res?.audioBuffer).toBe(buf);
  });

  it("generateVideo should map to /v1/video/generations", async () => {
    (httpClient.apiRequest as jest.Mock).mockResolvedValue({ url: "vid.mp4" });
    await provider?.generateVideo!(
      "model",
      { prompt: "move", referenceImage: "ref.png" },
      creds,
    );

    expect(httpClient.apiRequest).toHaveBeenCalledWith(
      "http://api/v1/video/generations",
      "secret",
      { prompt: "move", images: ["ref.png"] },
      expect.any(Object),
    );
  });

  it("generateTranscription should map to /v1/audio/transcriptions", async () => {
    (httpClient.apiRequestMultipart as jest.Mock).mockResolvedValue({
      words: [{ text: "hi", startMs: 0, endMs: 500 }],
    });
    const res = await provider!.generateTranscription!(
      "model",
      { file: "http://audio.mp3" },
      creds,
    );

    expect(httpClient.apiRequestMultipart).toHaveBeenCalledWith(
      "http://api/v1/audio/transcriptions",
      "secret",
      "http://audio.mp3",
      expect.any(Object),
    );
    expect(res.words[0].text).toBe("hi");
  });
});
