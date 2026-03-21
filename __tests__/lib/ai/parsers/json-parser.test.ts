import { extractJsonArray, parseJsonArray } from "@/lib/ai/parsers/json-parser";

describe("JSON Parser", () => {
  describe("extractJsonArray", () => {
    it("should extract array from code fences", () => {
      const raw = 'Here is the result:\n```json\n[{"text": "val"}]\n```';
      expect(extractJsonArray(raw)).toBe('[{"text": "val"}]');
    });

    it("should recover truncated json arrays", () => {
      const raw = '[{"name": "A"}, {"name": "B"'; // truncated
      expect(extractJsonArray(raw)).toBe('[{"name": "A"}, {"name": "B"}]');
    });

    it("should extract from plain text without fences", () => {
      const raw = 'Random text [{"val": 1}] more text';
      expect(extractJsonArray(raw)).toBe('[{"val": 1}]');
    });

    it("should wrap single objects in an array", () => {
      const raw = '```json\n{"text": "val"}\n```';
      expect(extractJsonArray(raw)).toBe('[{"text": "val"}]');
    });
  });

  describe("parseJsonArray", () => {
    it("should parse an array correctly", () => {
      const result = parseJsonArray<{id: number}>('[{"id": 1}, {"id": 2}]');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
    });

    it("should throw if unexpected count", () => {
      expect(() => parseJsonArray('[{"id": 1}]', 2)).toThrow(/Expected 2 items, got 1/);
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseJsonArray('Not json')).toThrow(/Failed to parse JSON/);
    });
  });
});
