"use client";

import { useState } from "react";
import { Loader2, Maximize2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LazyVideo } from "@/components/ui/lazy-video";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface VideoModalProps {
  src: string;
  label: string;
  onClose: () => void;
}

function VideoModal({ src, label, onClose }: VideoModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl border-0 bg-black/95 p-0 [&>button]:hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-mono text-sm text-white/60">{label}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 pb-4">
          <video
            src={src}
            controls
            autoPlay
            className="w-full rounded-md shadow-2xl"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ClipsStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function ClipsStage({ state, actions }: ClipsStageProps) {
  const { segments, videoClips, clipDuration, project, projectId } = state;
  const [expandedClip, setExpandedClip] = useState<{
    src: string;
    label: string;
  } | null>(null);

  const visibleSegments = segments.filter((s) => s.imagePrompt);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Clips</span>
        <span className="rounded bg-muted px-2 py-0.5 font-mono">
          {segments.filter((s) => s.videoClipUrl).length}/{segments.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {visibleSegments.map((seg, i) => {
          const realIdx = segments.indexOf(seg);
          const st = videoClips.clipStatuses.get(realIdx);

          return (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <div className="mb-1 flex justify-between">
                  <span className="font-mono text-xs font-bold">
                    Clip #{realIdx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {clipDuration}s
                  </span>
                </div>

                <p className="line-clamp-2 text-xs italic text-muted-foreground">
                  {seg.imagePrompt}
                </p>

                {seg.videoClipUrl && st !== "generating" ? (
                  <div className="group relative">
                    <LazyVideo
                      src={seg.videoClipUrl}
                      className="w-full rounded"
                    />
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 shadow"
                        onClick={() =>
                          setExpandedClip({
                            src: seg.videoClipUrl!,
                            label: `Clip #${realIdx + 1}`,
                          })
                        }
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 shadow"
                        onClick={() =>
                          videoClips.regenerateClip(
                            realIdx,
                            segments,
                            state.setSegments,
                            {
                              projectId: project.projectId || projectId,
                              clipDuration,
                              onClipCompleted: async (newSegments) => {
                                await actions.save({ segments: newSegments });
                              },
                            },
                          )
                        }
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : st === "generating" ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Generating...
                    </span>
                  </div>
                ) : st === "error" ? (
                  <div className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded bg-red-50">
                    <span className="text-xs font-medium text-red-500">Error</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 text-[10px] text-red-600 hover:bg-red-100 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        videoClips.regenerateClip(
                          realIdx,
                          segments,
                          state.setSegments,
                          {
                            projectId: project.projectId || projectId,
                            clipDuration,
                            onClipCompleted: async (newSegments) => {
                              await actions.save({ segments: newSegments });
                            },
                          },
                        );
                      }}
                    >
                      <RefreshCw className="h-3 w-3" /> Retry
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-24 w-full items-center justify-center rounded bg-muted/50">
                    <span className="text-xs text-muted-foreground">
                      Pending
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {expandedClip && (
        <VideoModal
          src={expandedClip.src}
          label={expandedClip.label}
          onClose={() => setExpandedClip(null)}
        />
      )}
    </div>
  );
}
