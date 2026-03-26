"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { VoicePicker } from "@/components/ui/voice-picker";
import { NAGA_VOICES } from "@/config/voices";
import { ACTIONS, getVideoClipDuration } from "@/lib/ai/config";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface InputStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function InputStage({ state }: InputStageProps) {
  const {
    mode,
    title,
    setTitle,
    scriptText,
    setScriptText,
    segmentSize,
    setSegmentSize,
    language,
    setLanguage,
    imagePromptStyle,
    setImagePromptStyle,
    audioVoice,
    setAudioVoice,
    consistency,
    setConsistency,
    music,
    setMusic,
    clipDuration,
  } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title (optional)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Story title..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="portuguese">Portuguese</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Script</label>
          <Textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="Your story..."
            className="min-h-[200px]"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {mode !== "video-story" && (
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Segment size: {segmentSize[0]} chars
              </label>
              <Slider
                value={segmentSize}
                onValueChange={setSegmentSize}
                max={500}
                min={100}
                step={10}
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Voice</label>
            <VoicePicker
              voices={NAGA_VOICES.map(
                (v) =>
                  ({
                    voiceId: v.externalId,
                    name: v.name,
                    previewUrl: v.previewUrl,
                    labels: { description: v.description },
                  }) as any,
              )}
              value={audioVoice}
              onValueChange={setAudioVoice}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Image/Video Style (System Prompt)
          </label>
          <Textarea
            value={imagePromptStyle}
            onChange={(e) => setImagePromptStyle(e.target.value)}
            placeholder="Visual style..."
            className="min-h-[80px]"
          />
        </div>
        {mode === "video-story" && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="text-sm">
                <strong>Video models:</strong>{" "}
                {ACTIONS.generateVideo
                  .map((m) => `${m.model} (${m.clipDuration}s)`)
                  .join(", ")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                First available model will be used. Audio will be split into ~
                {clipDuration}s segments, each generating one AI video clip.
              </p>
            </CardContent>
          </Card>
        )}
        {(mode === "simple" || mode === "video-story") && (
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Switch checked={consistency} onCheckedChange={setConsistency} />
            <div>
              <label className="text-base font-medium">
                Character Consistency
              </label>
              <p className="text-sm text-muted-foreground">
                Extract entities and generate reference images.
              </p>
            </div>
          </div>
        )}
        {(mode === "simple" || mode === "video-story") && (
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Switch checked={music} onCheckedChange={setMusic} />
            <div>
              <label className="text-base font-medium">Música</label>
              <p className="text-sm text-muted-foreground">
                Generate background music for the video.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
