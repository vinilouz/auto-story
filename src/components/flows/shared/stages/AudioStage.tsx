import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Check, X, RefreshCw, Play } from "lucide-react"
import { StageControls } from "@/components/shared/StageControls"
import { AudioBatch } from "@/lib/flows/types"
import { VOICES } from "@/lib/ai/configs/voices"
import { cn } from "@/lib/utils"

interface AudioStageProps {
  batches: AudioBatch[]
  expectedBatches?: string[]
  onGenerate: () => Promise<void>
  onRegenerateBatch: (index: number) => Promise<void>
  isLoading: boolean

  voiceNarrator?: string
  setVoiceNarrator?: (v: string) => void
  voiceCommentator?: string
  setVoiceCommentator?: (v: string) => void
  systemPrompt?: string
  setSystemPrompt?: (v: string) => void
  showMultiVoice?: boolean
}

export function AudioStage({
  batches,
  expectedBatches = [],
  onGenerate,
  onRegenerateBatch,
  isLoading,
  voiceNarrator,
  setVoiceNarrator,
  voiceCommentator,
  setVoiceCommentator,
  systemPrompt = "",
  setSystemPrompt,
  showMultiVoice = false
}: AudioStageProps) {
  const hasCompletedBatches = batches.some(b => b.status === 'completed')
  const batchesToShow = expectedBatches.length > 0 ? expectedBatches : batches.map(b => b.text)

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Status da Geração</CardTitle>
              {expectedBatches.length > 0 && (
                <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
                  {batches.filter(b => b.status === 'completed').length}/{expectedBatches.length} Concluídos
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!batches.length && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8">
                <Button onClick={onGenerate} size="lg">Gerar Áudio</Button>
              </div>
            )}

            {isLoading && batches.length === 0 && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando áudio...
              </div>
            )}

            {(batches.length > 0 || isLoading) && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {batchesToShow.map((batchText, i) => {
                  const batch = batches.find(b => b.index === i) || {
                    index: i,
                    text: batchText,
                    status: 'pending' as const
                  }

                  return (
                    <div
                      key={batch.index}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded border text-sm transition-colors",
                        batch.status === 'error' ? "bg-red-50/50 border-red-200" :
                          batch.status === 'completed' ? "bg-green-50/30 border-green-200/50 hover:bg-green-50/50" :
                            "bg-muted/50 border-border"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-mono text-xs px-1.5 py-0.5 rounded border",
                            batch.status === 'completed' ? "bg-green-100 border-green-200 text-green-700" :
                              batch.status === 'error' ? "bg-red-100 border-red-200 text-red-700" :
                                "bg-gray-100 border-gray-200 text-gray-700"
                          )}>
                            #{batch.index + 1}
                          </span>
                          {batch.status === 'completed' && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Pronto</span>}
                          {batch.status === 'error' && <span className="text-xs text-red-600 font-medium flex items-center gap-1"><X className="w-3 h-3" /> Falha</span>}
                          {batch.status === 'generating' && <span className="text-xs text-blue-600 font-medium flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Gerando...</span>}
                          {batch.status === 'pending' && <span className="text-xs text-muted-foreground font-medium">Pendente</span>}
                        </div>

                        <div className="flex gap-2">
                          {batch.status === 'completed' && batch.url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => {
                                const audio = new Audio(batch.url)
                                audio.play()
                              }}
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => onRegenerateBatch(batch.index)}
                            disabled={batch.status === 'generating'}
                          >
                            {batch.status === 'error' ? 'Recalcular' : batch.status === 'completed' ? 'Refazer' : 'Gerar'}
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 pl-1 border-l-2 border-muted">
                        {batch.text}
                      </p>

                      {batch.status === 'completed' && batch.url && (
                        <audio controls src={batch.url} className="w-full h-8 mt-1" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {showMultiVoice && (
          <Card>
            <CardHeader><CardTitle>Configuração de Vozes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {setSystemPrompt && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Prompt (Instruções para o Áudio)</label>
                  <Textarea
                    placeholder="Ex: Responda com um tom dramático e pausado..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {setVoiceNarrator && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Voz do Narrador</label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={voiceNarrator}
                      onChange={(e) => setVoiceNarrator(e.target.value)}
                    >
                      {VOICES.map(opt => (
                        <option key={opt.id} value={opt.name}>{opt.name} ({opt.description})</option>
                      ))}
                    </select>
                  </div>
                )}
                {setVoiceCommentator && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Voz do Comentador</label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={voiceCommentator}
                      onChange={(e) => setVoiceCommentator(e.target.value)}
                    >
                      {VOICES.map(opt => (
                        <option key={opt.id} value={opt.name}>{opt.name} ({opt.description})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
