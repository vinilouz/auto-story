import { useCallback, useState } from "react";
import type { AudioBatch, TranscriptionResult } from "../types";

export function useTranscription() {
  const [results, setResults] = useState<TranscriptionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const transcribe = async (audioBatches: AudioBatch[], language: string) => {
    const urls = audioBatches
      .filter((b) => b.status === "completed" && b.url)
      .map((b) => b.url!);
    if (!urls.length) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrls: urls,
          language: language === "english" ? "en" : "pt",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      let updatedResults: TranscriptionResult[] = [];
      setResults((prev) => {
        const map = new Map(prev.map((r) => [r.url, r]));
        data.results.forEach((r: TranscriptionResult) => map.set(r.url, r));
        updatedResults = Array.from(map.values());
        return updatedResults;
      });
      return updatedResults;
    } finally {
      setIsLoading(false);
    }
  };

  const retry = useCallback(async (url: string, language: string) => {
    setResults((prev) => prev.filter((r) => r.url !== url));
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrls: [url],
          language: language === "english" ? "en" : "pt",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      let updatedResults: TranscriptionResult[] = [];
      if (data.results?.[0]) {
        setResults((prev) => {
          updatedResults = [
            ...prev.filter((r) => r.url !== url),
            data.results[0],
          ];
          return updatedResults;
        });
      }
      return updatedResults;
    } catch {
      setResults((prev) => [
        ...prev,
        { url, status: "error" as const, error: "Retry failed" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { results, setResults, transcribe, retry, isLoading };
}
