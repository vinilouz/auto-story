import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EntityAsset } from "@/lib/flows/types"
import { Loader2 } from "lucide-react"

interface EntitiesStageProps {
  entities: EntityAsset[]
  onGenerate: () => void
  isLoading: boolean
}

export function EntitiesStage({
  entities,
  onGenerate,
  isLoading
}: EntitiesStageProps) {
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
            <Card key={idx} className="overflow-hidden flex flex-col">
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
              <CardContent className="p-4 flex-1">
                <h3 className="font-bold mb-2">{e.name}</h3>
                {e.description ? (
                  <p className="text-sm text-muted-foreground text-pretty">
                    {e.description}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
