import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { StageControls } from "@/components/shared/StageControls"

interface DownloadStageProps {
  title: string
  description?: string
  onDownload: () => Promise<void>
  isDownloading: boolean
  projectName?: string
}

export function DownloadStage({
  title,
  description = "Baixe todos os arquivos.",
  onDownload,
  isDownloading,
  projectName
}: DownloadStageProps) {
  return (
    <>
      <StageControls
        onRegenerate={() => { }}
        onNext={() => { }}
        nextLabel="Finalizar"
        hideNext
        hideRegenerate
      />

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
          <p className="text-muted-foreground text-center max-w-md">
            {description}
          </p>
          <Button onClick={onDownload} disabled={isDownloading} size="lg" className="w-full max-w-xs">
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Baixar ZIP Completo
          </Button>
          {projectName && (
            <p className="text-xs text-muted-foreground">
              Projeto: {projectName}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
