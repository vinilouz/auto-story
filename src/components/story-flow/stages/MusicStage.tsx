"use client";

import { Loader2, Music, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface MusicStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function MusicStage({ state, actions }: MusicStageProps) {
  const { musicUrl, loading } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Background Music
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {musicUrl ? (
          <div className="space-y-4">
            <audio
              controls
              className="w-full"
              src={musicUrl}
            />
            <Button
              onClick={() => actions.generateMusic()}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            {loading ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  Generating background music...
                </p>
              </>
            ) : (
              <>
                <Music className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  No music generated yet
                </p>
                <Button onClick={() => actions.generateMusic()} disabled={loading}>
                  Generate Music
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
