import { useCallback, useState } from "react";
import type { TranscriptionResult } from "../types";

export function useTranscription() {
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const transcribe = async (projectId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Request failed with status ${res.status}`,
        );
      }
      const data = await res.json();
      const newResult: TranscriptionResult = {
        url: data.url,
        status: "completed",
        data: data.words,
      };
      setResult(newResult);
      return newResult;
    } finally {
      setIsLoading(false);
    }
  };

  const retry = useCallback(async (projectId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Request failed with status ${res.status}`,
        );
      }
      const data = await res.json();
      const newResult: TranscriptionResult = {
        url: data.url,
        status: "completed",
        data: data.words,
      };
      setResult(newResult);
      return newResult;
    } catch {
      setResult((prev) => ({
        url: prev?.url || "",
        status: "error",
        error: "Retry failed",
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { result, setResult, transcribe, retry, isLoading };
}
