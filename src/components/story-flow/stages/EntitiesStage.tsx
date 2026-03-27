"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Lightbox, useLightbox } from "@/components/ui/lightbox";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface EntitiesStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function EntitiesStage({ state, actions }: EntitiesStageProps) {
  const { entities, loading } = state;
  const { lightboxIndex, open, close, prev, next } = useLightbox();

  const lightboxImages = entities
    .filter((e) => !!e.imageUrl)
    .map((e) => ({ src: e.imageUrl!, label: e.name }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Entities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {entities.map((e, i) => (
              <span
                key={i}
                className="rounded-full border bg-muted px-3 py-1.5 text-sm font-semibold"
              >
                {e.name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {entities.some((e) => e.description || e.imageUrl) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entities.map((e, i) => {
            const lbIdx = lightboxImages.findIndex(
              (img) => img.label === e.name,
            );

            return (
              <Card key={i} className="overflow-hidden p-0">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {e.imageUrl ? (
                    <>
                      <img
                        src={e.imageUrl}
                        alt={e.name}
                        loading="lazy"
                        className="h-full w-full cursor-zoom-in object-cover transition-opacity hover:opacity-90"
                        onClick={() => lbIdx >= 0 && open(lbIdx)}
                      />
                      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 shadow"
                          onClick={() => actions.generateSingleEntity(i)}
                          disabled={e.status === "generating"}
                        >
                          <RefreshCw
                            className={cn(
                              "h-4 w-4",
                              e.status === "generating" && "animate-spin",
                            )}
                          />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {e.status === "generating" || loading ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => actions.generateSingleEntity(i)}
                        >
                          Generate
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-sm font-semibold">{e.name}</p>
                  {e.segment && e.segment.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Scenes: {e.segment.join(", ")}
                    </p>
                  )}
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {e.description}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

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
