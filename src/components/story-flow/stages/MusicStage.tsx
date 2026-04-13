"use client";

import { Loader2, Music, RefreshCw, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface MusicStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function MusicStage({ state, actions }: MusicStageProps) {
  const { musicPrompt, musicUrl, loading, musicRaw, setMusicRaw } = state;

  const needsCompression = musicUrl?.includes("background-raw.mp4");

  const audioSrc = musicUrl && musicRaw
    ? musicUrl.replace("background.mp4", "background-raw.mp4")
    : musicUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Música
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {musicUrl ? (
          <div className="space-y-4">
            <audio
              controls
              className="w-full"
              src={audioSrc ?? undefined}
            />

            <div className="flex items-center gap-2">
              <Switch
                checked={musicRaw}
                onCheckedChange={setMusicRaw}
                disabled={needsCompression}
              />
              <span className="text-xs text-muted-foreground">
                {musicRaw
                  ? "Áudio cru"
                  : needsCompression
                    ? "Comprimido (indisponível)"
                    : "Comprimido (acompressor + limiter)"}
              </span>
            </div>

            <div className="flex gap-2">
              {needsCompression && (
                <Button
                  onClick={() => actions.compressMusic()}
                  disabled={loading}
                  variant="default"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Comprimindo...
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-4 w-4" />
                      Comprimir Áudio
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={() => actions.generateMusicPrompt()}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerando prompt...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Regenerar Prompt
                  </>
                )}
              </Button>
              <Button
                onClick={() => actions.generateMusic()}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerando música...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerar Música
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : musicPrompt ? (
          <div className="space-y-4">
            <Textarea
              value={musicPrompt}
              onChange={(e) => state.setMusicPrompt(e.target.value)}
              rows={4}
              className="resize-y"
              placeholder="Descrição musical instrumental..."
            />
            <div className="flex gap-2">
              <Button
                onClick={() => actions.generateMusicPrompt()}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Regenerar Prompt
                  </>
                )}
              </Button>
              <Button
                onClick={() => actions.generateMusic()}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando música...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-4 w-4" />
                    Gerar Música
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            {loading ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Analisando a história para sugerir o prompt musical...
                </p>
              </>
            ) : (
              <>
                <Music className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Gere um prompt musical baseado na sua história
                </p>
                <Button onClick={() => actions.generateMusicPrompt()}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Prompt Musical
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
