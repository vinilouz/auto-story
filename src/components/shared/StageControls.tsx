import { Button } from "@/components/ui/button"
import { RefreshCw, ChevronRight, Loader2 } from "lucide-react"

interface StageControlsProps {
  onRegenerate: () => void
  onNext: () => void
  nextLabel: string
  canRegenerate?: boolean
  canGoNext?: boolean
  isRegenerating?: boolean
  isNextLoading?: boolean
  hideRegenerate?: boolean
  hideNext?: boolean
  regenerateLabel?: string
}

export function StageControls({
  onRegenerate,
  onNext,
  nextLabel,
  canRegenerate = true,
  canGoNext = true,
  isRegenerating = false,
  isNextLoading = false,
  hideRegenerate = false,
  hideNext = false,
  regenerateLabel = "Regerar Etapa"
}: StageControlsProps) {
  console.log('[StageControls] Rendering:', { nextLabel, canGoNext, isRegenerating, isNextLoading, hideNext, hideRegenerate })

  return (
    <div className="flex gap-4 mb-6 sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b">
      {!hideRegenerate && (
        <Button
          variant="secondary"
          onClick={onRegenerate}
          disabled={!canRegenerate || isRegenerating || isNextLoading}
          className="flex-1 min-w-[120px]"
        >
          {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {regenerateLabel}
        </Button>
      )}

      {!hideNext && (
        <Button
          onClick={onNext}
          disabled={!canGoNext || isNextLoading || isRegenerating}
          className="flex-[2] min-w-[180px]"
        >
          {isNextLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {nextLabel}
          {!isNextLoading && <ChevronRight className="w-4 h-4 ml-2" />}
        </Button>
      )}
    </div>
  )
}
