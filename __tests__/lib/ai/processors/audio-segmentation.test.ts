import { splitTextIntoBatches } from "@/lib/ai/utils/text-splitter";

describe("Audio Segmentation", () => {
  it("should not split text shorter than max length", () => {
    const text = "Short text.";
    const segments = splitTextIntoBatches(text, 100);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toBe(text);
  });

  it("should split text at sentence boundaries", () => {
    const text = "First sentence. Second sentence.";
    // Force split between sentences by setting max length small enough
    const segments = splitTextIntoBatches(text, 20);
    // "First sentence." is 15 chars. " Second sentence." is 16 chars.
    // If max is 20, it should take "First sentence."

    expect(segments).toHaveLength(2);
    expect(segments[0]).toBe("First sentence.");
    expect(segments[1]).toBe("Second sentence.");
  });

  it("should split at commas if no sentence boundary found", () => {
    const text = "First part, second part.";
    const segments = splitTextIntoBatches(text, 15);
    // "First part," is 11 chars

    expect(segments).toHaveLength(2);
    expect(segments[0]).toBe("First part,");
    expect(segments[1]).toBe("second part.");
  });

  it("should fallback to space split if no punctuation", () => {
    const text = "Word1 Word2 Word3";
    const segments = splitTextIntoBatches(text, 10);

    // Let's trace:
    // searchWindow = "Word1 Word" (10 chars)
    // lastSpace = 5
    // splitIndex = 5
    // "Word2 Word3" is 11 chars, so it should be split again.
    console.log("Segments:", segments);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toBe("Word1");
    expect(segments[1]).toBe("Word2");
    expect(segments[2]).toBe("Word3");
  });

  it("should handle long text with multiple splits", () => {
    const text =
      "A".repeat(40) + ". " + "B".repeat(40) + ". " + "C".repeat(40) + ".";
    const segments = splitTextIntoBatches(text, 50);

    expect(segments.length).toBeGreaterThan(2);
    segments.forEach((seg: string) => {
      expect(seg.length).toBeLessThanOrEqual(50);
    });
  });
});
