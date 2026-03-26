import { useState } from "react";
import type { Segment, TranscriptionResult } from "../types";

export function useDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadZip = async (payload: {
    segments: Segment[];
    audioUrls: string[];
    transcriptionResult: TranscriptionResult | null;
    filename?: string;
  }) => {
    setIsDownloading(true);
    try {
      const res = await fetch("/api/generate/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payload.filename || `story-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return { downloadZip, isDownloading };
}
