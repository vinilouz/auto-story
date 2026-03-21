import { useCallback, useState } from "react";
import type { AudioBatch } from "../types";

export function useAudio() {
  const [batches, setBatches] = useState<AudioBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generate = async (opts: {
    text: string;
    voice?: string;
    systemPrompt?: string;
    projectId: string;
    projectName: string;
    targetBatchIndices?: number[];
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      if (!res.ok) throw new Error("Audio generation failed");
      const data = await res.json();
      if (data.batches) setBatches(data.batches);
      return data.batches as AudioBatch[];
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateBatch = useCallback(
    async (index: number, opts: Parameters<typeof generate>[0]) => {
      setBatches((prev) => {
        const exists = prev.find((b) => b.index === index);
        return exists
          ? prev.map((b) =>
            b.index === index ? { ...b, status: "generating" as const } : b,
          )
          : [...prev, { index, text: "", status: "generating" as const }];
      });
      try {
        const res = await fetch("/api/generate/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...opts, targetBatchIndices: [index] }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const updated = data.batches?.find(
          (b: AudioBatch) => b.index === index,
        );
        if (updated)
          setBatches((prev) =>
            prev.map((b) => (b.index === index ? updated : b)),
          );
      } catch {
        setBatches((prev) =>
          prev.map((b) =>
            b.index === index ? { ...b, status: "error" as const } : b,
          ),
        );
      }
    },
    [],
  );

  return { batches, setBatches, generate, regenerateBatch, isLoading };
}
