"use client"

import { useState, useEffect, useMemo } from "react"
import {
  StoryFlowBase,
  InputStage,
  ImagesStage,
  AudioStage,
  TranscriptionStage,
  VideoStage,
  DownloadStage,
  EntitiesStage,
  DEFAULT_CAPTION_STYLE
} from "@/components/flows/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { StageControls } from "@/components/shared/StageControls"
import { useImageGeneration } from "@/lib/flows/use-image-generation"
import { useAudioGeneration } from "@/lib/flows/use-audio-generation"
import { useTranscription } from "@/lib/flows/use-transcription"
import { useVideoGeneration } from "@/lib/flows/use-video-generation"
import { useProject, useDownload, LoadedProjectData } from "@/lib/flows/use-project"
import { GENERATE_ENTITY_IMAGE_PROMPT, GENERATE_SEGMENT_IMAGE_PROMPT } from "@/lib/ai/prompts/prompts"
import {
  VisualDescription,
  DEFAULT_SEGMENT_SIZE,
  CaptionStyle,
  VideoSegment,
  EntityAsset,
  ProjectData
} from "@/lib/flows/types"


import { toast } from "sonner"

type Stage = 'INPUT' | 'DESCRIPTIONS' | 'ENTITIES' | 'IMAGES' | 'AUDIO' | 'TRANSCRIPTION' | 'VIDEO' | 'DOWNLOAD'

const getStageOrder = (consistency: boolean): Stage[] => consistency
  ? ['INPUT', 'DESCRIPTIONS', 'ENTITIES', 'IMAGES', 'AUDIO', 'TRANSCRIPTION', 'VIDEO', 'DOWNLOAD']
  : ['INPUT', 'DESCRIPTIONS', 'IMAGES', 'AUDIO', 'TRANSCRIPTION', 'VIDEO', 'DOWNLOAD']

const getSteps = (consistency: boolean): string[] => consistency
  ? ["Entrada", "Descrições", "Entidades", "Cenas", "Áudio", "Transcrição", "Vídeo", "Download"]
  : ["Entrada", "Descrições", "Cenas", "Áudio", "Transcrição", "Vídeo", "Download"]

interface SimpleStoryFlowProps {
  onBack: () => void
  projectId?: string
}

export default function SimpleStoryFlow({ onBack, projectId }: SimpleStoryFlowProps) {
  const [currentStage, setCurrentStage] = useState<Stage>('INPUT')

  const [title, setTitle] = useState("")
  const [consistency, setConsistency] = useState(false)
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([DEFAULT_SEGMENT_SIZE])
  const [language, setLanguage] = useState("english")
  const [segments, setSegments] = useState<string[]>([])
  const [entities, setEntities] = useState<EntityAsset[]>([])
  const [visualDescriptions, setVisualDescriptions] = useState<VisualDescription[]>([])
  const [imageSystemPrompt, setImageSystemPrompt] = useState("")
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb")
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)
  const [isLoading, setIsLoading] = useState(false)

  const STAGE_ORDER = getStageOrder(consistency)
  const STEPS = getSteps(consistency)

  const imageGen = useImageGeneration(
    visualDescriptions,
    setVisualDescriptions,
    {
      systemPrompt: "",
      entities,
      buildPrompt: (original) => GENERATE_SEGMENT_IMAGE_PROMPT(original, undefined, false, imageSystemPrompt)
    }
  )

  const audioGen = useAudioGeneration({
    type: 'single',
    getText: () => scriptText,
    voice: audioVoice
  })

  const transcription = useTranscription(audioGen.batches, language)

  const videoGen = useVideoGeneration({
    getSegments: () => segments.map((text, i) => ({
      id: `seg-${i}`,
      text,
      imageUrl: visualDescriptions[i]?.imageUrl || ''
    })),
    audioBatches: audioGen.batches,
    transcriptionResults: transcription.results
  })

  const download = useDownload()

  const project = useProject({
    projectId,
    flowType: 'simple',
    getProjectData: () => ({
      name: title,
      scriptText,
      consistency,
      segmentSize: segmentSize[0],
      language,
      style: imageSystemPrompt,
      voice: audioVoice,
      segments,
      entities,
      visualDescriptions,
      audioUrls: audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
      audioBatches: audioGen.batches,
      transcriptionResults: transcription.results
    }),
    onLoad: (data: LoadedProjectData) => {
      if (data.name) setTitle(data.name)
      if (data.consistency !== undefined) setConsistency(data.consistency)
      setScriptText(data.scriptText)
      if (data.segmentSize) setSegmentSize([data.segmentSize])
      if (data.language) setLanguage(data.language)
      if (data.style) setImageSystemPrompt(data.style)
      if (data.voice) setAudioVoice(data.voice)
      if (data.segments) setSegments(data.segments)
      if (data.entities) setEntities(data.entities)
      if (data.visualDescriptions) setVisualDescriptions(data.visualDescriptions)
      if (data.audioBatches) audioGen.setBatches(data.audioBatches)
      if (data.transcriptionResults) transcription.setResults(data.transcriptionResults)

      const stage = project.determineStage({ ...data, consistency: data.consistency !== undefined ? data.consistency : consistency })
      const stageOrder = getStageOrder(data.consistency !== undefined ? data.consistency : consistency)
      if (stageOrder.includes(stage as Stage)) {
        setCurrentStage(stage as Stage)
      }
    }
  })

  useEffect(() => {
    if (projectId && !project.isLoading) {
      project.loadProject(projectId)
    }
  }, [projectId])

  // Self-healing effect: if user toggled consistency AFTER generating descriptions, or loaded an old project
  useEffect(() => {
    if (consistency && entities.length === 0 && visualDescriptions.length > 0) {
      const extracted = new Set<string>();
      visualDescriptions.forEach(desc => {
        if (!desc.imagePrompt) return;
        const matches = desc.imagePrompt.match(/<<([^>]+)>>/g);
        if (matches) {
          matches.forEach(m => extracted.add(m.replace(/<<|>>/g, '')));
        }
      });
      if (extracted.size > 0) {
        const recoveredEntities: EntityAsset[] = Array.from(extracted).map(name => ({
          name,
          status: 'pending' as const
        }));
        setEntities(recoveredEntities);
        setTimeout(() => project.save({ entities: recoveredEntities }), 100);
      }
    }
  }, [consistency, visualDescriptions, entities.length]);

  const saveProject = async (overrides?: Partial<ProjectData>, autoAdvance: boolean = false) => {
    if (!scriptText.trim()) return;
    const saved = await project.save(overrides);
    if (saved) {
      toast.success("Projeto atualizado!", {
        style: { backgroundColor: '#16a34a', color: 'white', border: 'none' }
      });
      if (autoAdvance) {
        // Find next step safely
        const nextIdx = STAGE_ORDER.indexOf(currentStage) + 1;
        if (nextIdx <= maxAllowedStep && STAGE_ORDER[nextIdx]) {
          setCurrentStage(STAGE_ORDER[nextIdx]);
        }
      }
    }
  }

  const currentStepIndex = STAGE_ORDER.indexOf(currentStage)

  const maxAllowedStep = useMemo(() => {
    let offset = consistency ? 1 : 0;
    if (videoGen.videoProps) return 6 + offset; // DOWNLOAD
    if (transcription.results.length > 0) return 5 + offset; // VIDEO
    if (audioGen.batches.some(b => b.status === 'completed' && b.url)) return 4 + offset; // TRANSCRIPTION
    if (visualDescriptions.length > 0 && (!consistency || (entities.length > 0 && entities.every(e => e.status === 'completed')))) return 3 + offset; // AUDIO -> Even if IMAGES are pending, visually they reached AUDIO
    if (visualDescriptions.length > 0 && consistency) return 2; // ENTITIES -> generated descriptions but working on entities
    if (segments.length > 0) return 1; // DESCRIPTIONS -> generated segments
    return 0; // INPUT
  }, [
    videoGen.videoProps,
    transcription.results.length,
    audioGen.batches,
    visualDescriptions.length,
    segments.length,
    consistency,
    entities
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
  const handlePrevStep = () => handleStepClick(currentStepIndex - 1);

  const handleSplitScenes = async () => {
    if (!scriptText.trim()) return
    setIsLoading(true)
    try {
      const splitRes = await fetch("/api/generate/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scriptText, segmentLength: segmentSize[0] }),
      })
      if (!splitRes.ok) throw new Error("Failed to split script")
      const splitData = await splitRes.json()

      setSegments(splitData.segments)
      setVisualDescriptions([]) // Clear old to force regen if changed script
      setCurrentStage('DESCRIPTIONS')
      await saveProject({ segments: splitData.segments, visualDescriptions: [] })
    } catch (error) {
      console.error("Splitting error:", error)
      alert("Failed to split scenes")
    } finally {
      setIsLoading(false)
    }
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

      const descriptions = (descData.visualDescriptions || []).map((desc: VisualDescription) => ({
        ...desc,
        status: 'completed' as const
      }))

      setVisualDescriptions(descriptions)

      if (consistency && descData.entities && Array.isArray(descData.entities)) {
        const initialEntities: EntityAsset[] = descData.entities.map((name: string) => ({
          name,
          status: 'pending' as const
        }))
        setEntities(initialEntities)
        setCurrentStage('ENTITIES')
        await saveProject({ visualDescriptions: descriptions, entities: initialEntities })
      } else {
        setCurrentStage('DESCRIPTIONS') // stays on scenes to review descriptions
        await saveProject({ visualDescriptions: descriptions })
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

      // Step 1: Generate character sheets (descriptions)
      const descRes = await fetch("/api/generate/entities/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities: entityNames, segments }),
      })
      if (!descRes.ok) throw new Error("Failed to generate entity descriptions")
      const descData = await descRes.json()

      // Update state with descriptions and mark as generating images
      const enhancedEntities = entities.map(e => {
        const generated = descData.entities.find((ge: any) => ge.name === e.name)
        if (generated) {
          return { ...e, description: generated.description, status: 'generating' as const }
        }
        return { ...e, status: 'generating' as const }
      })
      setEntities(enhancedEntities)

      // Step 2: Concurrently generate an image for each entity using `/api/generate/images`
      const imagePromises = enhancedEntities.map(async (e, idx) => {
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

  const handleGenerateAudio = async () => {
    await audioGen.generate()
    setCurrentStage('AUDIO')
    setTimeout(() => saveProject(), 100)
  }

  const handleTranscribe = async () => {
    await transcription.transcribe()
    setCurrentStage('TRANSCRIPTION')
    setTimeout(() => saveProject(), 100)
  }

  const handleGenerateVideo = async () => {
    try {
      await videoGen.generateVideo()
      setCurrentStage('VIDEO')
      setTimeout(() => saveProject(), 100)
    } catch (error: any) {
      alert(`Falha ao gerar vídeo: ${error.message}`)
    }
  }

  const handleRenderVideo = async () => {
    try {
      await videoGen.renderVideo(captionStyle)
    } catch (error: any) {
      alert(`Falha na renderização: ${error.message}`)
    }
  }

  const handleDownloadZip = async () => {
    try {
      await download.downloadZip({
        visualDescriptions,
        segments,
        audioUrls: audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
        transcriptionResults: transcription.results,
        filename: `simple-story-${Date.now()}.zip`
      })
    } catch {
      alert("Failed to download ZIP")
    }
  }

  // Execution and Navigation State Setup
  let onExecute: (() => void) | undefined
  let isExecuting = false
  let canExecute = false
  let executeLabel = "Executar"
  let canNext = false

  switch (currentStage) {
    case 'INPUT':
      onExecute = handleSplitScenes
      isExecuting = isLoading
      canExecute = !!scriptText.trim()
      executeLabel = "Dividir Cenas"
      canNext = segments.length > 0
      break
    case 'DESCRIPTIONS':
      onExecute = handleGenerateDescriptions
      isExecuting = isLoading
      canExecute = segments.length > 0
      executeLabel = visualDescriptions.length > 0 ? "Regerar Descrições" : "Gerar Descrições"
      canNext = visualDescriptions.length > 0
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
      canExecute = visualDescriptions.length > 0
      executeLabel = visualDescriptions.every(d => d.status === 'completed') ? "Regerar Imagens" : "Gerar Imagens"
      canNext = visualDescriptions.length > 0
      break
    case 'AUDIO':
      onExecute = handleGenerateAudio
      isExecuting = audioGen.isLoading
      canExecute = segments.length > 0
      executeLabel = audioGen.batches.some(b => b.status === 'completed' && b.url) ? "Regerar Áudio" : "Gerar Áudio"
      canNext = audioGen.batches.some(b => b.status === 'completed' && b.url)
      break
    case 'TRANSCRIPTION':
      onExecute = handleTranscribe
      isExecuting = transcription.isLoading
      canExecute = audioGen.batches.some(b => b.status === 'completed' && b.url)
      executeLabel = "Gerar Transcrição"
      canNext = transcription.results.length > 0
      break
    case 'VIDEO':
      onExecute = handleGenerateVideo
      isExecuting = videoGen.isGenerating
      canExecute = transcription.results.length > 0
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

  return (
    <StoryFlowBase
      title="História Simples"
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
        <InputStage
          title={title}
          setTitle={setTitle}
          scriptText={scriptText}
          setScriptText={setScriptText}
          segmentSize={segmentSize}
          setSegmentSize={setSegmentSize}
          language={language}
          setLanguage={setLanguage}
          imageSystemPrompt={imageSystemPrompt}
          setImageSystemPrompt={setImageSystemPrompt}
          audioVoice={audioVoice}
          setAudioVoice={setAudioVoice}
          consistency={consistency}
          setConsistency={setConsistency}
        />
      )}

      {currentStage === 'DESCRIPTIONS' && (
        <div className="space-y-4">
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle>Cenas Divididas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">O texto foi dividido em {segments.length} cenas. Para prosseguir, clique em "{visualDescriptions.length > 0 ? 'Regerar Descrições' : 'Gerar Descrições'}" abaixo para criar prompts visuais baseados nelas.</p>
            </CardContent>
          </Card>

          {segments.map((segment, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Cena {i + 1}</div>
                <p className="text-sm">{segment}</p>
                {visualDescriptions[i] && (
                  <div className="bg-muted p-3 rounded-md text-sm italic text-muted-foreground border border-border/50">
                    <span className="font-semibold not-italic block mb-1 text-xs">Prompt Visual:</span>
                    {visualDescriptions[i].imagePrompt}
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
          isLoading={isLoading}
        />
      )}

      {currentStage === 'IMAGES' && (
        <ImagesStage
          descriptions={visualDescriptions}
          segments={segments}
          onGenerateAll={handleGenerateImages}
          onRegenerate={async (idx) => { await imageGen.regenerate(idx, { projectId: project.currentProjectId, projectName: title }); saveProject(); }}
          onEditPrompt={imageGen.updatePrompt}
          isLoading={imageGen.isLoading}
          systemPrompt={imageSystemPrompt}
          setSystemPrompt={setImageSystemPrompt}
        />
      )}

      {currentStage === 'AUDIO' && (
        <AudioStage
          batches={audioGen.batches}
          onGenerate={handleGenerateAudio}
          onRegenerateBatch={async (idx) => { await audioGen.regenerateBatch(idx); saveProject(); }}
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

      {currentStage === 'VIDEO' && videoGen.videoProps && (
        <VideoStage
          videoProps={videoGen.videoProps}
          captionStyle={captionStyle}
          setCaptionStyle={setCaptionStyle}
          onRegenerate={handleGenerateVideo}
          onRender={handleRenderVideo}
          isGenerating={videoGen.isGenerating}
          isRendering={videoGen.isRendering}
          renderProgress={videoGen.renderProgress}
        />
      )}

      {currentStage === 'DOWNLOAD' && (
        <DownloadStage
          title="Download Completo"
          description="Baixe todos os arquivos (imagens, áudio e roteiro) em um arquivo ZIP."
          onDownload={handleDownloadZip}
          isDownloading={download.isDownloading}
          projectName={scriptText.substring(0, 30)}
        />
      )}
    </StoryFlowBase>
  )
}
