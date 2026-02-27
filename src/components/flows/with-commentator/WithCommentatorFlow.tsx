"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { StageControls } from "@/components/shared/StageControls"
import { RefreshCw, Pencil, Check, X, Loader2 } from "lucide-react"
import { useImageGeneration } from "@/lib/flows/use-image-generation"
import { useAudioGeneration } from "@/lib/flows/use-audio-generation"
import { useTranscription } from "@/lib/flows/use-transcription"
import { useVideoGeneration } from "@/lib/flows/use-video-generation"
import { useProject, useDownload, LoadedProjectData, determineStage } from "@/lib/flows/use-project"
import {
  Segment,
  CommentatorConfig,
  DEFAULT_SEGMENT_SIZE_COMMENTATOR,
  CaptionStyle
} from "@/lib/flows/types"

import { COMMENTATOR_IMAGE_GENERATION_PROMPT } from "@/lib/ai/prompts/prompts"
import { splitTextIntoBatches } from "@/lib/ai/utils/text-splitter"
import { cn } from "@/lib/utils"
import CommentatorConfigComponent from "./CommentatorConfig"

type Stage = 'INPUT' | 'COMMENTATOR' | 'COMMENTS' | 'DESCRIPTIONS' | 'IMAGES' | 'AUDIO' | 'TRANSCRIPTION' | 'VIDEO' | 'DOWNLOAD'

const STAGE_ORDER: Stage[] = ['INPUT', 'COMMENTATOR', 'COMMENTS', 'DESCRIPTIONS', 'IMAGES', 'AUDIO', 'TRANSCRIPTION', 'VIDEO', 'DOWNLOAD']
const STEPS = ["Entrada", "Comentador", "Comentários", "Descrições", "Cenas", "Áudio", "Transcrição", "Vídeo"]

interface WithCommentatorFlowProps {
  onBack: () => void
  projectId?: string
}

export default function WithCommentatorFlow({ onBack, projectId }: WithCommentatorFlowProps) {
  const [currentStage, setCurrentStage] = useState<Stage>('INPUT')

  const [title, setTitle] = useState("")
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([DEFAULT_SEGMENT_SIZE_COMMENTATOR])
  const [language, setLanguage] = useState("portuguese brasilian")
  const [segments, setSegments] = useState<Segment[]>([])
  const [commentator, setCommentator] = useState<CommentatorConfig | undefined>()
  const [imageSystemPrompt, setImageSystemPrompt] = useState("")
  const [audioSystemPrompt, setAudioSystemPrompt] = useState("")
  const [audioVoiceNarrator, setAudioVoiceNarrator] = useState("nPczCjzI2devNBz1zQrb")
  const [audioVoiceCommentator, setAudioVoiceCommentator] = useState("Clyde")
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)
  const [isLoading, setIsLoading] = useState(false)

  const hasAutoCheckedTranscription = useRef(false)

  const generatedAudioContent = useMemo(() => {
    if (!segments.some(s => s.type)) return ""
    let content = ""
    segments.forEach(seg => {
      if (seg.type === 'scene_text') {
        content += `narrator: ${seg.text}\n`
      } else if (seg.type === 'comment') {
        content += `commentator: ${seg.text}\n`
      }
    })
    return content
  }, [segments])

  const expectedBatches = useMemo(() => {
    if (!generatedAudioContent) return []
    return splitTextIntoBatches(generatedAudioContent, 2000, audioSystemPrompt)
  }, [generatedAudioContent, audioSystemPrompt])

  const imageGen = useImageGeneration(
    segments,
    setSegments,
    {
      systemPrompt: imageSystemPrompt,
      referenceImage: commentator?.appearance?.imageUrl,
      buildPrompt: (originalPrompt) => {
        if (commentator?.appearance?.imageUrl) {
          return COMMENTATOR_IMAGE_GENERATION_PROMPT(originalPrompt)
        }
        return originalPrompt
      }
    }
  )

  const audioGen = useAudioGeneration({
    type: 'multi',
    getText: () => generatedAudioContent,
    voices: { narrator: audioVoiceNarrator, commentator: audioVoiceCommentator },
    systemPrompt: audioSystemPrompt,
    projectId: projectId || 'temp',
    projectName: title
  })

  const transcription = useTranscription(audioGen.batches, language)

  const videoGen = useVideoGeneration({
    getSegments: () => segments.map((seg, i) => ({
      id: `seg-${i}`,
      text: seg.text,
      imageUrl: seg.imagePath || ''
    })),
    audioBatches: audioGen.batches,
    transcriptionResults: transcription.results
  })

  const download = useDownload()

  const project = useProject({
    projectId,
    flowType: 'with-commentator',
    getProjectData: () => ({
      name: title,
      consistency: false,
      scriptText,
      segmentSize: segmentSize[0],
      language,
      style: imageSystemPrompt,
      voice: audioVoiceNarrator,
      segments,
      commentator: commentator ? { ...commentator, voice: audioVoiceCommentator } : undefined,
      audioUrls: audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
      audioBatches: audioGen.batches,
      audioSystemPrompt,
      transcriptionResults: transcription.results.filter(r => audioGen.batches.some(b => b.url === r.url))
    }),
    onLoad: (data: LoadedProjectData) => {
      if (data.name) setTitle(data.name)
      setScriptText(data.scriptText)
      if (data.segmentSize) setSegmentSize([data.segmentSize])
      if (data.language) setLanguage(data.language)
      if (data.style) setImageSystemPrompt(data.style)
      if (data.voice) setAudioVoiceNarrator(data.voice)
      if (data.segments) setSegments(data.segments)
      if (data.commentator) {
        setCommentator(data.commentator)
        if (data.commentator.voice) setAudioVoiceCommentator(data.commentator.voice)
      }
      if (data.audioBatches) audioGen.setBatches(data.audioBatches)
      if (data.audioSystemPrompt) setAudioSystemPrompt(data.audioSystemPrompt)
      if (data.transcriptionResults) transcription.setResults(data.transcriptionResults)

      const stage = determineStage(data, 'with-commentator')
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

  useEffect(() => {
    if (
      currentStage === 'TRANSCRIPTION' &&
      audioGen.batches.length > 0 &&
      transcription.results.length === 0 &&
      !transcription.isLoading &&
      !hasAutoCheckedTranscription.current
    ) {
      hasAutoCheckedTranscription.current = true
      transcription.transcribe()
    }
  }, [currentStage, audioGen.batches, transcription.results, transcription.isLoading])

  const hasComments = segments.some(s => s.type === 'comment')
  const hasImagePrompts = segments.some(s => s.imagePrompt)
  const hasImages = segments.some(s => s.imagePath)

  const maxAllowedStep = useMemo(() => {
    if (videoGen.videoProps) return 7;
    if (transcription.results.length > 0) return 6;
    if (audioGen.batches.some(b => b.status === 'completed' && b.url)) return 5;
    if (hasImagePrompts) return 4;
    if (hasComments) return 3;
    if (commentator) return 2;
    if (segments.length > 0) return 1;
    return 0;
  }, [
    videoGen.videoProps,
    transcription.results.length,
    audioGen.batches,
    hasImagePrompts,
    hasComments,
    commentator,
    segments.length
  ])

  const currentStepIndex = STAGE_ORDER.indexOf(currentStage)

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

      const newSegments: Segment[] = splitData.segments.map((text: string) => ({ text }))
      setSegments(newSegments)
      setCurrentStage('COMMENTATOR')
      await project.save({ segments: newSegments })
    } catch (error) {
      console.error("Splitting error:", error)
      alert("Failed to split scenes")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateComments = async () => {
    if (!commentator || segments.length === 0) return
    setIsLoading(true)
    try {
      const commentatorDescription = `Name: ${commentator.name}. Personality: ${commentator.personality}`

      const res = await fetch("/api/generate/commentator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segments.map(s => s.text),
          commentatorDescription
        }),
      })
      if (!res.ok) throw new Error("Failed to generate comments")
      const data = await res.json()
      setSegments(data.segments)
      setCurrentStage('COMMENTS')
    } catch (e) {
      console.error(e)
      alert("Error generating comments")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateDescriptions = async () => {
    if (!hasComments) return
    setIsLoading(true)
    try {
      const segmentsForApi: Segment[] = segments.map(s =>
        s.type === 'comment'
          ? { ...s, text: `[Commentary by ${commentator?.name}]: ${s.text}` }
          : s
      )

      const res = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segmentsForApi,
          commentatorName: commentator?.name,
          commentatorPersonality: commentator?.personality,
          commentatorImage: commentator?.appearance?.imageUrl,
          language,
          style: imageSystemPrompt
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const updatedSegments: Segment[] = data.segments || segments
      setSegments(updatedSegments)
      setCurrentStage('DESCRIPTIONS')
      await project.save({ segments: updatedSegments })
    } catch (e) {
      console.error(e)
      alert("Error generating descriptions")
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
    await project.save()
  }

  const handleGenerateAudio = async () => {
    if (audioGen.batches.length > 0 && audioGen.batches.every(b => b.status === 'completed' && b.url)) {
      setCurrentStage('AUDIO')
      return
    }
    let activeProjectId = project.currentProjectId
    if (!activeProjectId) {
      const savedProject = await project.save()
      activeProjectId = savedProject?.id
    }
    await audioGen.generate({ projectId: activeProjectId, projectName: title })
    setCurrentStage('AUDIO')
  }

  const handleTranscribe = async () => {
    await transcription.transcribe()
    await project.save()
    setCurrentStage('TRANSCRIPTION')
  }

  const handleGenerateVideo = async () => {
    try {
      await videoGen.generateVideo()
      setCurrentStage('VIDEO')
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
        segments,
        audioUrls: audioGen.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
        transcriptionResults: transcription.results,
        filename: `story-with-commentator-${Date.now()}.zip`
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
      onExecute = handleSplitScenes
      isExecuting = isLoading
      canExecute = !!scriptText.trim()
      executeLabel = "Dividir Cenas"
      canNext = segments.length > 0
      break
    case 'COMMENTATOR':
      onExecute = () => setCurrentStage('COMMENTS')
      isExecuting = false
      canExecute = !!commentator
      executeLabel = "Confirmar Comentador"
      canNext = !!commentator
      break
    case 'COMMENTS':
      onExecute = handleGenerateComments
      isExecuting = isLoading
      canExecute = !!commentator
      executeLabel = hasComments ? "Regerar Comentários" : "Gerar Comentários"
      canNext = hasComments
      break
    case 'DESCRIPTIONS':
      onExecute = handleGenerateDescriptions
      isExecuting = isLoading
      canExecute = hasComments
      executeLabel = hasImagePrompts ? "Regerar Descrições" : "Gerar Descrições"
      canNext = hasImagePrompts
      break
    case 'IMAGES':
      onExecute = handleGenerateImages
      isExecuting = imageGen.isLoading
      canExecute = hasImagePrompts
      executeLabel = "Gerar Imagens"
      canNext = hasImagePrompts
      break
    case 'AUDIO':
      onExecute = handleGenerateAudio
      isExecuting = audioGen.isLoading
      canExecute = hasComments
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
      title="História com Comentador"
      steps={STEPS}
      currentStep={currentStepIndex}
      onStepClick={handleStepClick}
      onBack={onBack}
      onSave={project.save}
      isSaving={project.isSaving}
      canSave={!!scriptText.trim()}
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
          audioVoice={audioVoiceNarrator}
          setAudioVoice={setAudioVoiceNarrator}
        />
      )}

      {currentStage === 'COMMENTATOR' && (
        <>
          <StageControls
            onRegenerate={() => { }}
            onNext={handleGenerateComments}
            nextLabel="Gerar Comentários"
            hideRegenerate
            isNextLoading={isLoading}
            canGoNext={!!commentator}
          />
          <CommentatorConfigComponent
            initialData={commentator}
            onSave={(config) => {
              setCommentator(config)
              setCurrentStage('COMMENTS')
            }}
            onCancel={() => setCurrentStage('INPUT')}
          />
        </>
      )}

      {currentStage === 'COMMENTS' && (
        <>
          <StageControls
            onRegenerate={handleGenerateComments}
            onNext={() => setCurrentStage('DESCRIPTIONS')}
            nextLabel="Próxima Etapa: Descrições Visuais"
            isRegenerating={isLoading}
            canGoNext={hasComments}
          />
          <Card>
            <CardHeader><CardTitle>Gerar Comentários</CardTitle></CardHeader>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground mb-4">Clique em "Regerar Etapa" para que o comentador analise e comente.</p>
              {hasComments && (
                <div className="text-left mt-6 space-y-4">
                  {segments.filter(s => s.type).map((seg, index) => (
                    <div key={index} className={cn("p-4 rounded-lg", seg.type === 'comment' ? "bg-blue-50 border border-blue-100" : "bg-muted/50")}>
                      <div className="flex gap-3">
                        {seg.type === 'comment' && commentator?.appearance?.imageUrl && (
                          <img src={commentator.appearance.imageUrl} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                        )}
                        <div>
                          <p className={cn("text-sm", seg.type === 'comment' ? "text-blue-800 italic" : "")}>{seg.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {currentStage === 'DESCRIPTIONS' && (
        <>
          <StageControls
            onRegenerate={handleGenerateDescriptions}
            onNext={() => setCurrentStage('IMAGES')}
            nextLabel="Próxima Etapa: Imagens"
            isRegenerating={isLoading}
            canGoNext={hasImagePrompts}
          />
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Descrições Geradas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!hasImagePrompts ? (
                  <div className="text-center py-4 text-muted-foreground">Clique em "Regerar Etapa" para criar as descrições.</div>
                ) : (
                  segments.filter(s => s.type).map((seg, i) => (
                    <div key={i} className={cn("p-4 rounded-lg flex flex-col gap-3", seg.type === 'comment' ? "bg-blue-50 border border-blue-100" : "bg-muted/50")}>
                      <div className="flex gap-3 border-b pb-3 border-border/10">
                        {seg.type === 'comment' && commentator?.appearance?.imageUrl && (
                          <img src={commentator.appearance.imageUrl} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                        )}
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            {seg.type === 'comment' ? 'Comentário' : `Cena ${i + 1}`}
                          </span>
                          <p className={cn("text-sm", seg.type === 'comment' ? "text-blue-800 italic" : "")}>{seg.text}</p>
                        </div>
                      </div>
                      {seg.imagePrompt && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Descrição Visual
                          </span>
                          <p className="text-sm italic text-muted-foreground bg-background/50 p-2 rounded">{seg.imagePrompt}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {currentStage === 'IMAGES' && (
        <>
          <StageControls
            onRegenerate={handleGenerateImages}
            onNext={() => setCurrentStage('AUDIO')}
            nextLabel="Próxima Etapa: Gerar Áudios"
            isRegenerating={imageGen.isLoading}
            canGoNext={!imageGen.isLoading && hasImagePrompts}
          />
          <div className="space-y-6">
            <div className="grid gap-6">
              {segments.filter(s => s.type).map((seg, index) => {
                const status = imageGen.imageStatuses.get(index)
                return (
                  <Card key={index} className={seg.type === 'comment' ? 'border-blue-200' : ''}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex gap-3">
                        {seg.type === 'comment' && commentator?.appearance?.imageUrl && (
                          <img src={commentator.appearance.imageUrl} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                        )}
                        <p className={cn("text-sm", seg.type === 'comment' ? "text-blue-800 italic" : "")}>{seg.text}</p>
                      </div>
                      {seg.imagePrompt && (
                        <div className="border-t pt-4 mt-4">
                          <p className="text-xs text-muted-foreground italic mb-2">{seg.imagePrompt}</p>
                          <div className="mt-4">
                            {seg.imagePath && status !== 'generating' ? (
                              <div className="relative group">
                                <img src={seg.imagePath} alt="Scene" className="w-full rounded-lg" />
                                <Button size="icon" variant="secondary" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={async () => {
                                  const newImagePath = await imageGen.regenerate(index, { projectId: project.currentProjectId, projectName: title });
                                  const updatedSegments = [...segments];
                                  updatedSegments[index] = { ...updatedSegments[index], imagePath: newImagePath };
                                  project.save({ segments: updatedSegments });
                                }}>
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : status === 'generating' ? (
                              <div className="w-full h-48 bg-muted rounded-lg animate-pulse" />
                            ) : (
                              <div className="w-full h-48 bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                                {status === 'error' ? (
                                  <>
                                    <span>Erro ao gerar</span>
                                    <Button variant="outline" size="sm" onClick={() => imageGen.regenerate(index, { projectId: project.currentProjectId, projectName: title })}>
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Tentar Novamente
                                    </Button>
                                  </>
                                ) : 'Aguardando geração'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}

      {currentStage === 'AUDIO' && (
        <AudioStage
          batches={audioGen.batches}
          expectedBatches={expectedBatches}
          onGenerate={handleGenerateAudio}
          onRegenerateBatch={(index) => audioGen.regenerateBatch(index, expectedBatches, { projectId: project.currentProjectId, projectName: title })}
          isLoading={audioGen.isLoading}
          voiceNarrator={audioVoiceNarrator}
          setVoiceNarrator={setAudioVoiceNarrator}
          voiceCommentator={audioVoiceCommentator}
          setVoiceCommentator={setAudioVoiceCommentator}
          systemPrompt={audioSystemPrompt}
          setSystemPrompt={setAudioSystemPrompt}
          showMultiVoice
        />
      )}

      {currentStage === 'TRANSCRIPTION' && (
        <TranscriptionStage
          audioBatches={audioGen.batches}
          results={transcription.results}
          onTranscribe={handleTranscribe}
          onRetry={transcription.retry}
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
          description="Seu projeto está pronto! Clique no botão abaixo para baixar todos os arquivos."
          onDownload={handleDownloadZip}
          isDownloading={download.isDownloading}
          projectName={scriptText.substring(0, 30)}
        />
      )}
    </StoryFlowBase>
  )
}
