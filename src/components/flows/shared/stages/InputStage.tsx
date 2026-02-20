import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NAGA_VOICES } from "@/config/voices"
import { VoicePicker } from "@/components/ui/voice-picker"

interface InputStageProps {
  title: string
  setTitle: (val: string) => void
  scriptText: string
  setScriptText: (text: string) => void
  segmentSize: number[]
  setSegmentSize: (val: number[]) => void
  language: string
  setLanguage: (val: string) => void
  imageSystemPrompt: string
  setImageSystemPrompt: (val: string) => void
  audioVoice?: string
  setAudioVoice?: (val: string) => void
}

export function InputStage({
  title,
  setTitle,
  scriptText,
  setScriptText,
  segmentSize,
  setSegmentSize,
  language,
  setLanguage,
  imageSystemPrompt,
  setImageSystemPrompt,
  audioVoice,
  setAudioVoice
}: InputStageProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Projeto</CardTitle>
          <CardDescription>Defina os dados principais para guiar a lógica da sua história.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">Título do Projeto (Opcional)</label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Exemplo: Nome da História..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Idioma de Destino</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o idioma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portuguese">Português</SelectItem>
                  <SelectItem value="english">Inglês</SelectItem>
                  <SelectItem value="spanish">Espanhol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="script" className="text-sm font-medium">Roteiro Principal</label>
            <Textarea
              id="script"
              placeholder="Digite a história principal aqui..."
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              className="min-h-[200px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-3 pb-1">
              <label className="text-sm font-medium">Tamanho do Segmento da Cena (caracteres)</label>
              <Slider
                value={segmentSize}
                onValueChange={setSegmentSize}
                max={500}
                step={10}
              />
              <p className="text-xs text-muted-foreground">Define em quantos caracteres o roteiro deve ser picotado por cena. Escolha atual: {segmentSize[0]}</p>
            </div>

            {audioVoice !== undefined && setAudioVoice && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Voz Principal (Narrador)</label>
                <VoicePicker
                  voices={NAGA_VOICES.map((v) => ({
                    voiceId: v.externalId,
                    name: v.name,
                    previewUrl: v.previewUrl,
                    labels: { description: v.description },
                  })) as any}
                  value={audioVoice}
                  onValueChange={setAudioVoice}
                  placeholder="Selecione uma voz..."
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="imageStyle" className="text-sm font-medium">Estilo das Imagens (System Prompt)</label>
            <Textarea
              id="imageStyle"
              value={imageSystemPrompt}
              onChange={(e) => setImageSystemPrompt(e.target.value)}
              placeholder="Defina o estilo visual das imagens..."
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>
    </>
  )
}
