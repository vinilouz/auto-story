import {
  apiRequest,
  apiRequestRaw,
  apiRequestSSE,
  saveDebugLog,
} from "@/lib/ai/http-client";

jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("fs", () => ({ writeFileSync: jest.fn(), existsSync: jest.fn() }));

describe("http-client", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("apiRequest", () => {
    it("should return JSON on success", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: "hello" }),
      });

      const res = await apiRequest("http://api/v1", "key", { prompt: "test" });
      expect(res).toEqual({ text: "hello" });
      expect(global.fetch).toHaveBeenCalledWith(
        "http://api/v1",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer key",
          },
          body: JSON.stringify({ prompt: "test" }),
        }),
      );
    });

    it("should throw HTTP error if !res.ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad request",
      });

      await expect(apiRequest("http://api/v1", "key", {})).rejects.toThrow(
        /HTTP 400: Bad request/,
      );
    });
  });

  describe("apiRequestRaw", () => {
    it("should return ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(8);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buffer,
      });

      const res = await apiRequestRaw("http://api", "key", {});
      expect(res).toBe(buffer);
    });
  });

  describe("apiRequestSSE", () => {
    it("should return the Response stream without reading it", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: "stream data",
      });

      const res = await apiRequestSSE("http://api", "key", {});
      expect(res.body).toBe("stream data");
    });
  });
});
