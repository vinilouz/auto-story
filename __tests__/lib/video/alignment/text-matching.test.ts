import {
  levenshtein,
  normalize,
  isWordMatch,
} from "@/lib/video/alignment/text-matching";

describe("Text Matching Utils", () => {
  describe("normalize", () => {
    it("should remove punctuation and lowercase string", () => {
      expect(normalize("Hello, World!")).toBe("hello world");
      expect(normalize("Dr. Smith's cat-dog:")).toBe("dr smiths catdog");
    });
  });

  describe("levenshtein distance", () => {
    it("should calculate correct distance", () => {
      expect(levenshtein("kitten", "sitting")).toBe(3);
      expect(levenshtein("flitten", "flitten")).toBe(0);
      expect(levenshtein("", "abc")).toBe(3);
    });
  });

  describe("isWordMatch", () => {
    it("should match exact words", () => {
      expect(isWordMatch("hello", "hello")).toBe(true);
    });

    it("should match words ignoring case and punctuation", () => {
      expect(isWordMatch("Hello!", "hello,")).toBe(true);
    });

    it("should match with small typos if word is long enough", () => {
      expect(isWordMatch("beautiful", "beutiful")).toBe(true); // 1 typo in 9 chars
      expect(isWordMatch("car", "cat")).toBe(false); // 1 typo in 3 chars is too much
    });
  });
});
