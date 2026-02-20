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
import {
  VisualDescription,
  DEFAULT_SEGMENT_SIZE,
  CaptionStyle,
  VideoSegment
} from "@/lib/flows/types"
import { DEFAULT_IMAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts/image-prompts"

import { toast } from "sonner"

type Stage = 'INPUT' | 'DESCRIPTIONS' | 'IMAGES' | 'AUDIO' | 'TRANSCRIPTION' | 'VIDEO' | 'DOWNLOAD'

const STAGE_ORDER: Stage[] = ['INPUT', 'DESCRIPTIONS', 'IMAGES', 'AUDIO', 'TRANSCRIPTION', 'VIDEO', 'DOWNLOAD']
const STEPS = ["Entrada", "Descrições", "Imagens", "Áudio", "Transcrição", "Vídeo", "Download"]

interface SimpleStoryFlowProps {
  onBack: () => void
  projectId?: string
}

export default function SimpleStoryFlow({ onBack, projectId }: SimpleStoryFlowProps) {
  const [currentStage, setCurrentStage] = useState<Stage>('INPUT')

  const [title, setTitle] = useState("")
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([DEFAULT_SEGMENT_SIZE])
  const [language, setLanguage] = useState("english")
  const [style, setStyle] = useState("")
  const [segments, setSegments] = useState<string[]>([])
  const [visualDescriptions, setVisualDescriptions] = useState<VisualDescription[]>([])
  const [imageSystemPrompt, setImageSystemPrompt] = useState(DEFAULT_IMAGE_SYSTEM_PROMPT)
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb")
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)
  const [isLoading, setIsLoading] = useState(false)

  const imageGen = useImageGeneration(
    visualDescriptions,
    setVisualDescriptions,
    { systemPrompt: imageSystemPrompt }
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
      segmentSize: segmentSize[0],
      language,
      style,
      segments,
      visualDescriptions,
      audioUrls: audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
      audioBatches: audioGen.batches,
      transcriptionResults: transcription.results
    }),
    onLoad: (data: LoadedProjectData) => {
      if (data.name) setTitle(data.name)
      setScriptText(data.scriptText)
      if (data.segmentSize) setSegmentSize([data.segmentSize])
      if (data.language) setLanguage(data.language)
      if (data.style) setStyle(data.style)
      if (data.segments) setSegments(data.segments)
      if (data.visualDescriptions) setVisualDescriptions(data.visualDescriptions)
      if (data.audioBatches) audioGen.setBatches(data.audioBatches)
      if (data.transcriptionResults) transcription.setResults(data.transcriptionResults)

      const stage = project.determineStage(data)
      if (STAGE_ORDER.includes(stage as Stage)) {
        setCurrentStage(stage as Stage)
      }
    }
  })

  useEffect(() => {
    if (projectId && !project.isLoading) {
      project.loadProject(projectId)
    }
  }, [projectId])

  const saveProject = async () => {
    if (!scriptText.trim()) return;
    const saved = await project.save();
    if (saved) {
      toast.success("Projeto atualizado");
    }
  }

  const currentStepIndex = STAGE_ORDER.indexOf(currentStage)

  const maxAllowedStep = useMemo(() => {
    if (videoGen.videoProps) return 6; // DOWNLOAD
    if (transcription.results.length > 0) return 5; // VIDEO
    if (audioGen.batches.some(b => b.status === 'completed' && b.url)) return 4; // TRANSCRIPTION
    if (visualDescriptions.length > 0) return 3; // AUDIO -> Even if IMAGES are pending, visually they reached AUDIO
    if (segments.length > 0) return 2; // IMAGES -> if we have segments, user split scenes and is in DESCRIPTIONS/IMAGES loop
    return 0; // INPUT
  }, [
    videoGen.videoProps,
    transcription.results.length,
    audioGen.batches,
    visualDescriptions.length,
    segments.length
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
      setTimeout(() => saveProject(), 100)
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
        body: JSON.stringify({ segments, language, style: '' }),
      })
      if (!descRes.ok) throw new Error("Failed to generate descriptions")
      const descData = await descRes.json()

      const descriptions = (descData.visualDescriptions || []).map((desc: VisualDescription) => ({
        ...desc,
        status: 'completed' as const
      }))

      setVisualDescriptions(descriptions)
      setCurrentStage('DESCRIPTIONS') // stays on scenes to review descriptions
      setTimeout(() => saveProject(), 100)
    } catch (error) {
      console.error("Generation error:", error)
      alert("Failed to generate descriptions")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateImages = async () => {
    await imageGen.generateAll()
    setCurrentStage('IMAGES')
    setTimeout(() => saveProject(), 100)
  }

  const handleGenerateAudio = async () => {
    if (audioGen.batches.length > 0 && audioGen.batches.every(b => b.status === 'completed' && b.url)) {
      setCurrentStage('AUDIO')
      return
    }
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
    case 'IMAGES':
      onExecute = handleGenerateImages
      isExecuting = imageGen.isLoading
      canExecute = visualDescriptions.length > 0
      executeLabel = "Gerar Imagens"
      canNext = visualDescriptions.length > 0
      break
    case 'AUDIO':
      onExecute = handleGenerateAudio
      isExecuting = audioGen.isLoading
      canExecute = segments.length > 0
      executeLabel = "Gerar Áudio"
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
      onSave={saveProject}
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

      {currentStage === 'IMAGES' && (
        <ImagesStage
          descriptions={visualDescriptions}
          segments={segments}
          onGenerateAll={handleGenerateImages}
          onRegenerate={async (idx) => { await imageGen.regenerate(idx); saveProject(); }}
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
