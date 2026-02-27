"use client"

import { useState, useEffect, useMemo } from "react"
import {
  StoryFlowBase,
  ImagesStage,
  AudioStage,
  TranscriptionStage,
  VideoStage,
  DownloadStage,
  EntitiesStage,
  DEFAULT_CAPTION_STYLE
} from "@/components/flows/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useImageGeneration } from "@/lib/flows/use-image-generation"
import { useAudioGeneration } from "@/lib/flows/use-audio-generation"
import { useTranscription } from "@/lib/flows/use-transcription"
import { useVideoGeneration } from "@/lib/flows/use-video-generation"
import { useVideoClipGeneration } from "@/lib/flows/use-video-clip-generation"
import { useProject, useDownload, LoadedProjectData, determineStage } from "@/lib/flows/use-project"
import { GENERATE_ENTITY_IMAGE_PROMPT, GENERATE_SEGMENT_IMAGE_PROMPT } from "@/lib/ai/prompts/prompts"
import { VIDEO_MODELS } from "@/config/video-models"
import { splitByTranscriptionTime } from "@/lib/utils/transcription-splitter"
import {
  Segment,
  CaptionStyle,
  EntityAsset,
  ProjectData,
  TranscriptionWord
} from "@/lib/flows/types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { VoicePicker } from "@/components/ui/voice-picker"
import { NAGA_VOICES } from "@/config/voices"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

type Stage = 'INPUT' | 'AUDIO' | 'TRANSCRIPTION' | 'SPLIT' | 'DESCRIPTIONS' | 'ENTITIES' | 'IMAGES' | 'VIDEOS' | 'RENDER' | 'DOWNLOAD'

const getStageOrder = (consistency: boolean): Stage[] => consistency
  ? ['INPUT', 'AUDIO', 'TRANSCRIPTION', 'SPLIT', 'DESCRIPTIONS', 'ENTITIES', 'IMAGES', 'VIDEOS', 'RENDER', 'DOWNLOAD']
  : ['INPUT', 'AUDIO', 'TRANSCRIPTION', 'SPLIT', 'DESCRIPTIONS', 'IMAGES', 'VIDEOS', 'RENDER', 'DOWNLOAD']

const getSteps = (consistency: boolean): string[] => consistency
  ? ["Entrada", "Áudio", "Transcrição", "Divisão", "Descrições", "Entidades", "Cenas", "Vídeos", "Render", "Download"]
  : ["Entrada", "Áudio", "Transcrição", "Divisão", "Descrições", "Cenas", "Vídeos", "Render", "Download"]

interface FullVideoFlowProps {
  onBack: () => void
  projectId?: string
}

export default function FullVideoFlow({ onBack, projectId }: FullVideoFlowProps) {
  const [currentStage, setCurrentStage] = useState<Stage>('INPUT')

  const [title, setTitle] = useState("")
  const [consistency, setConsistency] = useState(false)
  const [scriptText, setScriptText] = useState("")
  const [language, setLanguage] = useState("english")
  const [segments, setSegments] = useState<Segment[]>([])
  const [entities, setEntities] = useState<EntityAsset[]>([])
  const [imageSystemPrompt, setImageSystemPrompt] = useState("")
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb")
  const [videoModel, setVideoModel] = useState(VIDEO_MODELS[0].id)
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)
  const [transitionOverride, setTransitionOverride] = useState<"random" | "none" | "fade" | "wipe" | "slide" | "">("random")
  const [videoVolume, setVideoVolume] = useState(0.5)
  const [isLoading, setIsLoading] = useState(false)
  const [isSplitDone, setIsSplitDone] = useState(false)

  const STAGE_ORDER = getStageOrder(consistency)
  const STEPS = getSteps(consistency)

  const imageGen = useImageGeneration(
    segments,
    setSegments,
    {
      systemPrompt: "",
      entities,
      buildPrompt: (original) => GENERATE_SEGMENT_IMAGE_PROMPT(original, imageSystemPrompt)
    }
  )

  const audioGen = useAudioGeneration({
    type: 'single',
    getText: () => scriptText,
    voice: audioVoice,
    projectId: projectId || 'temp',
    projectName: title
  })

  const transcription = useTranscription(audioGen.batches, language)

  const videoClipGen = useVideoClipGeneration(segments, setSegments)

  const download = useDownload()

  const project = useProject({
    projectId,
    flowType: 'full-video',
    getProjectData: () => ({
      name: title,
      scriptText,
      consistency,
      segmentSize: 0,
      language,
      style: imageSystemPrompt,
      voice: audioVoice,
      videoModel,
      segments,
      entities,
      audioUrls: audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
      audioBatches: audioGen.batches,
      transcriptionResults: transcription.results.filter(r => audioGen.batches.some(b => b.url === r.url))
    }),
    onLoad: (data: LoadedProjectData) => {
      if (data.name) setTitle(data.name)
      if (data.consistency !== undefined) setConsistency(data.consistency)
      setScriptText(data.scriptText)
      if (data.language) setLanguage(data.language)
      if (data.style) setImageSystemPrompt(data.style)
      if (data.voice) setAudioVoice(data.voice)
      if (data.videoModel) setVideoModel(data.videoModel)
      if (data.segments) {
        setSegments(data.segments)
        if (data.segments.length > 0) setIsSplitDone(true)
      }
      if (data.entities) setEntities(data.entities)
      if (data.audioBatches) audioGen.setBatches(data.audioBatches)
      if (data.transcriptionResults) transcription.setResults(data.transcriptionResults)

      const stage = determineStageFullVideo(data, consistency)
      const stageOrder = getStageOrder(data.consistency !== undefined ? data.consistency : consistency)
      if (stageOrder.includes(stage as Stage)) {
        setCurrentStage(stage as Stage)
      }
    }
  })

  const videoGen = useVideoGeneration({
    getSegments: () => segments.map((seg, i) => ({
      id: `seg-${i}`,
      text: seg.text,
      imageUrl: seg.videoPath || seg.imagePath || ''
    })),
    audioBatches: audioGen.batches,
    transcriptionResults: transcription.results,
    projectId: project.currentProjectId || undefined,
    projectName: title,
    compositionId: "CaptionedVideoFull"
  })

  useEffect(() => {
    if (projectId && !project.isLoading) {
      project.loadProject(projectId)
    }
  }, [projectId])

  useEffect(() => {
    if (consistency && entities.length === 0 && segments.some(s => s.imagePrompt)) {
      const extracted = new Set<string>()
      segments.forEach(seg => {
        if (!seg.imagePrompt) return
        const matches = seg.imagePrompt.match(/<<([^>]+)>>/g)
        if (matches) {
          matches.forEach(m => extracted.add(m.replace(/<<|>>/g, '')))
        }
      })
      if (extracted.size > 0) {
        const recoveredEntities: EntityAsset[] = Array.from(extracted).map(name => ({
          name,
          status: 'pending' as const
        }))
        setEntities(recoveredEntities)
        setTimeout(() => project.save({ entities: recoveredEntities }), 100)
      }
    }
  }, [consistency, segments, entities.length])

  const saveProject = async (overrides?: Partial<ProjectData>, autoAdvance: boolean = false) => {
    if (!scriptText.trim()) return
    const saved = await project.save(overrides)
    if (saved) {
      toast.success("Projeto atualizado!", {
        style: { backgroundColor: '#16a34a', color: 'white', border: 'none' }
      })
      if (autoAdvance) {
        const nextIdx = STAGE_ORDER.indexOf(currentStage) + 1
        if (nextIdx <= maxAllowedStep && STAGE_ORDER[nextIdx]) {
          setCurrentStage(STAGE_ORDER[nextIdx])
        }
      }
    }
  }

  const currentStepIndex = STAGE_ORDER.indexOf(currentStage)

  const hasImagePrompts = segments.some(s => s.imagePrompt)
  const hasImages = segments.some(s => s.imagePath)
  const hasVideoClips = segments.some(s => s.videoPath)

  const maxAllowedStep = useMemo(() => {
    let step = 0
    const order = STAGE_ORDER

    if (audioGen.batches.some(b => b.status === 'completed' && b.url)) step = order.indexOf('TRANSCRIPTION')
    if (transcription.results.length > 0) step = order.indexOf('SPLIT')
    if (isSplitDone && segments.length > 0) step = order.indexOf('DESCRIPTIONS')
    if (hasImagePrompts) {
      if (consistency) {
        step = order.indexOf('ENTITIES')
        if (entities.length > 0 && entities.every(e => e.status === 'completed')) {
          step = order.indexOf('IMAGES')
        }
      } else {
        step = order.indexOf('IMAGES')
      }
    }
    if (hasImages) step = order.indexOf('VIDEOS')
    if (hasVideoClips) step = order.indexOf('RENDER')
    if (videoGen.videoProps) step = order.indexOf('DOWNLOAD')

    return step
  }, [
    audioGen.batches,
    transcription.results.length,
    isSplitDone,
    segments,
    hasImagePrompts,
    hasImages,
    hasVideoClips,
    consistency,
    entities,
    videoGen.videoProps,
    STAGE_ORDER
  ])

  const handleStepClick = (index: number) => {
    if (index > maxAllowedStep) return
    if (STAGE_ORDER[index]) setCurrentStage(STAGE_ORDER[index])
  }

  const handleNextStep = () => {
    if (currentStepIndex + 1 <= maxAllowedStep) {
      handleStepClick(currentStepIndex + 1)
    }
  }
  const handlePrevStep = () => handleStepClick(currentStepIndex - 1)

  const handleGenerateAudio = async () => {
    let activeProjectId = project.currentProjectId
    if (!activeProjectId) {
      const savedProject = await project.save()
      activeProjectId = savedProject?.id
    }
    const generatedBatches = await audioGen.generate({ projectId: activeProjectId, projectName: title })
    setCurrentStage('AUDIO')
    setTimeout(() => {
      saveProject({
        audioBatches: generatedBatches,
        audioUrls: generatedBatches.filter((b: any) => b.status === 'completed' && b.url).map((b: any) => b.url!)
      })
    }, 100)
  }

  const handleTranscribe = async () => {
    await transcription.transcribe()
    setCurrentStage('TRANSCRIPTION')
    setTimeout(() => saveProject(), 100)
  }

  const handleSplit = async () => {
    const activeUrls = new Set(audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!))

    const allWords: TranscriptionWord[] = []
    for (const result of transcription.results) {
      if (!activeUrls.has(result.url)) continue
      if (result.status !== 'completed' || !result.data) continue
      const words = Array.isArray(result.data) ? result.data : result.data.words || []
      allWords.push(...words)
    }

    if (allWords.length === 0) return

    const selectedModel = VIDEO_MODELS.find(m => m.id === videoModel)
    if (!selectedModel) return

    const clipDurationMs = selectedModel.clipDurationSeconds * 1000
    const transcriptionSegments = splitByTranscriptionTime(allWords, clipDurationMs)

    const newSegments: Segment[] = transcriptionSegments.map(ts => ({ text: ts.text }))
    setSegments(newSegments)
    setIsSplitDone(true)
    setCurrentStage('SPLIT')
    await saveProject({ segments: newSegments })
  }

  const handleGenerateDescriptions = async () => {
    if (segments.length === 0) return
    setIsLoading(true)
    try {
      const descRes = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments, language, style: imageSystemPrompt, consistency }),
      })
      if (!descRes.ok) throw new Error("Failed to generate descriptions")
      const descData = await descRes.json()

      const updatedSegments: Segment[] = descData.segments || segments
      setSegments(updatedSegments)

      if (consistency && descData.entities && Array.isArray(descData.entities)) {
        const initialEntities: EntityAsset[] = descData.entities.map((name: string) => ({
          name,
          status: 'pending' as const
        }))
        setEntities(initialEntities)
        setCurrentStage('ENTITIES')
        await saveProject({ segments: updatedSegments, entities: initialEntities })
      } else {
        setCurrentStage('DESCRIPTIONS')
        await saveProject({ segments: updatedSegments })
      }
    } catch (error) {
      console.error("Generation error:", error)
      alert("Failed to generate descriptions")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateEntities = async () => {
    setIsLoading(true)
    try {
      const entityNames = entities.map(e => e.name)
      if (entityNames.length === 0) return

      let activeProjectId = project.currentProjectId
      if (!activeProjectId) {
        const savedProject = await project.save()
        activeProjectId = savedProject?.id
      }

      const descRes = await fetch("/api/generate/entities/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities: entityNames, segments: segments.map(s => s.text) }),
      })
      if (!descRes.ok) throw new Error("Failed to generate entity descriptions")
      const descData = await descRes.json()

      const enhancedEntities = entities.map(e => {
        const generated = descData.entities.find((ge: any) => ge.name === e.name)
        if (generated) {
          return { ...e, description: generated.description, status: 'generating' as const }
        }
        return { ...e, status: 'generating' as const }
      })
      setEntities(enhancedEntities)

      const imagePromises = enhancedEntities.map(async (e) => {
        if (!e.description) return e

        try {
          const imgRes = await fetch("/api/generate/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(e.description, undefined, imageSystemPrompt),
              imageConfig: { aspect_ratio: "1:1" },
              projectId: activeProjectId,
              projectName: title
            }),
          })
          if (!imgRes.ok) throw new Error("Image gen failed")

          const imgData = await imgRes.json()
          return { ...e, imageUrl: imgData.imageUrl, status: 'completed' as const }
        } catch (err) {
          console.error(`Failed to generate image for ${e.name}`, err)
          return { ...e, status: 'error' as const }
        }
      })

      const completedEntities = await Promise.all(imagePromises)
      setEntities(completedEntities)
      await saveProject({ entities: completedEntities })
    } catch (error) {
      console.error("Entity generation error", error)
      alert("Falha ao gerar fichas de personagens")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateEntityImage = async (index: number) => {
    setIsLoading(true)
    try {
      const entityToRegen = entities[index]
      if (!entityToRegen || !entityToRegen.description) return

      let activeProjectId = project.currentProjectId
      if (!activeProjectId) {
        const savedProject = await project.save()
        activeProjectId = savedProject?.id
      }

      setEntities(prev => prev.map((e, i) => i === index ? { ...e, status: 'generating' } : e))

      const imgRes = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(entityToRegen.description, undefined, imageSystemPrompt),
          imageConfig: { aspect_ratio: "1:1" },
          projectId: activeProjectId,
          projectName: title
        }),
      })
      if (!imgRes.ok) throw new Error("Image gen failed")

      const imgData = await imgRes.json()

      setEntities(prev => {
        const newEntities = prev.map((e, i) => i === index ? { ...e, imageUrl: imgData.imageUrl, status: 'completed' as const } : e)
        saveProject({ entities: newEntities })
        return newEntities
      })

      toast.success(`Imagem de ${entityToRegen.name} regerada!`, {
        style: { backgroundColor: '#16a34a', color: 'white', border: 'none' }
      })

    } catch (error) {
      console.error("Entity image regeneration error", error)
      setEntities(prev => prev.map((e, i) => i === index ? { ...e, status: 'error' as const } : e))
      toast.error("Falha ao regerar imagem do personagem")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateEntityDescription = (index: number, newDescription: string) => {
    const newEntities = [...entities]
    newEntities[index] = { ...newEntities[index], description: newDescription }
    setEntities(newEntities)
    saveProject({ entities: newEntities })
    toast.success(`Descrição de ${newEntities[index].name} salva!`)
  }

  const handleGenerateImages = async () => {
    let activeProjectId = project.currentProjectId
    if (!activeProjectId) {
      const savedProject = await project.save()
      activeProjectId = savedProject?.id
    }
    await imageGen.generateAll({ projectId: activeProjectId, projectName: title })
    setCurrentStage('IMAGES')
    setTimeout(() => saveProject(), 100)
  }

  const handleGenerateVideoClips = async () => {
    let activeProjectId = project.currentProjectId
    if (!activeProjectId) {
      const savedProject = await project.save()
      activeProjectId = savedProject?.id
    }
    await videoClipGen.generateAll({
      modelId: videoModel,
      projectId: activeProjectId,
      projectName: title
    }, (newSegments) => saveProject({ segments: newSegments }))
    setCurrentStage('VIDEOS')
  }

  const handleGenerateVideo = async () => {
    try {
      await videoGen.generateVideo()
      setCurrentStage('RENDER')
      setTimeout(() => saveProject(), 100)
    } catch (error: any) {
      alert(`Falha ao gerar vídeo: ${error.message}`)
    }
  }

  const handleRenderVideo = async () => {
    try {
      await videoGen.renderVideo(captionStyle, transitionOverride, videoVolume)
    } catch (error: any) {
      alert(`Falha na renderização: ${error.message}`)
    }
  }

  const handleDownloadZip = async () => {
    try {
      await download.downloadZip({
        segments,
        audioUrls: audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
        transcriptionResults: transcription.results,
        filename: `full-video-${Date.now()}.zip`
      })
    } catch {
      alert("Failed to download ZIP")
    }
  }

  let onExecute: (() => void) | undefined
  let isExecuting = false
  let canExecute = false
  let executeLabel = "Executar"
  let canNext = false

  switch (currentStage) {
    case 'INPUT':
      onExecute = handleGenerateAudio
      isExecuting = audioGen.isLoading
      canExecute = !!scriptText.trim()
      executeLabel = audioGen.batches.some(b => b.status === 'completed') ? "Regerar Áudio" : "Gerar Áudio"
      canNext = audioGen.batches.some(b => b.status === 'completed' && b.url)
      break
    case 'AUDIO':
      onExecute = handleGenerateAudio
      isExecuting = audioGen.isLoading
      canExecute = !!scriptText.trim()
      executeLabel = audioGen.batches.some(b => b.status === 'completed') ? "Regerar Áudio" : "Gerar Áudio"
      canNext = audioGen.batches.some(b => b.status === 'completed' && b.url)
      break
    case 'TRANSCRIPTION':
      onExecute = handleTranscribe
      isExecuting = transcription.isLoading
      canExecute = audioGen.batches.some(b => b.status === 'completed' && b.url)
      executeLabel = "Gerar Transcrição"
      canNext = transcription.results.length > 0
      break
    case 'SPLIT':
      onExecute = handleSplit
      isExecuting = false
      canExecute = transcription.results.length > 0
      executeLabel = isSplitDone ? "Redividir" : "Dividir por Tempo"
      canNext = isSplitDone && segments.length > 0
      break
    case 'DESCRIPTIONS':
      onExecute = handleGenerateDescriptions
      isExecuting = isLoading
      canExecute = segments.length > 0
      executeLabel = hasImagePrompts ? "Regerar Descrições" : "Gerar Descrições"
      canNext = hasImagePrompts
      break
    case 'ENTITIES':
      onExecute = handleGenerateEntities
      isExecuting = isLoading
      canExecute = entities.length > 0
      executeLabel = entities.every(e => e.status === 'completed') ? "Regerar Imagens e Fichas" : "Gerar Imagens e Fichas"
      canNext = entities.every(e => e.status === 'completed')
      break
    case 'IMAGES':
      onExecute = handleGenerateImages
      isExecuting = imageGen.isLoading
      canExecute = hasImagePrompts
      executeLabel = hasImages ? "Regerar Imagens" : "Gerar Imagens"
      canNext = hasImages
      break
    case 'VIDEOS':
      onExecute = handleGenerateVideoClips
      isExecuting = videoClipGen.isLoading
      canExecute = hasImages
      executeLabel = hasVideoClips ? "Regerar Vídeos" : "Gerar Vídeos"
      canNext = hasVideoClips
      break
    case 'RENDER':
      onExecute = handleGenerateVideo
      isExecuting = videoGen.isGenerating
      canExecute = hasVideoClips
      executeLabel = "Gerar Preview"
      canNext = !!videoGen.videoProps
      break
    case 'DOWNLOAD':
      onExecute = handleDownloadZip
      isExecuting = download.isDownloading
      canExecute = true
      executeLabel = "Baixar ZIP"
      canNext = false
      break
  }

  const selectedModelConfig = VIDEO_MODELS.find(m => m.id === videoModel)

  return (
    <StoryFlowBase
      title="História em Vídeo"
      steps={STEPS}
      currentStep={currentStepIndex}
      maxStep={maxAllowedStep}
      onStepClick={handleStepClick}
      onBack={onBack}
      onSave={() => saveProject(undefined, true)}
      isSaving={project.isSaving}
      canSave={!!scriptText.trim()}
      onExecute={onExecute}
      isExecuting={isExecuting}
      canExecute={canExecute}
      executeLabel={executeLabel}
      onNext={handleNextStep}
      canNext={canNext && currentStepIndex < maxAllowedStep}
      onPrevious={handlePrevStep}
      canPrevious={currentStepIndex > 0}
    >
      {currentStage === 'INPUT' && (
        <Card>
          <CardHeader>
            <CardTitle>Configurações do Projeto</CardTitle>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Modelo de Vídeo</label>
                <Select value={videoModel} onValueChange={setVideoModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Cada clip terá {selectedModelConfig?.clipDurationSeconds}s de duração
                </p>
              </div>

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

            <div className="flex items-center space-x-2 pt-2 border-t mt-4">
              <Switch
                id="consistency-mode"
                checked={consistency}
                onCheckedChange={setConsistency}
              />
              <div className="space-y-0.5">
                <label htmlFor="consistency-mode" className="text-base font-medium">Consistência de Personagens</label>
                <p className="text-sm text-muted-foreground">
                  Ativa um pipeline avançado para extrair e gerar imagens de referência consistentes para os personagens antes das cenas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStage === 'AUDIO' && (
        <AudioStage
          batches={audioGen.batches}
          onGenerate={handleGenerateAudio}
          onRegenerateBatch={async (idx) => {
            const updatedBatches = await audioGen.regenerateBatch(idx, undefined, { projectId: project.currentProjectId, projectName: title });
            if (updatedBatches) {
              saveProject({
                audioBatches: updatedBatches,
                audioUrls: updatedBatches.filter((b: any) => b.status === 'completed' && b.url).map((b: any) => b.url!)
              });
            } else {
              saveProject();
            }
          }}
          isLoading={audioGen.isLoading}
        />
      )}

      {currentStage === 'TRANSCRIPTION' && (
        <TranscriptionStage
          audioBatches={audioGen.batches}
          results={transcription.results}
          onTranscribe={handleTranscribe}
          onRetry={async (url: string) => { await transcription.retry(url); saveProject(); }}
          isLoading={transcription.isLoading}
        />
      )}

      {currentStage === 'SPLIT' && (
        <div className="space-y-4">
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle>Divisão por Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A transcrição foi dividida em {segments.length} segmentos de ~{selectedModelConfig?.clipDurationSeconds}s
                ({selectedModelConfig?.name}).
              </p>
            </CardContent>
          </Card>

          {segments.map((seg, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Segmento {i + 1}</div>
                  <Badge variant="outline" className="text-xs">{selectedModelConfig?.clipDurationSeconds}s</Badge>
                </div>
                <p className="text-sm">{seg.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {currentStage === 'DESCRIPTIONS' && (
        <div className="space-y-4">
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle>Descrições Visuais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {hasImagePrompts
                  ? `${segments.length} segmentos com prompts visuais gerados.`
                  : `Clique em "Gerar Descrições" para criar prompts visuais para os ${segments.length} segmentos.`
                }
              </p>
            </CardContent>
          </Card>

          {segments.map((seg, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Segmento {i + 1}</div>
                <p className="text-sm">{seg.text}</p>
                {seg.imagePrompt && (
                  <div className="bg-muted p-3 rounded-md text-sm italic text-muted-foreground border border-border/50">
                    <span className="font-semibold not-italic block mb-1 text-xs">Prompt Visual:</span>
                    {seg.imagePrompt}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {currentStage === 'ENTITIES' && (
        <EntitiesStage
          entities={entities}
          onGenerate={handleGenerateEntities}
          onRegenerateEntityImage={handleRegenerateEntityImage}
          onUpdateEntityDescription={handleUpdateEntityDescription}
          isLoading={isLoading}
        />
      )}

      {currentStage === 'IMAGES' && (
        <ImagesStage
          segments={segments}
          imageStatuses={imageGen.imageStatuses}
          onGenerateAll={handleGenerateImages}
          onRegenerate={async (idx) => {
            const newImagePath = await imageGen.regenerate(idx, { projectId: project.currentProjectId, projectName: title });
            const updatedSegments = [...segments];
            updatedSegments[idx] = { ...updatedSegments[idx], imagePath: newImagePath };
            saveProject({ segments: updatedSegments });
          }}
          onEditPrompt={imageGen.updatePrompt}
          isLoading={imageGen.isLoading}
          systemPrompt={imageSystemPrompt}
          setSystemPrompt={setImageSystemPrompt}
        />
      )}

      {currentStage === 'VIDEOS' && (
        <div className="space-y-4">
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle>Vídeo Clips</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gerando clips de vídeo a partir das imagens com o modelo {selectedModelConfig?.name}.
                {segments.filter(s => s.videoPath).length}/{segments.length} clips prontos.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {segments.map((seg, i) => {
              const status = videoClipGen.clipStatuses.get(i) || (seg.videoPath ? 'completed' : 'pending')
              return (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Clip {i + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          status === 'completed' ? 'default' :
                            status === 'generating' ? 'secondary' :
                              status === 'error' ? 'destructive' : 'outline'
                        }>
                          {status === 'completed' ? '✓' : status === 'generating' ? '⟳' : status === 'error' ? '✗' : '…'}
                        </Badge>
                        {seg.videoPath && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => videoClipGen.regenerate(i, {
                              modelId: videoModel,
                              projectId: project.currentProjectId,
                              projectName: title
                            }, (newSegs) => saveProject({ segments: newSegs }))}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {seg.videoPath && (
                      <video
                        src={seg.videoPath}
                        controls
                        className="w-full rounded-md"
                        preload="metadata"
                      />
                    )}
                    {seg.imagePath && !seg.videoPath && (
                      <img
                        src={seg.imagePath}
                        alt={`Segment ${i + 1}`}
                        className="w-full rounded-md opacity-50"
                      />
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">{seg.text}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {currentStage === 'RENDER' && videoGen.videoProps && (
        <VideoStage
          videoProps={videoGen.videoProps}
          captionStyle={captionStyle}
          setCaptionStyle={setCaptionStyle}
          onRegenerate={handleGenerateVideo}
          onRender={handleRenderVideo}
          isGenerating={videoGen.isGenerating}
          isRendering={videoGen.isRendering}
          renderProgress={videoGen.renderProgress}
          transitionOverride={transitionOverride}
          setTransitionOverride={setTransitionOverride}
          videoVolume={videoVolume}
          setVideoVolume={setVideoVolume}
          showVideoVolume={true}
          compositionId="CaptionedVideoFull"
        />
      )}

      {currentStage === 'DOWNLOAD' && (
        <DownloadStage
          title="Download Completo"
          description="Baixe todos os arquivos (imagens, vídeos, áudio e roteiro) em um arquivo ZIP."
          onDownload={handleDownloadZip}
          isDownloading={download.isDownloading}
          projectName={scriptText.substring(0, 30)}
        />
      )}
    </StoryFlowBase>
  )
}

function determineStageFullVideo(data: LoadedProjectData, consistency: boolean): string {
  if (data.segments?.some(s => s.videoPath)) return 'RENDER'
  if (data.segments?.some(s => s.imagePath)) return 'VIDEOS'

  if (data.segments?.some(s => s.imagePrompt)) {
    if (consistency) {
      if (!data.entities || data.entities.length === 0 || !data.entities.every((e: EntityAsset) => e.status === 'completed')) {
        return 'ENTITIES'
      }
    }
    return 'IMAGES'
  }

  if (data.segments && data.segments.length > 0) return 'DESCRIPTIONS'
  if (data.transcriptionResults && data.transcriptionResults.length > 0) return 'SPLIT'
  if (data.audioBatches && data.audioBatches.some(b => b.status === 'completed')) return 'TRANSCRIPTION'

  return 'INPUT'
}
