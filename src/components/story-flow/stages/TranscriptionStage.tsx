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
  const { transcription, project, projectId } = state;
  const result = transcription.result;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcription (free proxy)</CardTitle>
      </CardHeader>
      <CardContent>
        {!result && !transcription.isLoading ? (
          <p className="text-center py-8 text-muted-foreground">
            Click "Transcribe" below.
          </p>
        ) : transcription.isLoading && !result ? (
          <div className="flex justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Finding proxies...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded border">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <span className="text-sm truncate">
                  Full Audio Transcription
                </span>
              </div>
              <div className="flex items-center gap-2">
                {result?.status === "completed" ? (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Done
                  </span>
                ) : result?.status === "error" ? (
                  <>
                    <span className="text-xs text-red-600">
                      <X className="w-3 h-3 inline" />
                      Error
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6"
                      onClick={() =>
                        transcription.retry(project.projectId || projectId)
                      }
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
