"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface CommentsStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function CommentsStage({ state }: CommentsStageProps) {
  const { segments, commentator, hasComments } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Segments</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasComments ? (
          <p className="text-center py-8 text-muted-foreground">
            Click below to generate.
          </p>
        ) : (
          <div className="space-y-3">
            {segments
              .filter((s) => s.type)
              .map((seg, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    seg.type === "comment"
                      ? "bg-blue-50 border border-blue-100 italic"
                      : "bg-muted/50",
                  )}
                >
                  {seg.type === "comment" &&
                    commentator?.appearance?.imageUrl && (
                      <img
                        src={commentator.appearance.imageUrl}
                        className="w-6 h-6 rounded-full inline mr-2"
                        alt=""
                      />
                    )}
                  {seg.text}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
