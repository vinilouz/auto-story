"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface ImagesStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function ImagesStage({ state, actions }: ImagesStageProps) {
  const { segments, imageStatuses } = state;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Images</span>
        <span className="font-mono bg-muted px-2 py-0.5 rounded">
          {segments.filter((s) => s.imagePath).length}/{segments.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {segments
          .filter((s) => s.imagePrompt)
          .map((seg, i) => {
            const realIdx = segments.indexOf(seg);
            const st = imageStatuses.get(realIdx);
            return (
              <Card key={i}>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-xs font-bold">
                      #{realIdx + 1}
                    </span>
                    {seg.imagePath && st !== "generating" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => actions.generateSingleImage(realIdx)}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground italic line-clamp-2">
                    {seg.imagePrompt}
                  </p>
                  {seg.imagePath && st !== "generating" ? (
                    <div className="relative group">
                      <img
                        src={seg.imagePath}
                        alt=""
                        loading="lazy"
                        className="w-full rounded"
                      />
                    </div>
                  ) : st === "generating" ? (
                    <Skeleton className="w-full h-48" />
                  ) : st === "error" ? (
                    <div className="h-48 bg-muted rounded flex flex-col items-center justify-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Error
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => actions.generateSingleImage(realIdx)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="h-48 bg-muted/40 rounded flex items-center justify-center border border-dashed text-muted-foreground/50 text-sm">
                      Waiting...
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
