"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbox, useLightbox } from "@/components/ui/lightbox";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface ImagesStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function ImagesStage({ state, actions }: ImagesStageProps) {
  const { segments, imageStatuses } = state;
  const { lightboxIndex, open, close, prev, next } = useLightbox();

  const visibleSegments = segments.filter((s) => s.imagePrompt);

  const lightboxImages = visibleSegments
    .map((seg) => ({
      src: seg.imagePath ?? "",
      label: `#${segments.indexOf(seg) + 1}`,
    }))
    .filter((img) => img.src);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Images</span>
        <span className="rounded bg-muted px-2 py-0.5 font-mono">
          {segments.filter((s) => s.imagePath).length}/{segments.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {visibleSegments.map((seg, i) => {
          const realIdx = segments.indexOf(seg);
          const st = imageStatuses.get(realIdx);

          const lbIdx = lightboxImages.findIndex(
            (img) => img.label === `#${realIdx + 1}`,
          );

          return (
            <Card key={i}>
              <CardContent className="space-y-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">
                    #{realIdx + 1}
                  </span>
                  {seg.imagePath && st !== "generating" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => actions.generateSingleImage(realIdx)}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <p className="line-clamp-2 text-xs italic text-muted-foreground">
                  {seg.imagePrompt}
                </p>

                {seg.imagePath && st !== "generating" ? (
                  <div className="relative group">
                    <img
                      src={seg.imagePath}
                      alt=""
                      loading="lazy"
                      className="w-full cursor-zoom-in rounded transition-opacity hover:opacity-90"
                      onClick={() => lbIdx >= 0 && open(lbIdx)}
                    />
                  </div>
                ) : st === "generating" ? (
                  <Skeleton className="h-48 w-full" />
                ) : st === "error" ? (
                  <div className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded bg-red-50">
                    <span className="text-xs font-medium text-red-500">Error</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 text-[10px] text-red-600 hover:bg-red-100 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.generateSingleImage(realIdx);
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

      {lightboxIndex !== null && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={close}
          onPrev={prev}
          onNext={() => next(lightboxImages.length)}
        />
      )}
    </div>
  );
}
