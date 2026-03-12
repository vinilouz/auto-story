"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface EntitiesStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function EntitiesStage({ state, actions }: EntitiesStageProps) {
  const { entities, loading } = state;

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
                className="bg-muted px-3 py-1.5 rounded-full text-sm font-semibold border"
              >
                {e.name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      {entities.some((e) => e.description || e.imageUrl) && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entities.map((e, i) => (
            <Card key={i} className="overflow-hidden p-0 relative">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative group">
                {e.imageUrl ? (
                  <>
                    <img
                      src={e.imageUrl}
                      alt={e.name}
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 shadow"
                        onClick={() => actions.generateSingleEntity(i)}
                        disabled={e.status === "generating"}
                      >
                        <RefreshCw
                          className={cn(
                            "w-4 h-4",
                            e.status === "generating" && "animate-spin",
                          )}
                        />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    {e.status === "generating" || loading ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      "Pending"
                    )}
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold">{e.name}</h3>
                {e.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {e.description}
                  </p>
                )}
                {e.segment && e.segment.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Segments: {e.segment.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
