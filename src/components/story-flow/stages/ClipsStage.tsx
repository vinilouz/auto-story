"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface ClipsStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function ClipsStage({ state, actions }: ClipsStageProps) {
  const { segments, videoClips, clipDuration, project, projectId, title } = state;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Clips</span>
        <span className="font-mono bg-muted px-2 py-0.5 rounded">
          {segments.filter((s) => s.videoClipUrl).length}/{segments.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {segments
          .filter((s) => s.imagePrompt)
          .map((seg, i) => {
            const st = videoClips.clipStatuses.get(i);
            return (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-xs font-bold">Clip #{i + 1}</span>
                    <span className="text-xs text-muted-foreground">{clipDuration}s</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic line-clamp-2">
                    {seg.imagePrompt}
                  </p>
                  {seg.videoClipUrl && st !== "generating" ? (
                    <div className="relative group">
                      <video src={seg.videoClipUrl} controls className="w-full rounded" />
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                        onClick={() =>
                          videoClips.regenerateClip(i, segments, state.setSegments, {
                            projectId: project.projectId || projectId,
                            projectName: title,
                            clipDuration,
                            onClipCompleted: async (newSegments) => {
                              await actions.save({ segments: newSegments });
                            },
                          })
                        }
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : st === "generating" ? (
                    <div className="w-full h-48 bg-muted rounded animate-pulse flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <span className="text-xs text-muted-foreground">
                          Generating {clipDuration}s clip...
                        </span>
                      </div>
                    </div>
                  ) : st === "error" ? (
                    <div className="h-48 bg-muted rounded flex flex-col items-center justify-center gap-2">
                      <span className="text-sm text-muted-foreground">Error</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          videoClips.regenerateClip(i, segments, state.setSegments, {
                            projectId: project.projectId || projectId,
                            projectName: title,
                            clipDuration,
                            onClipCompleted: async (newSegments) => {
                              await actions.save({ segments: newSegments });
                            },
                          })
                        }
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
