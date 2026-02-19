
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, Loader2, Pencil, Check, X, RefreshCw, Download, Play } from "lucide-react"
import { FlowStepper } from "@/components/shared/FlowStepper"
import { StageControls } from "@/components/shared/StageControls"
import { ScrollToTop } from "@/components/shared/ScrollToTop"
import { VideoPlayer } from "@/components/video/VideoPlayer"
import { alignVideoProps } from "@/lib/video/aligner"
import { RemotionVideoProps } from "@/lib/video/types"
import { cn } from "@/lib/utils"
import { DEFAULT_IMAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts/image-prompts"

const DEFAULT_SEGMENT_SIZE = 150

type Stage = 'INPUT' | 'DESCRIPTIONS' | 'IMAGES' | 'AUDIO' | 'TRANSCRIPTION' | 'VIDEO' | 'DOWNLOAD'

const STAGE_ORDER: Stage[] = ['INPUT', 'DESCRIPTIONS', 'IMAGES', 'AUDIO', 'TRANSCRIPTION', 'VIDEO', 'DOWNLOAD']
const STEPS = ["Roteiro", "Descrições", "Imagens", "Áudio", "Transcrição", "Vídeo", "Download"]

interface GenerateResponse {
  segments: string[]
  visualDescriptions?: Array<{ imagePrompt: string; imageUrl?: string; status: 'pending' | 'generating' | 'completed' | 'error' }>
  audioUrls?: string[]
}

interface SimpleStoryFlowProps {
  onBack: () => void
  projectId?: string
}

export default function SimpleStoryFlow({ onBack, projectId }: SimpleStoryFlowProps) {
  // Stage State
  const [currentStage, setCurrentStage] = useState<Stage>('INPUT')

  // Data State
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([DEFAULT_SEGMENT_SIZE])
  const [language, setLanguage] = useState("english")
  const [style, setStyle] = useState("")
  const [response, setResponse] = useState<GenerateResponse | null>(null)

  // Audio State
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb")
  const [audioBatches, setAudioBatches] = useState<Array<{ index: number; text: string; status: 'pending' | 'generating' | 'completed' | 'error'; url?: string }>>([])
  const [isAudioLoading, setIsAudioLoading] = useState(false)

  // Transcription State
  const [transcriptionResults, setTranscriptionResults] = useState<Array<{ url: string; status: 'completed' | 'error'; transcriptionUrl?: string; data?: any }>>([])
  const [isTranscribing, setIsTranscribing] = useState(false)

  // Video State
  const [videoProps, setVideoProps] = useState<RemotionVideoProps | null>(null)
  const [isVideoGenerating, setIsVideoGenerating] = useState(false)

  // Image Generation State
  const [imageSystemPrompt, setImageSystemPrompt] = useState(DEFAULT_IMAGE_SYSTEM_PROMPT)

  // Loading States
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Project Management State
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isProjectLoading, setIsProjectLoading] = useState(!!projectId)

  // Edit State
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")
  const [regeneratingSegmentIndex, setRegeneratingSegmentIndex] = useState<number | null>(null)

  // Caption Styling State
  const [captionStyle, setCaptionStyle] = useState({
    fontSize: 60,
    fontFamily: "TikTok Sans, sans-serif",
    fontWeight: 800,
    maxWordsPerLine: 3,
    uppercase: true,
    highlightColor: "#FFE81F"
  })

  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState<{ progress: number; stage: string; renderedFrames?: number; totalFrames?: number } | null>(null)

  const currentStepIndex = STAGE_ORDER.indexOf(currentStage)

  const playerProps = useMemo(() => {
    if (!videoProps) return null
    return { ...videoProps, captionStyle }
  }, [videoProps, captionStyle])

  useEffect(() => {
    if (projectId) {
      setIsProjectLoading(true)
      loadProject(projectId)
    }
  }, [projectId])

  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (res.ok) {
        const project = await res.json()

        setCurrentProjectId(project.id)
        setScriptText(project.scriptText)
        if (project.segmentSize) setSegmentSize([project.segmentSize])
        if (project.language) setLanguage(project.language)
        if (project.style) setStyle(project.style)

        const newResponse: GenerateResponse = { segments: project.segments || [] }
        if (project.visualDescriptions) newResponse.visualDescriptions = project.visualDescriptions
        setResponse(newResponse)

        if (project.audioBatches) {
          setAudioBatches(project.audioBatches)
        } else if (project.audioUrls) {
          setAudioBatches(project.audioUrls.map((url: string, i: number) => ({
            index: i,
            text: `Legacy ${i}`,
            status: 'completed',
            url
          })))
        }

        if (project.transcriptionResults) {
          setTranscriptionResults(project.transcriptionResults)
        }

        // Determine stage
        if (project.transcriptionResults && project.transcriptionResults.length > 0) {
          setCurrentStage('TRANSCRIPTION')
        } else if (audioBatches.some(b => b.status === 'completed')) {
          setCurrentStage('AUDIO')
        } else if (project.visualDescriptions && project.visualDescriptions.length > 0) {
          setCurrentStage('IMAGES')
        } else if (project.segments && project.segments.length > 0) {
          setCurrentStage('DESCRIPTIONS')
        } else {
          setCurrentStage('INPUT')
        }
      }
    } catch (error) {
      console.error("Load error:", error)
    } finally {
      setIsProjectLoading(false)
    }
  }

  const handleSaveProject = async () => {
    if (!scriptText.trim()) return

    setIsSaving(true)
    try {
      const projectData = {
        id: currentProjectId,
        name: scriptText.substring(0, 30) + (scriptText.length > 30 ? "..." : ""),
        flowType: 'simple',
        scriptText,
        segmentSize: segmentSize[0],
        language,
        style,
        segments: response?.segments,
        visualDescriptions: response?.visualDescriptions,
        audioUrls: audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
        audioBatches: audioBatches,
        transcriptionResults
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      })
      if (res.ok) {
        const savedProject = await res.json()
        setCurrentProjectId(savedProject.id)
        alert("Project saved successfully!")
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      console.error("Save error:", error)
      alert("Failed to save project")
    } finally {
      setIsSaving(false)
    }
  }

  const handleStepClick = (index: number) => {
    const isLastStep = index === STEPS.length - 1
    if (index > currentStepIndex && !isLastStep) return
    if (STAGE_ORDER[index]) setCurrentStage(STAGE_ORDER[index])
  }

  // --- STAGE ACTIONS ---

  // Stage 1: Input -> Split & Generate Descriptions
  const handleGenerateDescriptions = async () => {
    if (!scriptText.trim()) return
    setIsLoading(true)
    try {
      // 1. Split
      const splitRes = await fetch("/api/generate/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scriptText, segmentLength: segmentSize[0] }),
      })
      if (!splitRes.ok) throw new Error("Failed to split script")
      const splitData = await splitRes.json()

      // 2. Describe
      const descRes = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: splitData.segments, language, style }),
      })
      if (!descRes.ok) throw new Error("Failed to generate descriptions")
      const descData = await descRes.json()

      // Initialize statuses
      const visualDescriptions = (descData.visualDescriptions || []).map((desc: any) => ({
        ...desc,
        status: 'completed'
      }))

      setResponse({
        segments: splitData.segments,
        visualDescriptions
      })
      setCurrentStage('DESCRIPTIONS')
    } catch (error) {
      console.error("Generation error:", error)
      alert("Failed to generate descriptions")
    } finally {
      setIsLoading(false)
    }
  }

  // Stage 2 -> 3: Descriptions -> Images
  const handleGenerateImages = async () => {
    if (!response?.visualDescriptions) return
    setIsLoading(true)
    // Parallel generation logic simplified
    // ... (reusing logic from WithCommentatorFlow but for simple flow)
    // For simplicity, let's just assume we trigger them all or mark them generating

    try {
      const newDescriptions = [...response.visualDescriptions]

      const promises = newDescriptions.map(async (desc, index) => {
        if (desc.status === 'completed' && desc.imageUrl) return

        // Update local status
        setResponse(prev => {
          if (!prev || !prev.visualDescriptions) return prev
          const next = [...prev.visualDescriptions]
          next[index] = { ...next[index], status: 'generating' }
          return { ...prev, visualDescriptions: next }
        })

        try {
          const res = await fetch('/api/generate/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imagePrompt: desc.imagePrompt,
              imageConfig: { aspect_ratio: "16:9" },
              systemPrompt: imageSystemPrompt
            }),
          })
          if (!res.ok) throw new Error('Failed to generate image')
          const data = await res.json()

          setResponse(prev => {
            if (!prev || !prev.visualDescriptions) return prev
            const next = [...prev.visualDescriptions]
            next[index] = { ...next[index], imageUrl: data.imageUrl, status: 'completed' }
            return { ...prev, visualDescriptions: next }
          })
        } catch (e) {
          setResponse(prev => {
            if (!prev || !prev.visualDescriptions) return prev
            const next = [...prev.visualDescriptions]
            next[index] = { ...next[index], status: 'error' }
            return { ...prev, visualDescriptions: next }
          })
        }
      })

      await Promise.all(promises)
      setCurrentStage('IMAGES')
    } catch (error) {
      console.error("Image generation error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateImage = async (index: number) => {
    if (!response?.visualDescriptions) return
    const desc = response.visualDescriptions[index]

    setResponse(prev => {
      if (!prev || !prev.visualDescriptions) return prev
      const next = [...prev.visualDescriptions]
      next[index] = { ...next[index], status: 'generating' }
      return { ...prev, visualDescriptions: next }
    })

    try {
      const imgRes = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: desc.imagePrompt,
          imageConfig: { aspect_ratio: "16:9" },
          systemPrompt: imageSystemPrompt
        }),
      })
      if (!imgRes.ok) throw new Error("Failed to regenerate image")
      const imgData = await imgRes.json()

      setResponse(prev => {
        if (!prev || !prev.visualDescriptions) return prev
        const next = [...prev.visualDescriptions]
        next[index] = { ...next[index], imageUrl: imgData.imageUrl, status: 'completed' }
        return { ...prev, visualDescriptions: next }
      })
    } catch (error) {
      console.error("Regen error:", error)
      setResponse(prev => {
        if (!prev || !prev.visualDescriptions) return prev
        const next = [...prev.visualDescriptions]
        next[index] = { ...next[index], status: 'error' }
        return { ...prev, visualDescriptions: next }
      })
    }
  }

  // Stage 4: Audio
  const handleGenerateAudio = async () => {
    if (audioBatches.length > 0 && audioBatches.every(b => b.status === 'completed' && b.url)) {
      setCurrentStage('AUDIO')
      return
    }
    setIsAudioLoading(true)
    try {
      const res = await fetch("/api/generate/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
          voice: audioVoice
        }),
      })
      if (!res.ok) throw new Error("Failed to generate audio")
      const data = await res.json()
      if (data.batches) {
        setAudioBatches(data.batches)
      }
      setCurrentStage('AUDIO')
    } catch (err) {
      console.error("Audio generation error:", err)
      alert("Failed to generate audio")
    } finally {
      setIsAudioLoading(false)
    }
  }

  const handleRegenerateAudioBatch = async (index: number) => {
    setAudioBatches(prev =>
      prev.map(b => b.index === index ? { ...b, status: 'generating', error: undefined } : b)
    )

    try {
      const res = await fetch("/api/generate/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
          voice: audioVoice,
          targetBatchIndices: [index]
        }),
      })
      if (!res.ok) throw new Error("Retry failed")
      const data = await res.json()

      if (data.batches) {
        const updatedBatch = data.batches.find((b: any) => b.index === index)
        if (updatedBatch) {
          setAudioBatches(prev => prev.map(b => b.index === index ? updatedBatch : b))
        }
      }
    } catch (error) {
      console.error("Batch retry error:", error)
      setAudioBatches(prev => prev.map(b => b.index === index ? { ...b, status: 'error', error: 'Failed to retry' } : b))
    }
  }

  // Stage 5: Transcription
  const handleTranscribe = async () => {
    const urls = audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!)
    if (urls.length === 0) return
    setIsTranscribing(true)
    try {
      // Map language name to code
      const langCode = language === 'english' ? 'en' : 'pt';

      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrls: urls, language: langCode }),
      })
      if (!res.ok) throw new Error("Transcription failed")
      const data = await res.json()
      setTranscriptionResults(data.results)
      setCurrentStage('TRANSCRIPTION')
    } catch (error) {
      console.error("Transcription error:", error)
      alert("Failed to transcribe audio")
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleRetryTranscription = async (url: string) => {
    setTranscriptionResults(prev =>
      prev.filter(r => r.url !== url)
    )
    setIsTranscribing(true)

    try {
      const langCode = language === 'english' ? 'en' : 'pt'
      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrls: [url], language: langCode }),
      })
      if (!res.ok) throw new Error("Retry failed")
      const data = await res.json()

      if (data.results?.[0]) {
        setTranscriptionResults(prev =>
          prev.map(r => r.url === url ? data.results[0] : r)
        )
      }
    } catch (error) {
      console.error("Transcription retry error:", error)
      setTranscriptionResults(prev => [
        ...prev,
        { url, status: 'error' as const, error: 'Retry failed' }
      ])
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleRenderVideo = async () => {
    if (!videoProps) return
    setIsRendering(true)
    setRenderProgress({ progress: 0, stage: 'bundling' })
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoProps: { ...videoProps, captionStyle }
        }),
      })

      if (!res.ok) {
        let errorMsg = "Render request failed";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch { }
        throw new Error(errorMsg);
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'progress') {
            setRenderProgress({
              progress: data.progress,
              stage: data.stage,
              renderedFrames: data.renderedFrames,
              totalFrames: data.totalFrames,
            })
          } else if (data.type === 'complete') {
            const videoUrl = data.videoUrl;
            // Create a download link for the persistent URL
            const link = document.createElement('a')
            link.href = videoUrl
            link.download = `video-${Date.now()}.mp4`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            // Optional: You could also save this URL to state to show a "Download Again" button later
          } else if (data.type === 'error') {
            throw new Error(data.error)
          }
        }
      }

    } catch (error: any) {
      console.error("Render error:", error)
      alert(`Falha na renderização: ${error.message}`)
    } finally {
      setIsRendering(false)
      setRenderProgress(null)
    }
  }

  // Stage 6: Video
  const handleGenerateVideo = async () => {
    const completedAudio = audioBatches.filter(b => b.status === 'completed' && b.url)
    const audioUrls = completedAudio.map(b => b.url!)

    console.log('[Video] Starting generation with:', {
      hasDescriptions: !!response?.visualDescriptions,
      audioUrlsCount: audioUrls.length,
      transcriptionResultsCount: transcriptionResults.length
    })

    if (!response?.visualDescriptions || !audioUrls.length || !transcriptionResults.length) {
      alert("Faltam dados para gerar o vídeo (Imagens, Áudio ou Transcrição).")
      return
    }

    setIsVideoGenerating(true)
    try {
      // Map audio urls -> transcription data
      const transcriptionMap = new Map(
        transcriptionResults
          .filter(r => r.status === 'completed' && r.data)
          .map(r => [r.url, r.data])
      )

      const validAudioUrls = audioUrls.filter(url => transcriptionMap.has(url))

      const orderedTranscriptions = validAudioUrls.map(url => {
        const rawData = transcriptionMap.get(url)!
        const words = Array.isArray(rawData) ? rawData : rawData.words || []
        return {
          words: words.map((w: any) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs
          }))
        }
      })

      console.log(`[Video] Using ${validAudioUrls.length}/${audioUrls.length} audio segments with valid transcriptions`)

      if (validAudioUrls.length === 0) {
        throw new Error("Nenhum áudio possui transcrição válida")
      }

      const segments = response.segments.map((text, i) => ({
        id: `seg-${i}`,
        text,
        imageUrl: response.visualDescriptions?.[i]?.imageUrl || ''
      }))

      // Fetch actual audio durations to account for trailing silence
      console.log('[Video] Fetching audio durations...')
      const audioDurations = await Promise.all(
        validAudioUrls.map(url => new Promise<number>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[Video] Timeout waiting for metadata: ${url}`)
            resolve(0)
          }, 5000)

          const audio = new Audio(url)
          audio.onloadedmetadata = () => {
            clearTimeout(timeout)
            console.log(`[Video] Loaded metadata for ${url}: ${audio.duration}s`)
            resolve(audio.duration)
          }
          audio.onerror = () => {
            clearTimeout(timeout)
            console.error(`[Video] Failed to load metadata for ${url}`)
            resolve(0)
          }
        }))
      )

      console.log('[Video] Final alignment check...', {
        segmentsCount: segments.length,
        audioDurations
      })

      const props = alignVideoProps(
        segments,
        orderedTranscriptions,
        validAudioUrls,
        audioDurations
      )

      console.log('[Video] Props generated:', {
        durationInFrames: props.durationInFrames,
        scenes: props.scenes.length
      })

      if (props.durationInFrames <= 0) {
        throw new Error("A duração calculada do vídeo é zero. Verifique se os áudios foram carregados corretamente.")
      }

      setVideoProps(props)
      setCurrentStage('VIDEO')
    } catch (error: any) {
      console.error("[Video] Generation error:", error)
      alert(`Falha ao gerar vídeo: ${error.message}`)
    } finally {
      setIsVideoGenerating(false)
    }
  }

  // Stage 7: Download
  const handleDownloadZip = async () => {
    if (!response || !response.visualDescriptions) return
    setIsDownloading(true)
    try {
      const res = await fetch("/api/generate/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualDescriptions: response.visualDescriptions,
          segments: response.segments,
          audioUrls: audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
          transcriptionResults
        }),
      })
      if (!res.ok) throw new Error("Failed to download ZIP")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `simple-story-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Download error:", error)
      alert("Failed to download ZIP")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">História Simples</h1>
          </div>
          <Button onClick={handleSaveProject} disabled={!scriptText.trim() || isSaving} className="flex items-center gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Projeto
          </Button>
        </div>

        <FlowStepper
          steps={STEPS}
          currentStep={currentStepIndex}
          className="mb-8"
          onStepClick={handleStepClick}
        />

        {/* INPUT STAGE */}
        {currentStage === 'INPUT' && (
          <>
            <StageControls
              onRegenerate={() => { }}
              onNext={handleGenerateDescriptions}
              nextLabel="Gerar Descrições"
              hideRegenerate={true}
              isNextLoading={isLoading}
              canGoNext={!!scriptText.trim()}
            />
            <Card>
              <CardHeader><CardTitle>Roteiro</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Digite sua história..."
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  className="min-h-32"
                />
                <div className="flex gap-4">
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">Tamanho do Segmento: {segmentSize}</label>
                    <Slider value={segmentSize} onValueChange={setSegmentSize} max={500} min={50} step={10} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">Idioma</label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portuguese brasilian">Português (BR)</SelectItem>
                        <SelectItem value="english">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* DESCRIPTIONS STAGE */}
        {currentStage === 'DESCRIPTIONS' && (
          <>
            <StageControls
              onRegenerate={handleGenerateDescriptions}
              onNext={handleGenerateImages}
              nextLabel="Gerar Imagens"
              isRegenerating={isLoading}
              isNextLoading={isLoading}
              canGoNext={!!response?.visualDescriptions}
            />
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Estilo das Imagens (System Prompt)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={imageSystemPrompt}
                  onChange={(e) => setImageSystemPrompt(e.target.value)}
                  placeholder="Defina o estilo visual das imagens..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>
            <div className="space-y-4">
              {response?.visualDescriptions?.map((desc, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <div className="font-semibold text-sm text-muted-foreground">Cena {i + 1}</div>
                    <p>{response.segments[i]}</p>
                    <div className="bg-muted p-2 rounded text-sm italic">{desc.imagePrompt}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* IMAGES STAGE */}
        {currentStage === 'IMAGES' && (
          <>
            <StageControls
              onRegenerate={handleGenerateImages}
              onNext={handleGenerateAudio}
              nextLabel="Gerar Áudio"
              isRegenerating={isLoading}
              isNextLoading={isAudioLoading}
              canGoNext={response?.visualDescriptions?.every(d => d.status === 'completed') || false}
            />
            <div className="grid grid-cols-2 gap-4">
              {response?.visualDescriptions?.map((desc, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    {desc.status === 'completed' && desc.imageUrl ? (
                      <img src={desc.imageUrl} className="w-full rounded" />
                    ) : (
                      <Skeleton className="w-full h-48" />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleRegenerateImage(i)}><RefreshCw className="w-4 h-4 mr-2" /> Regenerar</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* AUDIO STAGE */}
        {currentStage === 'AUDIO' && (
          <>
            <StageControls
              onRegenerate={handleGenerateAudio}
              onNext={handleTranscribe}
              nextLabel="Gerar Transcrição"
              isRegenerating={isAudioLoading}
              isNextLoading={isTranscribing}
              canGoNext={audioBatches.some(b => b.status === 'completed')}
            />
            <Card>
              <CardHeader><CardTitle>Áudio Gerado</CardTitle></CardHeader>
              <CardContent>
                {!audioBatches.length && !isAudioLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-muted-foreground mb-4">Gerando áudio...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {audioBatches.map((batch, i) => (
                      <div key={i} className="p-3 bg-muted/50 rounded-lg border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-muted-foreground">Parte {i + 1}</span>
                          <div className="flex items-center gap-2">
                            {batch.status === 'completed' && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Pronto</span>}
                            {batch.status === 'generating' && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processando</span>}
                            {batch.status === 'error' && (
                              <>
                                <span className="text-xs text-red-600 flex items-center gap-1"><X className="w-3 h-3" /> Erro</span>
                                <Button variant="ghost" size="sm" onClick={() => handleRegenerateAudioBatch(batch.index)}><RefreshCw className="w-3 h-3 mr-1" /> Retry</Button>
                              </>
                            )}
                          </div>
                        </div>
                        {batch.status === 'completed' && batch.url ? (
                          <audio controls src={batch.url} className="w-full h-10" />
                        ) : (
                          <Skeleton className="w-full h-10 rounded" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* TRANSCRIPTION STAGE */}
        {currentStage === 'TRANSCRIPTION' && (
          <>
            <StageControls
              onRegenerate={handleTranscribe}
              onNext={handleGenerateVideo}
              nextLabel="Próxima Etapa: Vídeo"
              isRegenerating={isTranscribing}
              isNextLoading={isVideoGenerating}
              canGoNext={transcriptionResults.length > 0 && transcriptionResults.every(r => r.status === 'completed')}
              regenerateLabel="Gerar Transcrições"
            />
            <Card>
              <CardHeader><CardTitle>Transcrição</CardTitle></CardHeader>
              <CardContent className="space-y-4">

                {!transcriptionResults.length && (
                  <p className="text-sm text-muted-foreground">Aguardando transcrição...</p>
                )}
                {transcriptionResults.map((res, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span>Áudio {i + 1}</span>
                    {res.status === 'completed' ? (
                      <a href={res.transcriptionUrl} target="_blank" className="text-green-600 hover:underline flex items-center gap-1"><Check className="w-4 h-4" /> Ver JSON</a>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">Erro</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRetryTranscription(res.url)}><RefreshCw className="w-3 h-3 mr-1" /> Retry</Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}


        {/* VIDEO STAGE */}
        {
          currentStage === 'VIDEO' && videoProps && (
            <>
              <StageControls
                onRegenerate={handleGenerateVideo}
                onNext={() => setCurrentStage('DOWNLOAD')}
                nextLabel="Baixar Arquivos"
                isRegenerating={isVideoGenerating}
                canGoNext={true}
                regenerateLabel="Regenerar Vídeo"
              />
              <Card>
                <CardHeader><CardTitle>Preview do Vídeo</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tamanho da Fonte ({captionStyle.fontSize}px)</label>
                      <Slider
                        min={40}
                        max={150}
                        step={5}
                        value={[captionStyle.fontSize]}
                        onValueChange={(val) => setCaptionStyle(prev => ({ ...prev, fontSize: val[0] }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cor do Destaque</label>
                      <div className="flex gap-2">
                        {["#FFE81F", "#FFFFFF", "#00FF00", "#FF00FF", "#00FFFF"].map(color => (
                          <button
                            key={color}
                            className={cn(
                              "w-6 h-6 rounded-full border border-border",
                              captionStyle.highlightColor === color && "ring-2 ring-primary ring-offset-2"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => setCaptionStyle(prev => ({ ...prev, highlightColor: color }))}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Palavras por Linha</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(num => (
                          <Button
                            key={num}
                            variant={captionStyle.maxWordsPerLine === num ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setCaptionStyle(prev => ({ ...prev, maxWordsPerLine: num }))}
                          >
                            {num}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mb-4">
                    <Button variant="secondary" onClick={handleRenderVideo} disabled={isRendering}>
                      {isRendering ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Renderizando MP4...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Renderizar Vídeo (MP4)
                        </>
                      )}
                    </Button>
                  </div>

                  {renderProgress && (
                    <div className="mb-4 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>
                          {renderProgress.stage === 'bundling' && 'Empacotando...'}
                          {renderProgress.stage === 'rendering' && `Renderizando frames ${renderProgress.renderedFrames ?? 0}/${renderProgress.totalFrames ?? '?'}`}
                          {renderProgress.stage === 'encoding' && 'Finalizando...'}
                        </span>
                        <span>{renderProgress.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${renderProgress.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {playerProps && <VideoPlayer props={playerProps} />}

                  {/* Debug Metadata */}
                  <div className="mt-8 pt-4 border-t">
                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground font-medium">Debug: Video Metadata (Scenes & Timings)</summary>
                      <div className="mt-2 text-xs font-mono space-y-2 max-h-80 overflow-y-auto bg-muted p-4 rounded">
                        <p>Total Scenes: {videoProps.scenes.length}</p>
                        <p>Total Duration: {videoProps.durationInFrames} frames ({videoProps.durationInFrames / videoProps.fps}s)</p>
                        <pre className="mt-4 text-[10px] opacity-50">
                          {JSON.stringify(videoProps, (key, val) =>
                            typeof val === 'string' && val.startsWith('data:image')
                              ? `[BASE64_IMAGE_${val.length}_BYTES]`
                              : val, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                </CardContent>
              </Card>
            </>
          )
        }

        {/* DOWNLOAD STAGE */}
        {
          currentStage === 'DOWNLOAD' && (
            <div className="flex justify-between items-center bg-card p-6 rounded-lg border shadow-sm">
              <div>
                <h3 className="font-bold">Download Completo</h3>
                <p className="text-muted-foreground">Baixe todos os arquivos.</p>
              </div>
              <Button onClick={handleDownloadZip} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Baixar ZIP
              </Button>
            </div>
          )
        }

        <ScrollToTop />
      </div>
    </div >
  )
}