import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Check, X, RefreshCw, Clock } from "lucide-react"
import { StageControls } from "@/components/shared/StageControls"
import { AudioBatch, TranscriptionResult } from "@/lib/flows/types"

interface TranscriptionStageProps {
  audioBatches: AudioBatch[]
  results: TranscriptionResult[]
  onTranscribe: () => Promise<void>
  onRetry?: (url: string) => Promise<void>
  isLoading: boolean
}

export function TranscriptionStage({
  audioBatches,
  results,
  onTranscribe,
  onRetry,
  isLoading,
}: TranscriptionStageProps) {
  const allCompleted = results.length > 0 && results.every(r => r.status === 'completed')

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Transcrição de Áudio</CardTitle></CardHeader>
        <CardContent>
          {!results.length && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">
                {audioBatches.length > 0
                  ? `Pronto para transcrever ${audioBatches.length} áudios gerados.`
                  : "Nenhum áudio para transcrever."}
              </p>
              <Button onClick={onTranscribe} size="lg" disabled={audioBatches.length === 0}>
                Iniciar Transcrição
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Transcrevendo áudios...
            </div>
          )}

          {(results.length > 0 || isLoading) && (
            <div className="space-y-4">
              {audioBatches.map((batch, i) => {
                const result = batch.url ? results.find(r => r.url === batch.url) : null
                const status = result?.status || (isLoading ? 'pending' : 'idle')

                return (
                  <div key={i} className="flex flex-col gap-2 p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">Batch #{i + 1}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {batch.text.substring(0, 50)}...
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'completed' && result ? (
                          <>
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" /> Transcrito
                            </span>
                            <a href={result.transcriptionUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="h-8">
                                Ver JSON
                              </Button>
                            </a>
                          </>
                        ) : status === 'error' ? (
                          <>
                            <span className="text-xs text-destructive font-medium flex items-center gap-1" title={result?.error || "Erro desconhecido"}>
                              <X className="w-3 h-3" /> {result?.error === 'File not found' ? 'Arquivo ausente' : 'Erro'}
                            </span>
                            {onRetry && result?.url && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onRetry(result.url)} title="Tentar Novamente">
                                <RefreshCw className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                            {isLoading ? 'Processando...' : 'Pendente'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
