"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface VideoStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function VideoStage({ state, actions }: VideoStageProps) {
  const { video, captionStyle, setCaptionStyle, videoVolume, setVideoVolume } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Compilation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Font Size ({captionStyle.fontSize}px)</label>
            <Slider
              min={40}
              max={150}
              step={5}
              value={[captionStyle.fontSize]}
              onValueChange={(v) => setCaptionStyle((p) => ({ ...p, fontSize: v[0] }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Highlight Color</label>
            <div className="flex gap-2">
              {["#FFE81F", "#FFFFFF", "#00FF00", "#FF00FF", "#00FFFF"].map((c) => (
                <button
                  key={c}
                  className={cn(
                    "w-6 h-6 rounded-full border",
                    captionStyle.highlightColor === c && "ring-2 ring-primary ring-offset-2",
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setCaptionStyle((p) => ({ ...p, highlightColor: c }))}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Words/Line</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  variant={captionStyle.maxWordsPerLine === n ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCaptionStyle((p) => ({ ...p, maxWordsPerLine: n }))}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Clip Audio ({Math.round(videoVolume * 100)}%)</label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[videoVolume * 100]}
              onValueChange={(v) => setVideoVolume(v[0] / 100)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={actions.renderVideoAction}
            disabled={video.isRendering || !video.videoProps}
          >
            {video.isRendering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rendering...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Render MP4
              </>
            )}
          </Button>
        </div>
        {video.renderProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {video.renderProgress.stage === "bundling"
                  ? "Bundling..."
                  : video.renderProgress.stage === "rendering"
                    ? `Rendering ${video.renderProgress.renderedFrames ?? 0}/${video.renderProgress.totalFrames ?? "?"}`
                    : "Encoding..."}
              </span>
              <span>{video.renderProgress.progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${video.renderProgress.progress}%` }}
              />
            </div>
          </div>
        )}
        {video.videoProps ? (
          <VideoPlayer props={{ ...video.videoProps, captionStyle, videoVolume }} />
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Click "Generate Preview" below</p>
          </div>
        )}
        {video.videoProps && <VideoDebugInfo videoProps={video.videoProps} captionStyle={captionStyle} />}
      </CardContent>
    </Card>
  );
}

function VideoDebugInfo({ videoProps }: { videoProps: any; captionStyle: any }) {
  const { scenes, audioTracks, captions, fps, durationInFrames } = videoProps;

  let cursor = 0;
  const sceneRows = scenes.map((s: any, i: number) => {
    const startFrame = cursor;
    cursor += s.durationInFrames;
    const durationSec = (s.durationInFrames / fps).toFixed(2);
    const startSec = (startFrame / fps).toFixed(2);
    return { i, s, startFrame, startSec, durationSec };
  });

  const totalVideoDurationSec = (cursor / fps).toFixed(2);
  const audioDurationSec = (audioTracks.reduce((acc: number, t: any) => acc + t.durationInFrames, 0) / fps).toFixed(2);
  const withClips = scenes.filter((s: any) => s.videoClipUrl).length;
  const compositionSec = (durationInFrames / fps).toFixed(1);

  return (
    <details className="text-sm text-muted-foreground">
      <summary className="cursor-pointer hover:text-foreground font-medium">
        Debug — {scenes.length} scenes · {compositionSec}s composition
      </summary>
      <div className="mt-2 space-y-3">
        <div className="text-xs font-mono bg-muted p-3 rounded grid grid-cols-2 gap-x-6 gap-y-1">
          <span>Composition</span>
          <span>{durationInFrames}f ({compositionSec}s) @ {fps}fps</span>
          <span>Video total (sum of scenes)</span>
          <span>{cursor}f ({totalVideoDurationSec}s)</span>
          <span>Audio total</span>
          <span>{audioDurationSec}s · {audioTracks.length} track(s)</span>
          <span>Scenes</span>
          <span>{scenes.length} ({withClips} with clip, {scenes.length - withClips} image-only)</span>
          <span>Captions</span>
          <span>{captions.length} words</span>
          {cursor !== durationInFrames && (
            <>
              <span className="text-yellow-500 font-semibold">⚠ drift</span>
              <span className="text-yellow-500">
                scenes sum {cursor}f ≠ composition {durationInFrames}f
                ({((durationInFrames - cursor) / fps).toFixed(2)}s gap)
              </span>
            </>
          )}
        </div>

        <div className="text-xs font-mono bg-muted p-3 rounded max-h-72 overflow-y-auto">
          <div className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem_3rem] gap-x-2 text-muted-foreground/70 mb-1 border-b pb-1">
            <span>#</span>
            <span>id / text</span>
            <span>start</span>
            <span>dur (s)</span>
            <span>dur (f)</span>
            <span>clip</span>
          </div>
          {sceneRows.map(({ i, s, startFrame, startSec, durationSec }: any) => (
            <div
              key={s.id}
              className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem_3rem] gap-x-2 py-0.5 border-b border-border/30 hover:bg-accent/30"
            >
              <span className="text-muted-foreground/50">{i + 1}</span>
              <span className="truncate" title={s.textFragment ?? s.id}>
                {s.textFragment
                  ? s.textFragment.slice(0, 40) + (s.textFragment.length > 40 ? "…" : "")
                  : s.id}
              </span>
              <span>{startSec}s</span>
              <span
                className={
                  parseFloat(durationSec) < 2
                    ? "text-red-400 font-bold"
                    : parseFloat(durationSec) < 4
                      ? "text-yellow-400"
                      : "text-green-400"
                }
              >
                {durationSec}s
              </span>
              <span>{s.durationInFrames}f</span>
              <span>{s.videoClipUrl ? "✓" : "–"}</span>
            </div>
          ))}
        </div>

        <div className="text-xs font-mono bg-muted p-3 rounded">
          <p className="text-muted-foreground/70 mb-1">Audio tracks</p>
          {audioTracks.map((t: any, i: number) => (
            <div key={i} className="flex gap-4">
              <span>Track {i + 1}</span>
              <span>start: {(t.startFrame / fps).toFixed(2)}s</span>
              <span>dur: {(t.durationInFrames / fps).toFixed(2)}s</span>
              <span>vol: {t.volume ?? 1}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
