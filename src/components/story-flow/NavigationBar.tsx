"use client";

import { ChevronLeft, ChevronRight, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExecuteConfig } from "./types";

interface NavigationBarProps {
  exec: ExecuteConfig;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  stageIdx: number;
}

export function NavigationBar({
  exec,
  canNext,
  onBack,
  onNext,
  stageIdx,
}: NavigationBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-md z-40 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={stageIdx === 0}
          className="w-28"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          size="lg"
          onClick={exec.fn}
          disabled={!exec.ok || exec.busy}
          className="flex-1 max-w-sm rounded-full shadow-lg font-semibold"
        >
          {exec.busy ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Play className="w-5 h-5 mr-2" />
          )}{" "}
          {exec.label}
        </Button>
        <Button
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            "w-28 transition-all",
            canNext ? "shadow-md ring-2 ring-primary/20" : "opacity-40",
          )}
        >
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
