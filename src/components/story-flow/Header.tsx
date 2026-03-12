"use client";

import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FlowMode } from "./types";

interface HeaderProps {
  mode: FlowMode;
  title: string;
  scriptText: string;
  isSaving: boolean;
  onSave: () => void;
  onBack: () => void;
}

export function Header({ mode, title, scriptText, isSaving, onSave, onBack }: HeaderProps) {
  const modeTitle =
    mode === "video-story"
      ? "Video Story"
      : mode === "commentator"
        ? "Story with Commentator"
        : "Simple Story";

  return (
    <header className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">{title || modeTitle}</h1>
      </div>
      <Button onClick={onSave} disabled={!scriptText.trim() || isSaving} variant="outline">
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}{" "}
        Save
      </Button>
    </header>
  );
}
