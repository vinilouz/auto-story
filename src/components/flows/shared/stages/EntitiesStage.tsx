import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EntityAsset } from "@/lib/flows/types"
import { Loader2, RefreshCw, Pencil, Check, X } from "lucide-react"
import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"

interface EntitiesStageProps {
  entities: EntityAsset[]
  onGenerate: () => void
  onRegenerateEntityImage?: (index: number) => void
  onUpdateEntityDescription?: (index: number, newDescription: string) => void
  isLoading: boolean
}

export function EntitiesStage({
  entities,
  onGenerate,
  onRegenerateEntityImage,
  onUpdateEntityDescription,
  isLoading
}: EntitiesStageProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  const startEdit = (index: number, currentDesc: string) => {
    setEditingIndex(index)
    setEditValue(currentDesc)
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditValue("")
  }

  const saveEdit = (index: number) => {
    if (onUpdateEntityDescription) {
      onUpdateEntityDescription(index, editValue)
    }
    setEditingIndex(null)
  }
  if (entities.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-10">
          <p className="text-muted-foreground">Nenhuma entidade recorrente encontrada.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personagens & Elementos Extraídos</CardTitle>
          <CardDescription>
            Abaixo estão os nomes das entidades que aparecem em múltiplas cenas. Ao prosseguir,
            vamos criar fichas detalhadas e gerar uma imagem de referência para cada um garantir a consistência no roteiro final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {entities.map((e, idx) => (
              <div key={idx} className="bg-muted px-3 py-1.5 rounded-full text-sm font-semibold border border-border">
                {e.name}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {entities.some(e => e.status === 'completed' || e.imageUrl || e.description) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entities.map((e, idx) => (
            <Card key={idx} className="overflow-hidden flex flex-col p-0 relative group">
              {onRegenerateEntityImage && e.status === 'completed' && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={() => onRegenerateEntityImage(idx)}
                  disabled={isLoading}
                  title="Regerar Imagem"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                {e.imageUrl ? (
                  <img
                    src={e.imageUrl}
                    alt={e.name}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center">
                    {(e.status === 'generating' || isLoading) ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <span className="text-sm shadow-sm">{e.description ? "Gerando imagem..." : "Criando ficha..."}</span>
                      </>
                    ) : (
                      <span>Pendente</span>
                    )}
                  </div>
                )}
              </div>
              <CardContent className="flex-1 p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{e.name}</h3>
                  {onUpdateEntityDescription && e.status === 'completed' && editingIndex !== idx && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(idx, e.description || "")} title="Editar Descrição">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {editingIndex === idx ? (
                  <div className="flex flex-col gap-2 flex-1">
                    <Textarea
                      value={editValue}
                      onChange={(ev) => setEditValue(ev.target.value)}
                      className="text-xs min-h-[100px] flex-1"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={cancelEdit}>
                        <X className="h-3 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={() => saveEdit(idx)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  e.description ? (
                    <p className="text-sm text-muted-foreground text-pretty">
                      {e.description}
                    </p>
                  ) : null
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
