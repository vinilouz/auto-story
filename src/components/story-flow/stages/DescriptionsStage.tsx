"use client";

import { Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface DescriptionsStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function DescriptionsStage({ state, actions }: DescriptionsStageProps) {
  const { segments, loading } = state;
  const { updateSegmentImagePrompt, generateMissingDescriptions } = actions;
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (idx: number, current: string) => {
    setEditingIdx(idx);
    setEditValue(current);
  };

  const saveEdit = () => {
    if (editingIdx !== null) {
      updateSegmentImagePrompt(editingIdx, editValue);
      setEditingIdx(null);
    }
  };

  const cancelEdit = () => {
    setEditingIdx(null);
  };

  const missingCount = segments.filter((s) => !s.imagePrompt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Descriptions</span>
        <span className="font-mono bg-muted px-2 py-0.5 rounded">
          {segments.filter((s) => s.imagePrompt).length}/{segments.length}
        </span>
        {missingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => generateMissingDescriptions()}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate Missing
          </Button>
        )}
      </div>
      {segments.map((seg, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <div className="font-semibold text-xs text-muted-foreground uppercase">
              Scene {i + 1} {seg.type === "comment" && "(Comment)"}
            </div>
            <p className="text-sm">{seg.text}</p>
            {seg.imagePrompt && (
              <div className="bg-muted p-2 rounded text-sm italic text-muted-foreground border-l-2">
                {editingIdx === i ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="min-h-24 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-start gap-2">
                    <span className="flex-1">{seg.imagePrompt}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                      onClick={() => startEdit(i, seg.imagePrompt || "")}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
