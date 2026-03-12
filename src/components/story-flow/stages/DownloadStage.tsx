"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoryFlowState } from "../types";
import type { StoryFlowActions } from "../useStoryFlowActions";

interface DownloadStageProps {
  state: StoryFlowState;
  actions: StoryFlowActions;
}

export function DownloadStage({ state }: DownloadStageProps) {
  const { dl } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
        <p className="text-muted-foreground text-center max-w-md">
          All assets ready. Download as ZIP.
        </p>
        <Button
          onClick={() => {}}
          disabled={dl.isDownloading}
          size="lg"
          className="w-full max-w-xs"
        >
          {dl.isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}{" "}
          Download ZIP
        </Button>
      </CardContent>
    </Card>
  );
}
