"use client";

import { useRef, useState, RefObject } from "react";
import { Loader2, Music, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

const COMPRESSOR_CONFIG = {
  threshold: -35,
  ratio: 20,
  knee: 0,
  attack: 0,
  release: 0.21,
} as const;

function useAudioDucking(audioRef: RefObject<HTMLAudioElement | null>) {
  const [isDucked, setIsDucked] = useState(false);
  const nodes = useRef<{
    ctx: AudioContext;
    src: MediaElementAudioSourceNode;
    comp: DynamicsCompressorNode;
  } | null>(null);

  const init = () => {
    if (nodes.current || !audioRef.current) return;

    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const src = ctx.createMediaElementSource(audioRef.current);
    const comp = ctx.createDynamicsCompressor();

    comp.threshold.value = COMPRESSOR_CONFIG.threshold;
    comp.ratio.value = COMPRESSOR_CONFIG.ratio;
    comp.knee.value = COMPRESSOR_CONFIG.knee;
    comp.attack.value = COMPRESSOR_CONFIG.attack;
    comp.release.value = COMPRESSOR_CONFIG.release;

    nodes.current = { ctx, src, comp };
    src.connect(ctx.destination);
  };

  const toggle = () => {
    init();
    if (!nodes.current) return;
    const { ctx, src, comp } = nodes.current;

    src.disconnect();
    comp.disconnect();

    if (!isDucked) {
      src.connect(comp).connect(ctx.destination);
    } else {
      src.connect(ctx.destination);
    }

    setIsDucked((prev) => !prev);
  };

  return { isDucked, toggle, init };
}

interface MusicStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function MusicStage({ state, actions }: MusicStageProps) {
  const { musicUrl, loading } = state;
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isDucked, toggle, init } = useAudioDucking(audioRef);

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
              ref={audioRef}
              controls
              className="w-full"
              src={musicUrl}
              onPlay={init}
            />

            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Compressor de Áudio</p>
                <p className="text-xs text-muted-foreground">
                  Threshold {COMPRESSOR_CONFIG.threshold} dBFS · Ratio{" "}
                  {COMPRESSOR_CONFIG.ratio}:1 · Release{" "}
                  {COMPRESSOR_CONFIG.release}s
                </p>
              </div>
              <Button
                variant={isDucked ? "default" : "outline"}
                size="sm"
                onClick={toggle}
              >
                {isDucked ? "LIGADO" : "DESLIGADO"}
              </Button>
            </div>

            <Button
              onClick={() => actions.generateMusic()}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            {loading ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Generating background music...
                </p>
              </>
            ) : (
              <>
                <Music className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
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
