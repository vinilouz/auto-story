"use client";

import { Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface CommentatorStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function CommentatorStage({ state, actions }: CommentatorStageProps) {
  const {
    commName,
    setCommName,
    commPersonality,
    setCommPersonality,
    commImagePrompt,
    setCommImagePrompt,
    commImage,
    setCommImage,
    loading,
  } = state;

  const { generateCommentatorImage } = actions;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Commentator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Name"
          value={commName}
          onChange={(e) => setCommName(e.target.value)}
        />
        <Textarea
          placeholder="Personality..."
          value={commPersonality}
          onChange={(e) => setCommPersonality(e.target.value)}
          rows={3}
        />
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Describe appearance..."
              value={commImagePrompt}
              onChange={(e) => setCommImagePrompt(e.target.value)}
              rows={2}
            />
            <Button
              onClick={generateCommentatorImage}
              disabled={loading || !commImagePrompt.trim()}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}{" "}
              Generate
            </Button>
          </div>
          <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
            {commImage ? (
              <img src={commImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="comm-upload"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onloadend = () => setCommImage(r.result as string);
                      r.readAsDataURL(f);
                    }
                  }}
                />
                <label htmlFor="comm-upload" className="cursor-pointer text-xs text-muted-foreground">
                  <Upload className="w-6 h-6 mx-auto mb-1" />
                  Upload
                </label>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
