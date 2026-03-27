import {
  splitBySentences,
  splitTranscriptionByDuration,
} from "@/lib/utils/text";

// Mock fetch for getTranscription
global.fetch = jest.fn();

describe("Text Utils", () => {
  describe("splitBySentences", () => {
    it("should split cleanly by sentences after reaching min length", () => {
      const text = "First sentence. Second sentence.";
      const segments = splitBySentences(text, 10); // reaches 10, then breaks at next period
      expect(segments).toHaveLength(2);
      expect(segments[0]).toBe("First sentence.");
      expect(segments[1]).toBe("Second sentence.");
    });

    it("should not split if no punctuation exists after max length", () => {
      const text = "A very long sentence without any punctuation at all";
      const segments = splitBySentences(text, 15);
      // It looks forward for punctuation. None found => whole string.
      expect(segments).toHaveLength(1);
    });

    it("should not break at protected abbreviations", () => {
      const text = "O sr. João foi ao médico. E também a sra. Maria.";
      const segments = splitBySentences(text, 30);
      expect(segments[0]).toContain("O sr. João foi ao médico.");
      // The abbreviation "sr." shouldn't trigger a break inside the 30 limit
      // Actually "O sr. João foi ao médico." is 25 chars. It should fit entirely before breaking.
    });
  });

  describe("splitTranscriptionByDuration", () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockReset();
    });

    it("should split correctly into uniform segments based on time", async () => {
      // Mock fetch to return transcription words
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { text: "Hello", startMs: 0, endMs: 1000 },
          { text: "World", startMs: 1000, endMs: 2000 },
          { text: "Here", startMs: 6000, endMs: 7000 },
        ],
      });

      const transcriptionResults = [
        {
          url: "mock-url",
          status: "completed" as const,
          transcriptionUrl: "mock-transcription-url",
        },
      ];
      const audioBatches = [
        {
          index: 0,
          text: "Anything",
          status: "completed" as const,
          url: "mock-url",
        },
      ];
      const audioDurationsMs = [12000]; // 12 second total audio

      const result = await splitTranscriptionByDuration(
        transcriptionResults,
        audioBatches,
        5, // 5 seconds per clip
        audioDurationsMs,
      );

      // 12s total / 5s clips => ceil(12/5) = 3 clips
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("Hello World"); // 0-5s
      expect(result[1].text).toBe("Here"); // 5-10s
      expect(result[2].text).toBe("[Segment 3]"); // 10-12s (empty fallback)
    });
  });
});
