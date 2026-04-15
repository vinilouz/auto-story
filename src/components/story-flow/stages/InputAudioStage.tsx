"use client";

import { Music, Upload, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { StoryFlowState } from "../types";

interface InputAudioStageProps {
  state: StoryFlowState;
}

export function InputAudioStage({ state }: InputAudioStageProps) {
  const {
    title,
    setTitle,
    imagePromptStyle,
    setImagePromptStyle,
    segmentSize,
    setSegmentSize,
    consistency,
    setConsistency,
    music,
    setMusic,
    uploadedAudioFile,
    setUploadedAudioFile,
  } = state;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadedAudioFile(file);
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>From Audio — Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Project Title (optional)
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My audio story…"
          />
        </div>

        {/* Audio upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Audio File *</label>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadedAudioFile ? (
              <div className="flex items-center justify-center gap-3">
                <Music className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium truncate max-w-[220px]">
                  {uploadedAudioFile.name}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={handleClearFile}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload audio
                </p>
                <p className="text-xs text-muted-foreground">
                  MP3, WAV, M4A, OGG, WEBM
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Image style */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Image Style (System Prompt)
          </label>
          <Textarea
            value={imagePromptStyle}
            onChange={(e) => setImagePromptStyle(e.target.value)}
            placeholder="Describe the visual style for generated images…"
            className="min-h-[80px]"
          />
        </div>

        {/* Segment size */}
        <div className="space-y-3">
          <label className="text-sm font-medium">
            Segment size: {segmentSize[0]} chars
          </label>
          <Slider
            value={segmentSize}
            onValueChange={setSegmentSize}
            min={10}
            max={500}
            step={10}
          />
          <p className="text-xs text-muted-foreground">
            Controls how the transcript is split into scenes.
          </p>
        </div>

        {/* Consistency toggle */}
        <div className="flex items-center space-x-2 pt-2 border-t">
          <Switch
            id="consistency-toggle"
            checked={consistency}
            onCheckedChange={setConsistency}
          />
          <div>
            <label
              htmlFor="consistency-toggle"
              className="text-base font-medium cursor-pointer"
            >
              Character Consistency
            </label>
            <p className="text-sm text-muted-foreground">
              Extract entities and generate reference images.
            </p>
          </div>
        </div>

        {/* Music toggle */}
        <div className="flex items-center space-x-2 pt-2 border-t">
          <Switch
            id="music-toggle"
            checked={music}
            onCheckedChange={setMusic}
          />
          <div>
            <label
              htmlFor="music-toggle"
              className="text-base font-medium cursor-pointer"
            >
              Background Music
            </label>
            <p className="text-sm text-muted-foreground">
              Generate AI background music for the video.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
