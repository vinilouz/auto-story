"use client";

import { ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";
import type { AudioVizEffectType, AudioVizConfig } from "@/lib/video/types";
import { useState } from "react";

interface VideoStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

const EFFECT_META: { id: AudioVizEffectType; label: string }[] = [
  { id: "spectrum-bars", label: "Spectrum" },
  { id: "vignette-glow", label: "Glow" },
  { id: "particles", label: "Particles" },
  { id: "waveform-ribbon", label: "Waveform" },
  { id: "scene-modulation", label: "Scene FX" },
];

const COLOR_PRESETS = [
  "#FFE81F",
  "#FFFFFF",
  "#00FF88",
  "#FF00FF",
  "#00FFFF",
  "#FF4444",
  "#8855FF",
];

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value}
          {unit ?? ""}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

function EffectPanel({
  id,
  config,
  onChange,
}: {
  id: AudioVizEffectType;
  config: AudioVizConfig;
  onChange: (patch: Partial<AudioVizConfig>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>
          {EFFECT_META.find((e) => e.id === id)?.label ?? id} settings
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t pt-2">
          {id === "spectrum-bars" && (
            <>
              <SliderRow
                label="Max height"
                value={config.spectrumBars.maxHeight}
                min={5}
                max={100}
                step={1}
                unit="%"
                onChange={(v) =>
                  onChange({
                    spectrumBars: { ...config.spectrumBars, maxHeight: v },
                  })
                }
              />
              <SliderRow
                label="Bar gap"
                value={config.spectrumBars.barGap}
                min={0}
                max={8}
                step={1}
                unit="px"
                onChange={(v) =>
                  onChange({
                    spectrumBars: { ...config.spectrumBars, barGap: v },
                  })
                }
              />
              <SliderRow
                label="Corner radius"
                value={config.spectrumBars.borderRadius}
                min={0}
                max={10}
                step={1}
                unit="px"
                onChange={(v) =>
                  onChange({
                    spectrumBars: {
                      ...config.spectrumBars,
                      borderRadius: v,
                    },
                  })
                }
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bass glow</span>
                <Switch
                  checked={config.spectrumBars.glow}
                  onCheckedChange={(v) =>
                    onChange({
                      spectrumBars: { ...config.spectrumBars, glow: v },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Position</span>
                <div className="flex flex-wrap gap-1">
                  {(["bottom", "top", "center", "left", "right"] as const).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        className={cn(
                          "px-2 py-0.5 text-xs rounded border transition-colors capitalize",
                          config.spectrumBars.position === p
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border",
                        )}
                        onClick={() =>
                          onChange({
                            spectrumBars: {
                              ...config.spectrumBars,
                              position: p,
                            },
                          })
                        }
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </>
          )}
          {id === "vignette-glow" && (
            <>
              <SliderRow
                label="Spread"
                value={config.vignetteGlow.spread}
                min={30}
                max={100}
                step={5}
                unit="%"
                onChange={(v) =>
                  onChange({
                    vignetteGlow: { ...config.vignetteGlow, spread: v },
                  })
                }
              />
              <SliderRow
                label="Min opacity"
                value={config.vignetteGlow.minOpacity}
                min={0}
                max={30}
                step={1}
                unit="%"
                onChange={(v) =>
                  onChange({
                    vignetteGlow: { ...config.vignetteGlow, minOpacity: v },
                  })
                }
              />
              <SliderRow
                label="Max opacity"
                value={config.vignetteGlow.maxOpacity}
                min={10}
                max={100}
                step={5}
                unit="%"
                onChange={(v) =>
                  onChange({
                    vignetteGlow: { ...config.vignetteGlow, maxOpacity: v },
                  })
                }
              />
            </>
          )}
          {id === "particles" && (
            <>
              <SliderRow
                label="Max count"
                value={config.particles.count}
                min={20}
                max={300}
                step={10}
                onChange={(v) =>
                  onChange({
                    particles: { ...config.particles, count: v },
                  })
                }
              />
              <SliderRow
                label="Speed"
                value={config.particles.speed}
                min={0}
                max={8}
                step={0.5}
                onChange={(v) =>
                  onChange({
                    particles: { ...config.particles, speed: v },
                  })
                }
              />
              <SliderRow
                label="Size"
                value={config.particles.size}
                min={1}
                max={10}
                step={0.5}
                onChange={(v) =>
                  onChange({
                    particles: { ...config.particles, size: v },
                  })
                }
              />
              <SliderRow
                label="Spread"
                value={config.particles.scale}
                min={4}
                max={20}
                step={1}
                onChange={(v) =>
                  onChange({
                    particles: { ...config.particles, scale: v },
                  })
                }
              />
              <SliderRow
                label="Noise"
                value={config.particles.noise}
                min={0}
                max={5}
                step={0.5}
                onChange={(v) =>
                  onChange({
                    particles: { ...config.particles, noise: v },
                  })
                }
              />
            </>
          )}
          {id === "waveform-ribbon" && (
            <>
              <SliderRow
                label="Radius"
                value={config.waveformRibbon.radius}
                min={5}
                max={50}
                step={1}
                unit="%"
                onChange={(v) =>
                  onChange({
                    waveformRibbon: { ...config.waveformRibbon, radius: v },
                  })
                }
              />
              <SliderRow
                label="Displacement"
                value={config.waveformRibbon.displacement}
                min={5}
                max={150}
                step={5}
                unit="px"
                onChange={(v) =>
                  onChange({
                    waveformRibbon: {
                      ...config.waveformRibbon,
                      displacement: v,
                    },
                  })
                }
              />
              <SliderRow
                label="Thickness"
                value={config.waveformRibbon.thickness}
                min={1}
                max={10}
                step={0.5}
                unit="px"
                onChange={(v) =>
                  onChange({
                    waveformRibbon: {
                      ...config.waveformRibbon,
                      thickness: v,
                    },
                  })
                }
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Glow</span>
                <Switch
                  checked={config.waveformRibbon.glow}
                  onCheckedChange={(v) =>
                    onChange({
                      waveformRibbon: { ...config.waveformRibbon, glow: v },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Position</span>
                <div className="flex gap-1">
                  {(["center", "top", "bottom"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={cn(
                        "px-2 py-0.5 text-xs rounded border transition-colors capitalize",
                        config.waveformRibbon.position === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border",
                      )}
                      onClick={() =>
                        onChange({
                          waveformRibbon: {
                            ...config.waveformRibbon,
                            position: p,
                          },
                        })
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {id === "scene-modulation" && (
            <>
              <SliderRow
                label="Zoom intensity"
                value={config.sceneModulation.zoomIntensity}
                min={0}
                max={50}
                step={5}
                unit="%"
                onChange={(v) =>
                  onChange({
                    sceneModulation: {
                      ...config.sceneModulation,
                      zoomIntensity: v,
                    },
                  })
                }
              />
              <SliderRow
                label="Pan intensity"
                value={config.sceneModulation.panIntensity}
                min={0}
                max={300}
                step={10}
                unit="%"
                onChange={(v) =>
                  onChange({
                    sceneModulation: {
                      ...config.sceneModulation,
                      panIntensity: v,
                    },
                  })
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function VideoStage({ state, actions }: VideoStageProps) {
  const {
    video,
    captionStyle,
    setCaptionStyle,
    videoVolume,
    setVideoVolume,
    musicUrl,
    musicVolume,
    setMusicVolume,
    musicCompressor,
    setMusicCompressor,
    mode,
    audioVizConfig,
    setAudioVizConfig,
  } = state;

  const isFromAudio = mode === "from-audio";

  const patchViz = (patch: Partial<AudioVizConfig>) =>
    setAudioVizConfig((p) => ({ ...p, ...patch }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Compilation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Font Size ({captionStyle.fontSize}px)
            </label>
            <Slider
              min={40}
              max={150}
              step={5}
              value={[captionStyle.fontSize]}
              onValueChange={(v) =>
                setCaptionStyle((p) => ({ ...p, fontSize: v[0] }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Highlight Color</label>
            <div className="flex gap-2">
              {["#FFE81F", "#FFFFFF", "#00FF00", "#FF00FF", "#00FFFF"].map(
                (c) => (
                  <button
                    key={c}
                    className={cn(
                      "w-6 h-6 rounded-full border",
                      captionStyle.highlightColor === c &&
                        "ring-2 ring-primary ring-offset-2",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      setCaptionStyle((p) => ({ ...p, highlightColor: c }))
                    }
                  />
                ),
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Words/Line</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  variant={
                    captionStyle.maxWordsPerLine === n ? "default" : "outline"
                  }
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() =>
                    setCaptionStyle((p) => ({ ...p, maxWordsPerLine: n }))
                  }
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Clip Audio ({Math.round(videoVolume * 100)}%)
            </label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[videoVolume * 100]}
              onValueChange={(v) => setVideoVolume(v[0] / 100)}
            />
          </div>
          {musicUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Music ({Math.round(musicVolume * 100)}%)
              </label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[musicVolume * 100]}
                onValueChange={(v) => setMusicVolume(v[0] / 100)}
              />
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={musicCompressor}
                  onCheckedChange={setMusicCompressor}
                />
                <span className="text-xs text-muted-foreground">
                  Compressor (duck on narration)
                </span>
              </div>
            </div>
          )}
        </div>

        {isFromAudio && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Audio Visualization</label>
              <Switch
                checked={audioVizConfig.enabled}
                onCheckedChange={(checked) =>
                  patchViz({ enabled: checked })
                }
              />
            </div>
            {audioVizConfig.enabled && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Active effects
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {EFFECT_META.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full border transition-colors",
                          audioVizConfig.effects.includes(id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/50",
                        )}
                        onClick={() =>
                          patchViz({
                            effects: audioVizConfig.effects.includes(id)
                              ? audioVizConfig.effects.length > 1
                                ? audioVizConfig.effects.filter((e) => e !== id)
                                : audioVizConfig.effects
                              : [...audioVizConfig.effects, id],
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <SliderRow
                  label="Global intensity"
                  value={Math.round(audioVizConfig.opacity * 100)}
                  min={10}
                  max={100}
                  step={5}
                  unit="%"
                  onChange={(v) => patchViz({ opacity: v / 100 })}
                />

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Effect color
                  </label>
                  <div className="flex gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          "w-6 h-6 rounded-full border",
                          audioVizConfig.color === c &&
                            "ring-2 ring-primary ring-offset-2",
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => patchViz({ color: c })}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Per-effect settings
                  </label>
                  {audioVizConfig.effects.map((id) => (
                    <EffectPanel
                      key={id}
                      id={id}
                      config={audioVizConfig}
                      onChange={patchViz}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
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
                {video.renderProgress.stage === "validating"
                  ? "Validating assets..."
                  : video.renderProgress.stage === "bundling"
                    ? "Bundling..."
                    : video.renderProgress.stage === "rendering"
                      ? `Rendering ${video.renderProgress.renderedFrames ?? 0}/${video.renderProgress.totalFrames ?? "?"}`
                      : "Encoding..."}
              </span>
              <span>
                {video.renderProgress.remainingSeconds != null && video.renderProgress.stage === "rendering"
                  ? `${video.renderProgress.remainingSeconds > 60 ? `${Math.floor(video.renderProgress.remainingSeconds / 60)}m ${video.renderProgress.remainingSeconds % 60}s` : `${video.renderProgress.remainingSeconds}s`} remaining`
                  : `${video.renderProgress.progress}%`}
              </span>
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
          <VideoPlayer
            props={{ ...video.videoProps, captionStyle, videoVolume, musicVolume, musicCompressor }}
          />
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">
              Click "Generate Preview" below
            </p>
          </div>
        )}
        {video.videoProps && (
          <VideoDebugInfo
            videoProps={video.videoProps}
            captionStyle={captionStyle}
          />
        )}
      </CardContent>
    </Card>
  );
}

function VideoDebugInfo({
  videoProps,
}: {
  videoProps: any;
  captionStyle: any;
}) {
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
  const audioDurationSec = (
    audioTracks.reduce((acc: number, t: any) => acc + t.durationInFrames, 0) /
    fps
  ).toFixed(2);
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
          <span>
            {durationInFrames}f ({compositionSec}s) @ {fps}fps
          </span>
          <span>Video total (sum of scenes)</span>
          <span>
            {cursor}f ({totalVideoDurationSec}s)
          </span>
          <span>Audio total</span>
          <span>
            {audioDurationSec}s · {audioTracks.length} track(s)
          </span>
          <span>Scenes</span>
          <span>
            {scenes.length} ({withClips} with clip, {scenes.length - withClips}{" "}
            image-only)
          </span>
          <span>Captions</span>
          <span>{captions.length} words</span>
          {cursor !== durationInFrames && (
            <>
              <span className="text-yellow-500 font-semibold">⚠ drift</span>
              <span className="text-yellow-500">
                scenes sum {cursor}f ≠ composition {durationInFrames}f (
                {((durationInFrames - cursor) / fps).toFixed(2)}s gap)
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
                  ? s.textFragment.slice(0, 40) +
                    (s.textFragment.length > 40 ? "…" : "")
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
