import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Download, Loader2 } from "lucide-react"
import { StageControls } from "@/components/shared/StageControls"
import { VideoPlayer } from "@/components/video/VideoPlayer"
import { RemotionVideoProps } from "@/lib/video/types"
import { CaptionStyle } from "@/lib/flows/types"
import { cn } from "@/lib/utils"
import { DEFAULT_CAPTION_STYLE } from "@/lib/flows/types"

interface VideoStageProps {
  videoProps: RemotionVideoProps | null
  captionStyle: CaptionStyle
  setCaptionStyle: (style: CaptionStyle) => void
  onRegenerate: () => Promise<void>
  onRender: () => Promise<void>
  isGenerating: boolean
  isRendering: boolean
  renderProgress?: {
    progress: number
    stage: string
    renderedFrames?: number
    totalFrames?: number
  } | null
  colors?: string[]
}

export function VideoStage({
  videoProps,
  captionStyle,
  setCaptionStyle,
  onRegenerate,
  onRender,
  isGenerating,
  isRendering,
  renderProgress,
  colors = ["#FFE81F", "#FFFFFF", "#00FF00", "#FF00FF", "#00FFFF"]
}: VideoStageProps) {
  const wordsPerLineOptions = [1, 2, 3, 4, 5, 6]

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Preview do Vídeo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tamanho da Fonte ({captionStyle.fontSize}px)</label>
              <Slider
                min={40}
                max={150}
                step={5}
                value={[captionStyle.fontSize]}
                onValueChange={(val) => setCaptionStyle({ ...captionStyle, fontSize: val[0] })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cor do Destaque</label>
              <div className="flex gap-2">
                {colors.map(color => (
                  <button
                    key={color}
                    className={cn(
                      "w-6 h-6 rounded-full border border-border",
                      captionStyle.highlightColor === color && "ring-2 ring-primary ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setCaptionStyle({ ...captionStyle, highlightColor: color })}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Palavras por Linha</label>
              <div className="flex gap-1">
                {wordsPerLineOptions.map(num => (
                  <Button
                    key={num}
                    variant={captionStyle.maxWordsPerLine === num ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCaptionStyle({ ...captionStyle, maxWordsPerLine: num })}
                  >
                    {num}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mb-4">
            <Button variant="secondary" onClick={onRender} disabled={isRendering}>
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Renderizando MP4...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Renderizar Vídeo (MP4)
                </>
              )}
            </Button>
          </div>

          {renderProgress && (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {renderProgress.stage === 'bundling' && 'Empacotando...'}
                  {renderProgress.stage === 'rendering' && `Renderizando frames ${renderProgress.renderedFrames ?? 0}/${renderProgress.totalFrames ?? '?'}`}
                  {renderProgress.stage === 'encoding' && 'Finalizando...'}
                </span>
                <span>{renderProgress.progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${renderProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {videoProps && (
            <VideoPlayer props={{ ...videoProps, captionStyle }} />
          )}

          {videoProps && (
            <div className="mt-8 pt-4 border-t">
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground font-medium">Debug: Video Metadata</summary>
                <div className="mt-2 text-xs font-mono space-y-2 max-h-80 overflow-y-auto bg-muted p-4 rounded">
                  <p>Total Scenes: {videoProps.scenes.length}</p>
                  <p>Total Duration: {videoProps.durationInFrames} frames ({videoProps.durationInFrames / videoProps.fps}s)</p>
                  <pre className="mt-4 text-[10px] opacity-50">
                    {JSON.stringify(videoProps, (key, val) =>
                      typeof val === 'string' && val.startsWith('data:image')
                        ? `[BASE64_IMAGE_${val.length}_BYTES]`
                        : val, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export { DEFAULT_CAPTION_STYLE }
