import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Pencil, Check, X } from "lucide-react"
import { StageControls } from "@/components/shared/StageControls"
import { VisualDescription } from "@/lib/flows/types"

interface ImagesStageProps {
  descriptions: VisualDescription[]
  segments?: string[]
  onGenerateAll: () => Promise<void>
  onRegenerate: (index: number) => Promise<void>
  onEditPrompt?: (index: number, newPrompt: string) => void
  isLoading: boolean
  systemPrompt: string
  setSystemPrompt: (v: string) => void
  showSegmentText?: boolean
}

export function ImagesStage({
  descriptions,
  segments,
  onGenerateAll,
  onRegenerate,
  onEditPrompt,
  isLoading,
  systemPrompt,
  setSystemPrompt,
  showSegmentText = true
}: ImagesStageProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")

  const startEditing = (index: number, prompt: string) => {
    setEditingIndex(index)
    setEditedPrompt(prompt)
  }

  const cancelEditing = () => {
    setEditingIndex(null)
    setEditedPrompt("")
  }

  const savePrompt = (index: number) => {
    if (onEditPrompt) {
      onEditPrompt(index, editedPrompt)
    }
    setEditingIndex(null)
  }

  const allCompleted = descriptions.length > 0 && descriptions.every(d => d.status === 'completed')

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Estilo das Imagens (System Prompt)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Defina o estilo visual das imagens..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {!allCompleted && descriptions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Clique em "Gerar Imagens" para iniciar
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {descriptions.map((desc, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              {showSegmentText && segments?.[i] && (
                <div className="text-sm text-muted-foreground mb-2">
                  <span className="font-semibold">Cena {i + 1}:</span> {segments[i]}
                </div>
              )}

              {editingIndex === i ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={() => savePrompt(i)}>
                      <Check className="w-4 h-4 mr-1" /> Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="text-xs text-muted-foreground italic mb-2">{desc.imagePrompt}</p>
                  {onEditPrompt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={() => startEditing(i, desc.imagePrompt)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}

              {desc.status === 'completed' && desc.imageUrl ? (
                <img src={desc.imageUrl} alt={`Scene ${i + 1}`} className="w-full rounded" />
              ) : desc.status === 'generating' ? (
                <Skeleton className="w-full h-48" />
              ) : desc.status === 'error' ? (
                <div className="w-full h-48 bg-muted rounded flex flex-col items-center justify-center gap-2">
                  <span className="text-sm text-muted-foreground">Erro ao gerar</span>
                  <Button variant="outline" size="sm" onClick={() => onRegenerate(i)}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Tentar Novamente
                  </Button>
                </div>
              ) : (
                <Skeleton className="w-full h-48" />
              )}

              {desc.status === 'completed' && desc.imageUrl && (
                <Button variant="ghost" size="sm" onClick={() => onRegenerate(i)}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
