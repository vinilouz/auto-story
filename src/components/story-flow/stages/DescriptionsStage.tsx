"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface DescriptionsStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function DescriptionsStage({ state }: DescriptionsStageProps) {
  const { segments } = state;

  return (
    <div className="space-y-4">
      {segments.map((seg, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <div className="font-semibold text-xs text-muted-foreground uppercase">
              Scene {i + 1} {seg.type === "comment" && "(Comment)"}
            </div>
            <p className="text-sm">{seg.text}</p>
            {seg.imagePrompt && (
              <div className="bg-muted p-2 rounded text-sm italic text-muted-foreground border-l-2">
                {seg.imagePrompt}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
