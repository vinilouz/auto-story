"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Save, Loader2, Pencil, Check, X, RefreshCw, Download, Play, Clock } from "lucide-react"
import { VOICES } from "@/lib/ai/configs/voices"
import CommentatorConfig, { CommentatorConfig as CommentatorConfigType } from "./CommentatorConfig"
import { COMMENTATOR_IMAGE_GENERATION_PROMPT } from "@/lib/ai/prompts/prompts"
import { FlowStepper } from "@/components/shared/FlowStepper"
import { StageControls } from "@/components/shared/StageControls"
import { ScrollToTop } from "@/components/shared/ScrollToTop"

import { VideoPlayer } from "@/components/video/VideoPlayer"
import { alignVideoProps } from "@/lib/video/aligner"
import { RemotionVideoProps } from "@/lib/video/types"
import { cn } from "@/lib/utils"
import { splitTextIntoBatches } from "@/lib/ai/utils/text-splitter"
import { DEFAULT_IMAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts/image-prompts"

interface WithCommentatorFlowProps {
  onBack: () => void
  projectId?: string
}

const DEFAULT_SEGMENT_SIZE = 200

type Stage = 'INPUT' | 'COMMENTATOR' | 'COMMENTS' | 'DESCRIPTIONS' | 'IMAGES' | 'AUDIO' | 'TRANSCRIPTION' | 'VIDEO' | 'DOWNLOAD'

const STEPS = ["Roteiro", "Comentador", "Comentários", "Descrições", "Imagens", "Áudio", "Transcrição", "Vídeo"]
const STAGE_ORDER: Stage[] = ['INPUT', 'COMMENTATOR', 'COMMENTS', 'DESCRIPTIONS', 'IMAGES', 'AUDIO', 'TRANSCRIPTION', 'VIDEO', 'DOWNLOAD']

export default function WithCommentatorFlow({ onBack, projectId }: WithCommentatorFlowProps) {
  // Stage State
  const [currentStage, setCurrentStage] = useState<Stage>('INPUT')

  // Data State
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([DEFAULT_SEGMENT_SIZE])
  const [language, setLanguage] = useState("portuguese brasilian")
  const [style, setStyle] = useState("")
  const [response, setResponse] = useState<any>(null)
  const [commentator, setCommentator] = useState<CommentatorConfigType | undefined>()
  const [segmentsWithComments, setSegmentsWithComments] = useState<Array<{ type: 'scene_text' | 'comment', content: string }> | null>(null)
  const [commentVisualDescriptions, setCommentVisualDescriptions] = useState<Array<{ imagePrompt: string; imageUrl?: string; status: 'pending' | 'generating' | 'completed' | 'error' }> | null>(null)

  // Audio State
  const [audioBatches, setAudioBatches] = useState<Array<{ index: number; text: string; status: 'pending' | 'generating' | 'completed' | 'error'; url?: string; error?: string }>>([])
  const [audioSystemPrompt, setAudioSystemPrompt] = useState("")
  const [audioVoiceNarrator, setAudioVoiceNarrator] = useState("nPczCjzI2devNBz1zQrb")
  const [audioVoiceCommentator, setAudioVoiceCommentator] = useState("Clyde")
  const [isAudioLoading, setIsAudioLoading] = useState(false)

  // Transcription State
  const [transcriptionResults, setTranscriptionResults] = useState<Array<{ url: string; status: 'completed' | 'error'; transcriptionUrl?: string; data?: any; error?: string }>>([])
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

  const handleRenderVideo = async () => {
    if (!videoProps) return
    setIsRendering(true)
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoProps: { ...videoProps, captionStyle },
          // We might need to pass project ID or other metadata to ensure context
        }),
      })

      if (!res.ok) {
        let errorMsg = "Render request failed";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          // ignore json parse error
        }
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

          // Handle progress events if you add progress UI later
          if (data.type === 'complete') {
            const videoUrl = data.videoUrl;
            const link = document.createElement('a')
            link.href = videoUrl
            link.download = `video-${Date.now()}.mp4`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
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
    }
  }

  // Restore computed values for audio
  const generatedAudioContent = useMemo(() => {
    if (!segmentsWithComments) return ""
    let content = ""
    segmentsWithComments.forEach(item => {
      if (item.type === 'scene_text') {
        content += `narrator: ${item.content}\n`
      } else if (item.type === 'comment') {
        content += `commentator: ${item.content}\n`
      }
    })
    return content
  }, [segmentsWithComments])

  const expectedBatches = useMemo(() => {
    if (!generatedAudioContent) return []
    return splitTextIntoBatches(generatedAudioContent, 2000, audioSystemPrompt)
  }, [generatedAudioContent, audioSystemPrompt])

  useEffect(() => {
    if (projectId) {
      setIsProjectLoading(true)
      loadProject(projectId)
    }
  }, [projectId])

  const hasAutoCheckedTranscription = useRef(false)

  // Auto-check for existing transcriptions when entering stage
  useEffect(() => {
    if (currentStage === 'TRANSCRIPTION' && audioBatches.length > 0 && transcriptionResults.length === 0 && !isTranscribing && !hasAutoCheckedTranscription.current) {
      console.log('Auto-checking for existing transcriptions...')
      hasAutoCheckedTranscription.current = true
      handleTranscribe()
    }
  }, [currentStage, audioBatches, transcriptionResults, isTranscribing])

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
        if (project.segments) setResponse({ segments: project.segments })
        if (project.commentator) setCommentator(project.commentator)
        if (project.segmentsWithComments) setSegmentsWithComments(project.segmentsWithComments)
        if (project.visualDescriptions) setCommentVisualDescriptions(project.visualDescriptions)

        if (project.audioBatches) {
          setAudioBatches(project.audioBatches);
        } else if (project.audioUrls) {
          setAudioBatches(project.audioUrls.map((url: string, i: number) => ({
            index: i,
            text: `Legacy content ${i}`,
            status: 'completed',
            url: url
          })))
        }
        if (project.audioSystemPrompt) setAudioSystemPrompt(project.audioSystemPrompt)

        if (project.transcriptionResults) {
          setTranscriptionResults(project.transcriptionResults)
        }

        // Determine stage
        if (project.transcriptionResults && project.transcriptionResults.length > 0) {
          setCurrentStage('TRANSCRIPTION')
        } else if (project.audioBatches && project.audioBatches.length > 0 && project.audioBatches.some((b: any) => b.status === 'completed')) {
          setCurrentStage('AUDIO')
        } else if (project.visualDescriptions && project.visualDescriptions.length > 0) {
          setCurrentStage('IMAGES')
        } else if (project.segmentsWithComments && project.segmentsWithComments.length > 0) {
          setCurrentStage('DESCRIPTIONS')
        } else if (project.commentator) {
          setCurrentStage('COMMENTS')
        } else if (project.segments) {
          setCurrentStage('COMMENTATOR')
        } else {
          setCurrentStage('INPUT')
        }
      }
    } catch (error) {
      console.error("Load error:", error)
      alert("Failed to load project")
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
        flowType: 'with-commentator',
        scriptText,
        segmentSize: segmentSize[0],
        language,
        style,
        segments: response?.segments,
        commentator: commentator,
        segmentsWithComments: segmentsWithComments,
        visualDescriptions: commentVisualDescriptions,
        audioUrls: audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
        audioBatches: audioBatches,
        audioSystemPrompt,
        transcriptionResults: transcriptionResults
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

  const currentStepIndex = STAGE_ORDER.indexOf(currentStage)

  const handleStepClick = (index: number) => {
    const isLastStep = index === STEPS.length - 1
    if (index > currentStepIndex && !isLastStep) return
    const stages: Stage[] = ['INPUT', 'COMMENTATOR', 'COMMENTS', 'DESCRIPTIONS', 'IMAGES', 'AUDIO', 'TRANSCRIPTION', 'VIDEO', 'DOWNLOAD']
    if (stages[index]) setCurrentStage(stages[index])
  }

  // Handlers for stages
  const handleGenerateComments = async () => {
    if (!commentator) return
    setIsLoading(true)
    try {
      // 1. Ensure segments exist (Split if necessary)
      let segments = response?.segments
      if (!segments || segments.length === 0) {
        if (!scriptText.trim()) {
          alert("Por favor, digite o roteiro primeiro.")
          return
        }

        const splitRes = await fetch("/api/generate/split", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: scriptText, segmentLength: segmentSize[0] }),
        })

        if (!splitRes.ok) throw new Error("Failed to split script")
        const splitData = await splitRes.json()
        segments = splitData.segments

        // Save segments to state
        setResponse((prev: any) => ({ ...prev, segments }))
      }

      // 2. Generate Comments
      const commentatorDescription = `Name: ${commentator.name}. Personality: ${commentator.personality}`

      const res = await fetch("/api/generate/commentator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segments,
          commentatorDescription: commentatorDescription
        }),
      })
      if (!res.ok) throw new Error("Failed to generate comments")
      const data = await res.json()
      setSegmentsWithComments(data.segmentsWithComments)
      setCurrentStage('COMMENTS')
    } catch (e) {
      console.error(e)
      alert("Error generating comments")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateDescriptions = async () => {
    if (!segmentsWithComments) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segmentsWithComments.map(s =>
            s.type === 'comment'
              ? `[Commentary by ${commentator?.name}]: ${s.content}`
              : s.content
          ),
          commentatorName: commentator?.name,
          commentatorPersonality: commentator?.personality,
          commentatorImage: commentator?.appearance.imageUrl,
          language,
          style
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setCommentVisualDescriptions(data.visualDescriptions.map((d: any) => ({ ...d, status: 'completed' })))
      setCurrentStage('DESCRIPTIONS')
    } catch (e) {
      console.error(e)
      alert("Error generating descriptions")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateDescription = async (index: number) => {
    // Placeholder for regeneration logic if needed
    // Ideally calls API again for that segment
  }

  const startEditing = (index: number, prompt: string) => {
    setEditingSegmentIndex(index)
    setEditedPrompt(prompt)
  }

  const cancelEditing = () => {
    setEditingSegmentIndex(null)
    setEditedPrompt("")
  }

  const savePrompt = (index: number) => {
    setCommentVisualDescriptions(prev => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = { ...next[index], imagePrompt: editedPrompt }
      return next
    })
    setEditingSegmentIndex(null)
  }

  const handleGenerateImages = async () => {
    if (!commentVisualDescriptions) return
    setIsLoading(true)

    // Trigger generation for all pending
    const promises = commentVisualDescriptions.map(async (desc, index) => {
      if (desc.status === 'completed' && desc.imageUrl) return

      setCommentVisualDescriptions(prev => {
        if (!prev) return prev
        const next = [...prev]
        next[index] = { ...next[index], status: 'generating' }
        return next
      })

      try {
        const isComment = segmentsWithComments && segmentsWithComments[index]?.type === 'comment'
        const referenceImage = isComment && commentator?.appearance?.imageUrl ? commentator.appearance.imageUrl : undefined

        const finalPrompt = referenceImage
          ? COMMENTATOR_IMAGE_GENERATION_PROMPT(desc.imagePrompt)
          : desc.imagePrompt

        const res = await fetch('/api/generate/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePrompt: finalPrompt,
            referenceImage: referenceImage,
            imageConfig: { aspect_ratio: "16:9" },
            systemPrompt: imageSystemPrompt
          }),
        })
        if (!res.ok) throw new Error('Failed to generate image')
        const data = await res.json()

        setCommentVisualDescriptions(prev => {
          if (!prev) return prev
          const next = [...prev]
          next[index] = { ...next[index], imageUrl: data.imageUrl, status: 'completed' }
          return next
        })
      } catch (e) {
        setCommentVisualDescriptions(prev => {
          if (!prev) return prev
          const next = [...prev]
          next[index] = { ...next[index], status: 'error' }
          return next
        })
      }
    })

    await Promise.all(promises)
    setCurrentStage('IMAGES')
    setIsLoading(false)
  }

  const handleRegenerate = async (index: number) => {
    if (!commentVisualDescriptions) return
    const desc = commentVisualDescriptions[index]

    setCommentVisualDescriptions(prev => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = { ...next[index], status: 'generating' }
      return next
    })

    try {
      const isComment = segmentsWithComments && segmentsWithComments[index]?.type === 'comment'
      const referenceImage = isComment && commentator?.appearance?.imageUrl ? commentator.appearance.imageUrl : undefined

      const finalPrompt = referenceImage
        ? COMMENTATOR_IMAGE_GENERATION_PROMPT(desc.imagePrompt)
        : desc.imagePrompt

      const imgRes = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: finalPrompt,
          referenceImage: referenceImage,
          imageConfig: { aspect_ratio: "16:9" },
          systemPrompt: imageSystemPrompt
        }),
      })
      if (!imgRes.ok) throw new Error("Failed to regenerate image")
      const imgData = await imgRes.json()

      setCommentVisualDescriptions(prev => {
        if (!prev) return prev
        const next = [...prev]
        next[index] = { ...next[index], imageUrl: imgData.imageUrl, status: 'completed' }
        return next
      })
    } catch (error) {
      setCommentVisualDescriptions(prev => {
        if (!prev) return prev
        const next = [...prev]
        next[index] = { ...next[index], status: 'error' }
        return next
      })
    }
  }

  const handleGenerateAudio = async () => {
    if (!segmentsWithComments) return
    if (audioBatches.length > 0 && audioBatches.every(b => b.status === 'completed' && b.url)) {
      setCurrentStage('AUDIO')
      return
    }
    setIsAudioLoading(true)
    const content = generatedAudioContent

    try {
      const res = await fetch("/api/generate/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: content,
          systemPrompt: audioSystemPrompt,
          voices: [
            { speaker: "narrator", voice: audioVoiceNarrator },
            { speaker: "commentator", voice: audioVoiceCommentator }
          ]
        }),
      })

      if (!res.ok) throw new Error("Failed to generate audio")
      const data = await res.json()

      if (data.batches) {
        setAudioBatches(data.batches)
      }

      setCurrentStage('AUDIO')

    } catch (error) {
      console.error("Audio generation error:", error)
      alert("Failed to generate audio")
    } finally {
      setIsAudioLoading(false)
    }
  }

  const handleRegenerateAudioBatch = async (index: number) => {
    setAudioBatches(prev => {
      const exists = prev.find(b => b.index === index)
      if (exists) {
        return prev.map(b => b.index === index ? { ...b, status: 'generating', error: undefined } : b)
      }
      return [...prev, {
        index,
        text: expectedBatches[index] || "",
        status: 'generating' as const
      }]
    })

    const content = generatedAudioContent

    try {
      const res = await fetch("/api/generate/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: content,
          targetBatchIndices: [index],
          systemPrompt: audioSystemPrompt,
          voices: [
            { speaker: "narrator", voice: audioVoiceNarrator },
            { speaker: "commentator", voice: audioVoiceCommentator }
          ]
        }),
      })

      if (!res.ok) throw new Error("Recalculation failed")
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


  const handleTranscribe = async () => {
    const urls = audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!)
    if (urls.length === 0) return

    setIsTranscribing(true)
    try {
      // Map language string to code
      // "portuguese brasilian" -> "pt"
      // "english" -> "en"
      const langCode = language === 'english' ? 'en' : 'pt';

      const res = await fetch("/api/generate/transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrls: urls,
          language: langCode
        }),
      })
      if (!res.ok) throw new Error("Transcription failed")
      const data = await res.json()

      setTranscriptionResults(prev => {
        // Create a map of existing results
        const map = new Map(prev.map(r => [r.url, r]))
        // Update with new results
        data.results.forEach((r: any) => map.set(r.url, r))
        return Array.from(map.values())
      })

      // Auto save to persist transcription results
      // We don't want to block the UI, so we just trigger it
      // But we need to update the state reference first, so use a timeout or effect
      // Actually, handleSaveProject uses current state values. Updates inside this function might not be reflected immediately in closure.
      // But 'transcriptionResults' is a state. handleSaveProject reads it.
      // We need to wait for state update. 
      // A better way is to call save in a useEffect when transcriptionResults changes AND stage is TRANSCRIPTION.
      // For now, let's just alert the user or maybe trigger save after a short delay?
      // Or just pass the new results to save? handleSaveProject reads from state.
      // Let's rely on manual save or auto-save if implemented elsewhere.
      // The user asked "pode ser resolvido com o salvamento salvando de fato essa info".
      // Let's force a save here with the new data.

      // We can't easily call handleSaveProject with *new* data because it reads state.
      // I'll add a trigger to save.
      setTimeout(() => handleSaveProject(), 100)

    } catch (error) {
      console.error("Transcription error:", error)
      alert("Failed to transcribe audio")
    } finally {
      setIsTranscribing(false)
    }
  }

  // Stage 7: Video
  const handleGenerateVideo = async () => {
    const completedAudio = audioBatches.filter(b => b.status === 'completed' && b.url)
    const audioUrls = completedAudio.map(b => b.url!)

    console.log('[Video] Starting generation (Commentator) with:', {
      hasSegments: !!segmentsWithComments,
      hasVisuals: !!commentVisualDescriptions,
      audioUrlsCount: audioUrls.length,
      transcriptionResultsCount: transcriptionResults.length
    })

    if (!segmentsWithComments || !audioUrls.length || !transcriptionResults.length) {
      alert("Faltam dados para gerar o vídeo (Roteiro, Áudio ou Transcrição).")
      return
    }

    setIsVideoGenerating(true)
    try {
      // Filter valid data
      const completedAudio = audioBatches.filter(b => b.status === 'completed' && b.url)
      // Check transcriptions for these
      // Note: audioBatches index matches transcription? 
      // audioBatches is {index, url}. transcriptionResults array is in order of requests?
      // handleTranscribe calls with array map.
      // We assume strict ordering or we map by URL.
      // transcriptionResult has 'url' property, matches audioUrl.

      // Map audio urls -> transcription data
      const transcriptionMap = new Map(transcriptionResults.map(r => [r.url, r.data]))

      const orderedTranscriptions = completedAudio.map(b => {
        const rawData = transcriptionMap.get(b.url!)
        if (!rawData) return null

        const words = Array.isArray(rawData) ? rawData : rawData.words || []

        return {
          words: words.map((w: any) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs
          }))
        }
      }).filter((x): x is { words: any[] } => x !== null)

      if (orderedTranscriptions.length !== completedAudio.length) {
        throw new Error("Missing transcriptions for some audio batches")
      }

      // Prepare segments
      // We use segmentsWithComments as source text
      // And commentVisualDescriptions for images.
      const segments = segmentsWithComments.map((seg, i) => ({
        id: `seg-${i}`,
        text: seg.content,
        // If image is missing, we might use placeholder or skip?
        // Aligner skips segments without matching text? No, it tries.
        imageUrl: commentVisualDescriptions?.[i]?.imageUrl || ''
      })).filter(s => s.imageUrl) // Filter out segments with no visuals (maybe?)
      // Actually some segments might not have visuals if generation failed.
      // Aligner needs matching text. If we filter segments, text stream is broken?
      // No, because transcription covers full audio.
      // If we remove segment from 'segments' list passed to aligner, aligner will just skip that part of text in matching?
      // It tries to find next segment. If we skip a segment mid-stream, the next segment match might pick up the previous segment's text if it's similar?
      // Safer to keep all segments but provide fallback image if missing.
      // Let's modify map to provide placeholder or filter.
      // If I filter, I lose the text for that duration. The video will show previous scene?
      // Aligner assigns duration based on text match. If I skip segment, that text is "unclaimed".
      // Previous scene might extend? No.
      // I'll keep all segments. If imageUrl is empty, Scene component handles it (empty img or black).
      // Filter logic: `segmentsWithComments` is the canonical list.

      const alignSegments = segmentsWithComments.map((seg, i) => ({
        id: `seg-${i}`,
        text: seg.content,
        imageUrl: commentVisualDescriptions?.[i]?.imageUrl || ''
      }))

      // Fetch actual audio durations to account for trailing silence
      const audioUrls = completedAudio.map(b => b.url!);
      const audioDurations = await Promise.all(
        audioUrls.map(url => new Promise<number>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[Video] Timeout waiting for metadata: ${url}`)
            resolve(0)
          }, 5000)

          const audio = new Audio(url);
          audio.onloadedmetadata = () => {
            clearTimeout(timeout);
            console.log(`[Video] Loaded metadata for ${url}: ${audio.duration}s`);
            resolve(audio.duration);
          };
          audio.onerror = () => {
            clearTimeout(timeout);
            console.error(`[Video] Failed to load metadata for ${url}`);
            resolve(0); // Fallback
          };
        }))
      );

      const props = alignVideoProps(
        alignSegments,
        orderedTranscriptions,
        audioUrls,
        audioDurations
      )

      console.log('[Video] Props generated:', {
        durationInFrames: props.durationInFrames,
        scenes: props.scenes.length
      })

      if (props.durationInFrames <= 0) {
        throw new Error("A duração calculada do vídeo é zero. Verifique se os áudios foram carregados corretamente.");
      }

      setVideoProps(props)
      setCurrentStage('VIDEO')

    } catch (e) {
      console.error(e)
      alert("Failed to generate video")
    } finally {
      setIsVideoGenerating(false)
    }
  }

  // ... (handleDownloadZip update)
  const handleDownloadZip = async () => {
    if (!response || !commentVisualDescriptions) return
    setIsDownloading(true)
    try {
      const res = await fetch("/api/generate/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualDescriptions: commentVisualDescriptions,
          segments: response?.segments,
          segmentsWithComments: segmentsWithComments,
          audioUrls: audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
          transcriptionResults
        }),
      })
      // ... (existing download logic)
      if (!res.ok) throw new Error("Failed to download ZIP")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `story-with-commentator-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error("Download error:", error)
      alert("Failed to download ZIP")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold">{projectId ? 'Editar História' : 'Nova História com Comentador'}</span>
        </div>
        <div className="flex items-center gap-2 mr-4">
          <Button onClick={handleSaveProject} disabled={!scriptText.trim() || isSaving} variant="outline" size="sm">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <FlowStepper steps={STEPS} currentStep={currentStepIndex} onStepClick={handleStepClick} />

        {/* STAGE 1: INPUT */}
        {currentStage === 'INPUT' && (
          <>
            <StageControls
              onRegenerate={() => { }}
              onNext={() => setCurrentStage('COMMENTATOR')}
              nextLabel="Próxima Etapa: Escolher Comentador"
              hideRegenerate={true}
              canGoNext={!!scriptText.trim()}
            />
            <Card>
              <CardHeader><CardTitle>Roteiro</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Digite sua história aqui..."
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

        {/* STAGE 2: COMMENTATOR */}
        {currentStage === 'COMMENTATOR' && (
          <>
            <StageControls
              onRegenerate={() => { }}
              onNext={handleGenerateComments}
              nextLabel="Gerar Comentários"
              hideRegenerate={true}
              isNextLoading={isLoading}
              canGoNext={!!commentator}
            />
            <CommentatorConfig
              initialData={commentator}
              onSave={(config) => {
                setCommentator(config)
                setCurrentStage('COMMENTS')
              }}
              onCancel={() => setCurrentStage('INPUT')}
            />
          </>
        )}
        {/* STAGE 6: AUDIO */}
        {
          currentStage === 'AUDIO' && (
            <>
              <StageControls
                onRegenerate={handleGenerateAudio}
                onNext={() => setCurrentStage('TRANSCRIPTION')}
                nextLabel="Próxima Etapa: Transcrição"
                canGoNext={audioBatches.some(b => b.status === 'completed')}
                isRegenerating={isAudioLoading}
              />
              {/* ... (existing audio UI) */}
            </>
          )
        }

        {/* STAGE 7: TRANSCRIPTION */}
        {
          currentStage === 'TRANSCRIPTION' && (
            <>
              <StageControls
                onRegenerate={handleTranscribe}
                onNext={handleGenerateVideo}
                nextLabel="Próxima Etapa: Vídeo"
                canGoNext={transcriptionResults.length > 0 && transcriptionResults.every(r => r.status === 'completed')}
                isRegenerating={isTranscribing}
                isNextLoading={isVideoGenerating}
                regenerateLabel="Gerar Transcrições"
              />
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Transcrição de Áudio</CardTitle></CardHeader>
                  <CardContent>
                    {!transcriptionResults.length && !isTranscribing && (
                      <div className="flex flex-col items-center justify-center py-8">
                        <p className="text-muted-foreground mb-4">
                          {audioBatches.length > 0
                            ? `Pronto para transcrever ${audioBatches.length} áudios gerados.`
                            : "Nenhum áudio para transcrever."}
                        </p>
                        <Button onClick={handleTranscribe} size="lg" disabled={audioBatches.length === 0}>
                          Iniciar Transcrição
                        </Button>
                      </div>
                    )}

                    {isTranscribing && (
                      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Transcrevendo áudios...
                      </div>
                    )}

                    {(transcriptionResults.length > 0 || isTranscribing) && (
                      <div className="space-y-4">
                        {audioBatches.map((batch, i) => {
                          // Find result for this batch's url
                          const result = batch.url ? transcriptionResults.find(r => r.url === batch.url) : null;
                          const status = result?.status || (isTranscribing ? 'pending' : 'idle');

                          return (
                            <div key={i} className="flex flex-col gap-2 p-4 bg-muted/50 rounded-lg border">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                    {i + 1}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">Batch #{i + 1}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                      {batch.text.substring(0, 50)}...
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {status === 'completed' && result ? (
                                    <>
                                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Transcrito
                                      </span>
                                      <a href={result.transcriptionUrl} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="outline" className="h-8">
                                          Ver JSON
                                        </Button>
                                      </a>
                                    </>
                                  ) : status === 'error' ? (
                                    <>
                                      <span className="text-xs text-destructive font-medium flex items-center gap-1" title={result?.error || "Erro desconhecido"}>
                                        <X className="w-3 h-3" /> {result?.error === 'File not found' ? 'Arquivo ausente' : 'Erro'}
                                      </span>
                                      {result?.error === 'File not found' ? (
                                        <div className="flex gap-1">
                                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleTranscribe} title="Tentar Transcrever Novamente">
                                            <RefreshCw className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleTranscribe} title="Tentar Novamente">
                                          <RefreshCw className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                      {isTranscribing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                                      {isTranscribing ? 'Processando...' : 'Pendente'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )
        }




        {/* STAGE 3: COMMENTS */}
        {
          currentStage === 'COMMENTS' && (
            <>
              <StageControls
                onRegenerate={handleGenerateComments}
                onNext={() => setCurrentStage('DESCRIPTIONS')}
                nextLabel="Próxima Etapa: Descrições Visuais"
                isRegenerating={isLoading}
                canGoNext={!!segmentsWithComments}
              />
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Gerar Comentários</CardTitle></CardHeader>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Clique em "Regerar Etapa" para que o comentador analise e comente.</p>

                    {/* We can also show results here if they exist */}
                    {segmentsWithComments && (
                      <div className="text-left mt-6 space-y-4">
                        {segmentsWithComments.map((item, index) => (
                          <div key={index} className={cn("p-4 rounded-lg", item.type === 'comment' ? "bg-blue-50 border border-blue-100" : "bg-muted/50")}>
                            <div className="flex gap-3">
                              {item.type === 'comment' && (
                                <img src={commentator?.appearance.imageUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                              )}
                              <div>
                                <p className={cn("text-sm", item.type === 'comment' ? "text-blue-800 italic" : "")}>{item.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )
        }

        {/* STAGE 4: DESCRIPTIONS */}
        {
          currentStage === 'DESCRIPTIONS' && (
            <>

              <StageControls
                onRegenerate={handleGenerateDescriptions}
                onNext={() => setCurrentStage('IMAGES')}
                nextLabel="Próxima Etapa: Imagens"
                isRegenerating={isLoading}
                canGoNext={!!commentVisualDescriptions && commentVisualDescriptions.length > 0}
              />

              <div className="space-y-6">
                <Card>
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
                <Card>
                  <CardHeader><CardTitle>Descrições Geradas</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show what we have */}
                    {!commentVisualDescriptions || commentVisualDescriptions.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">Clique em "Regerar Etapa" para criar as descrições.</div>
                    ) : (
                      segmentsWithComments?.map((item, i) => {
                        const desc = commentVisualDescriptions[i];
                        return (
                          <div key={i} className={cn("p-4 rounded-lg flex flex-col gap-3", item.type === 'comment' ? "bg-blue-50 border border-blue-100" : "bg-muted/50")}>
                            {/* Original Content */}
                            <div className="flex gap-3 border-b pb-3 border-border/10">
                              {item.type === 'comment' && (
                                <img src={commentator?.appearance.imageUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="Commentator" />
                              )}
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                                  {item.type === 'comment' ? 'Comentário' : `Cena ${i + 1}`}
                                </span>
                                <p className={cn("text-sm", item.type === 'comment' ? "text-blue-800 italic" : "")}>{item.content}</p>
                              </div>
                            </div>

                            {/* Visual Description */}
                            {desc && (
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block flex items-center gap-1">
                                  <Pencil className="w-3 h-3" /> Descrição Visual
                                </span>
                                <p className="text-sm italic text-muted-foreground bg-background/50 p-2 rounded">{desc.imagePrompt}</p>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )
        }

        {/* STAGE 5: IMAGES */}
        {
          currentStage === 'IMAGES' && (
            <>
              <StageControls
                onRegenerate={handleGenerateImages}
                onNext={() => setCurrentStage('AUDIO')}
                nextLabel="Próxima Etapa: Gerar Áudios"
                isRegenerating={isLoading}
                canGoNext={!isLoading && commentVisualDescriptions?.every(d => d.status === 'completed')}
              />
              <div className="space-y-6">
                <div className="grid gap-6">
                  {segmentsWithComments?.map((item, index) => {
                    const visualDesc = commentVisualDescriptions?.[index]
                    return (
                      <Card key={index} className={item.type === 'comment' ? 'border-blue-200' : ''}>
                        <CardContent className="pt-6 space-y-4">
                          {/* Content */}
                          <div className="flex gap-3">
                            {item.type === 'comment' && (
                              <img src={commentator?.appearance.imageUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            )}
                            <p className={cn("text-sm", item.type === 'comment' ? "text-blue-800 italic" : "")}>{item.content}</p>
                          </div>

                          {/* Visual Description & Image */}
                          {visualDesc && (
                            <div className="border-t pt-4 mt-4">
                              {/* Prompt & Edit */}
                              {editingSegmentIndex === index ? (
                                <div className="space-y-2 mb-3">
                                  <Textarea value={editedPrompt} onChange={(e) => setEditedPrompt(e.target.value)} />
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                                    <Button size="sm" onClick={() => savePrompt(index)}>Save</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="group relative pr-14">
                                  <p className="text-xs text-muted-foreground italic mb-2">{visualDesc.imagePrompt}</p>
                                  <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRegenerateDescription(index)} title="Regenerate Description">
                                      <RefreshCw className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditing(index, visualDesc.imagePrompt)} title="Edit Description">
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Image */}
                              <div className="mt-4">
                                {visualDesc.status === 'completed' && visualDesc.imageUrl ? (
                                  <div className="relative group">
                                    <img src={visualDesc.imageUrl} alt="Scene" className="w-full rounded-lg" />
                                    <Button size="icon" variant="secondary" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => handleRegenerate(index)}>
                                      <RefreshCw className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : visualDesc.status === 'generating' ? (
                                  <Skeleton className="w-full h-48 rounded-lg" />
                                ) : (
                                  <div className="w-full h-48 bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                                    {visualDesc.status === 'error' ? (
                                      <>
                                        <span>Erro ao gerar</span>
                                        <Button variant="outline" size="sm" onClick={() => handleRegenerate(index)}>
                                          <RefreshCw className="w-4 h-4 mr-2" />
                                          Tentar Novamente
                                        </Button>
                                      </>
                                    ) : (
                                      'Aguardando geração'
                                    )}
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
          )
        }

        {/* STAGE 6: AUDIO */}
        {
          currentStage === 'AUDIO' && (
            <>
              <StageControls
                onRegenerate={handleGenerateAudio}
                onNext={() => setCurrentStage('DOWNLOAD')}
                nextLabel="Próxima Etapa: Download"
                isRegenerating={isAudioLoading}
                canGoNext={audioBatches.length > 0 && audioBatches.some(b => b.status === 'completed')}
              />
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Status da Geração</CardTitle>
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
                        {audioBatches.filter(b => b.status === 'completed').length}/{expectedBatches.length} Concluídos
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {expectedBatches.map((batchText, i) => {
                        const batch = audioBatches.find(b => b.index === i) || {
                          index: i,
                          text: batchText,
                          status: 'pending' as const
                        }

                        return (
                          <div key={batch.index} className={cn(
                            "flex flex-col gap-2 p-3 rounded border text-sm transition-colors",
                            batch.status === 'error' ? "bg-red-50/50 border-red-200" :
                              batch.status === 'completed' ? "bg-green-50/30 border-green-200/50 hover:bg-green-50/50" :
                                "bg-muted/50 border-border"
                          )}>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-mono text-xs px-1.5 py-0.5 rounded border",
                                  batch.status === 'completed' ? "bg-green-100 border-green-200 text-green-700" :
                                    batch.status === 'error' ? "bg-red-100 border-red-200 text-red-700" :
                                      "bg-gray-100 border-gray-200 text-gray-700"
                                )}>
                                  #{batch.index + 1}
                                </span>
                                {batch.status === 'completed' && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Pronto</span>}
                                {batch.status === 'error' && <span className="text-xs text-red-600 font-medium flex items-center gap-1"><X className="w-3 h-3" /> Falha</span>}
                                {batch.status === 'generating' && <span className="text-xs text-blue-600 font-medium flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Gerando...</span>}
                                {batch.status === 'pending' && <span className="text-xs text-muted-foreground font-medium">Pendente</span>}
                              </div>

                              <div className="flex gap-2">
                                {batch.status === 'completed' && batch.url && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                    const audio = new Audio(batch.url);
                                    audio.play();
                                  }}>
                                    <Play className="w-3 h-3" />
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs"
                                  onClick={() => handleRegenerateAudioBatch(batch.index)}
                                  disabled={batch.status === 'generating'}
                                >
                                  {batch.status === 'error' ? 'Recalcular' : batch.status === 'completed' ? 'Refazer' : 'Gerar'}
                                </Button>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2 pl-1 border-l-2 border-muted">
                              {batch.text}
                            </p>

                            {batch.status === 'completed' && batch.url && (
                              <audio controls src={batch.url} className="w-full h-8 mt-1" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Configuração de Vozes</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">System Prompt (Instruções para o Áudio)</label>
                      <Textarea
                        placeholder="Ex: Responda com um tom dramático e pausado..."
                        value={audioSystemPrompt}
                        onChange={(e) => setAudioSystemPrompt(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Voz do Narrador</label>
                        <select
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={audioVoiceNarrator}
                          onChange={(e) => setAudioVoiceNarrator(e.target.value)}
                        >
                          {VOICES.map(opt => (
                            <option key={opt.id} value={opt.name}>{opt.name} ({opt.description})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Voz do Comentador</label>
                        <select
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={audioVoiceCommentator}
                          onChange={(e) => setAudioVoiceCommentator(e.target.value)}
                        >
                          {VOICES.map(opt => (
                            <option key={opt.id} value={opt.name}>{opt.name} ({opt.description})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isAudioLoading && (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="ml-2 text-sm text-muted-foreground">Gerando áudio (isso pode levar alguns segundos)...</span>
                      </div>
                    )}



                    <div className="mt-8 pt-4 border-t">
                      <details className="text-sm text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">Debug: Ver Texto Formatado da Request</summary>
                        <div className="mt-2 text-xs font-mono space-y-2 max-h-80 overflow-y-auto">
                          {expectedBatches.map((batch, i) => (
                            <div key={i} className="p-4 bg-muted rounded-md border border-border whitespace-pre-wrap">
                              <div className="text-muted-foreground mb-1 font-bold">Batch {i + 1} ({batch.length} chars)</div>
                              {batch}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )
        }


        {/* STAGE: VIDEO */}
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
                      <label className="text-sm font-medium">Palavras por Linha ({captionStyle.maxWordsPerLine})</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5, 6].map(num => (
                          <Button
                            key={num}
                            variant={captionStyle.maxWordsPerLine === num ? "default" : "outline"}
                            size="sm"
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

                  <VideoPlayer props={{ ...videoProps, captionStyle }} />

                  <div className="mt-8 pt-4 border-t space-y-4">
                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground font-medium">Debug: Aligned Scenes (Timings & Logic)</summary>
                      <div className="mt-2 space-y-2 max-h-96 overflow-y-auto bg-muted p-4 rounded text-xs font-mono">
                        {videoProps.scenes.map((s, i) => (
                          <div key={i} className="mb-2 p-2 border border-border/50 rounded hover:bg-background/50">
                            <div className="font-bold flex justify-between">
                              <span>{s.id}</span>
                              <span className="opacity-50">{s.effect}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1 opacity-75">
                              <div>StartFrame: {s.startFrame}</div>
                              <div>Duration: {s.durationInFrames}</div>
                              <div>Transition: {s.transition ? `${s.transition.type} (${s.transition.durationInFrames})` : 'None'}</div>
                              <div>Img: {s.imageUrl ? 'Yes' : 'No'}</div>
                            </div>
                            <div className="mt-1 opacity-50 truncate" title={s.textFragment}>{s.textFragment}</div>
                            {s.debug && (
                              <div className="mt-1 pt-1 border-t border-border/20 opacity-50 text-[10px]">
                                Logic: {s.debug.startSeconds.toFixed(2)}s - {s.debug.endSeconds.toFixed(2)}s ({s.debug.durationSeconds.toFixed(2)}s)
                                {/* Optional: Add confidence score if available in future */}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>

                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground font-medium">Debug: Audio Tracks</summary>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto bg-muted p-4 rounded text-xs font-mono">
                        {videoProps.audioTracks.map((a, i) => (
                          <div key={i}>Track {i}: Start {a.startFrame}f, Dur {a.durationInFrames}f ({a.src.split('/').pop()})</div>
                        ))}
                      </div>
                    </details>

                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground font-medium">Debug: Raw JSON</summary>
                      <pre className="mt-2 text-[10px] opacity-50 max-h-40 overflow-auto bg-black/5 p-2 rounded">
                        {JSON.stringify(videoProps, (key, val) =>
                          typeof val === 'string' && val.startsWith('data:image')
                            ? `[BASE64_IMAGE_${val.length}_BYTES]`
                            : val, 2)}
                      </pre>
                    </details>
                  </div>

                </CardContent>
              </Card>
            </>
          )
        }

        {/* STAGE 7: DOWNLOAD */}
        {
          currentStage === 'DOWNLOAD' && (
            <>
              <StageControls
                onRegenerate={() => { }}
                onNext={() => { }}
                nextLabel="Finalizar"
                hideNext={true}
                hideRegenerate={true}
              />
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Download - {scriptText.substring(0, 20)}...</CardTitle></CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                    <p className="text-muted-foreground text-center max-w-md">
                      Seu projeto está pronto! Clique no botão abaixo para baixar todos os arquivos (imagens, áudio e roteiro) em um arquivo ZIP.
                    </p>
                    <Button onClick={handleDownloadZip} disabled={isDownloading} size="lg" className="w-full max-w-xs">
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                      Baixar ZIP Completo
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )
        }
        <ScrollToTop />
      </main>
    </div>
  )
}