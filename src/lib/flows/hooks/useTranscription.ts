import { useCallback, useState } from "react";
import type { TranscriptionResult } from "../types";

export function useTranscription() {
  const [results, setResults] = useState<TranscriptionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const transcribe = async (projectId: string, projectName: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectName }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      const result: TranscriptionResult = {
        url: data.url,
        status: "completed",
        data: data.words,
      };
      setResults([result]);
      return [result];
    } finally {
      setIsLoading(false);
    }
  };

  const retry = useCallback(async (projectId: string, projectName: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectName }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      const result: TranscriptionResult = {
        url: data.url,
        status: "completed",
        data: data.words,
      };
      setResults([result]);
      return [result];
    } catch {
      setResults((prev) => [
        ...prev,
        { url: "", status: "error" as const, error: "Retry failed" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { results, setResults, transcribe, retry, isLoading };
}
