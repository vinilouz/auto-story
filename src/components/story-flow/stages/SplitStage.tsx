"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface SplitStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function SplitStage({ state }: SplitStageProps) {
  const { segments, clipDuration } = state;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Audio Split into {clipDuration}s Segments</CardTitle>
          <CardDescription>
            {segments.length > 0
              ? `${segments.length} segments created. Each will become one AI video clip.`
              : `Click below to split your transcribed audio into ~${clipDuration}s windows.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {segments.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {segments.map((seg, i) => (
                <div key={i} className="p-3 bg-muted/50 rounded border text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-xs font-bold">#{i + 1}</span>
                    <span className="text-xs text-muted-foreground">
                      {((seg.startMs || 0) / 1000).toFixed(1)}s —{" "}
                      {((seg.endMs || 0) / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-sm">{seg.text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
