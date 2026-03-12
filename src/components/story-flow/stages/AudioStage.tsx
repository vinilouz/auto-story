"use client";

import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface AudioStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function AudioStage({ state, actions }: AudioStageProps) {
  const { audio } = state;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Audio</CardTitle>
          {audio.batches.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {audio.batches.filter((b) => b.status === "completed").length}/{audio.batches.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!audio.batches.length && !audio.isLoading ? (
          <p className="text-center py-8 text-muted-foreground">
            Click below to generate.
          </p>
        ) : audio.isLoading && !audio.batches.length ? (
          <div className="flex justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Generating...
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {audio.batches.map((b) => (
              <div
                key={b.index}
                className={cn(
                  "p-3 rounded border text-sm",
                  b.status === "error"
                    ? "bg-red-50/50 border-red-200"
                    : b.status === "completed"
                      ? "bg-green-50/30 border-green-200/50"
                      : "bg-muted/50",
                )}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-xs">
                    #{b.index + 1} — {b.status}
                  </span>
                  <div className="flex gap-1">
                    {b.status === "completed" && b.url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => new Audio(b.url!).play()}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={() => audio.regenerateBatch(b.index, actions.audioOpts())}
                      disabled={b.status === "generating"}
                    >
                      {b.status === "error" ? "Retry" : "Redo"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 border-l-2 pl-1">
                  {b.text}
                </p>
                {b.status === "completed" && b.url && (
                  <audio controls src={b.url} className="w-full h-8 mt-1" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
