"use client";

import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface TranscriptionStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function TranscriptionStage({ state }: TranscriptionStageProps) {
  const { transcription, audio, language } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcription (free proxy)</CardTitle>
      </CardHeader>
      <CardContent>
        {!transcription.results.length && !transcription.isLoading ? (
          <p className="text-center py-8 text-muted-foreground">
            Click "Transcribe" below.
          </p>
        ) : transcription.isLoading && !transcription.results.length ? (
          <div className="flex justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Finding proxies...
          </div>
        ) : (
          <div className="space-y-3">
            {audio.batches
              .filter((b) => b.status === "completed" && b.url)
              .map((b, i) => {
                const r = transcription.results.find((r) => r.url === b.url);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <span className="text-sm truncate max-w-[300px]">
                        {b.text.substring(0, 50)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r?.status === "completed" ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Done
                        </span>
                      ) : r?.status === "error" ? (
                        <>
                          <span className="text-xs text-red-600">
                            <X className="w-3 h-3 inline" />
                            Error
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6"
                            onClick={() => transcription.retry(b.url!, language)}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {transcription.isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : (
                            "Pending"
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
