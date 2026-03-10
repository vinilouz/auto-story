"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft, Save, Loader2, Play, ChevronRight, ChevronLeft,
  RefreshCw, Upload, Sparkles, Download, X, Check
} from "lucide-react"
import { toast } from "sonner"
import {
  Segment, EntityAsset, CaptionStyle, CommentatorConfig, DEFAULT_CAPTION_STYLE
} from "@/lib/flows/types"
import { NAGA_VOICES } from "@/config/voices"
import { VoicePicker } from "@/components/ui/voice-picker"
import { ACTIONS, getVideoClipDuration } from "@/lib/ai/config"
import {
  useAudio, useTranscription, useVideo, useVideoClips,
  useProject, useDownload, splitTranscriptionByDuration
} from "@/lib/flows/hooks"
import { VideoPlayer } from "@/components/video/VideoPlayer"
import {
  GENERATE_ENTITY_IMAGE_PROMPT, GENERATE_SEGMENT_IMAGE_PROMPT,
  COMMENTATOR_IMAGE_GENERATION_PROMPT
} from "@/lib/ai/prompts/prompts"
import { cn } from "@/lib/utils"

// ── Stages ─────────────────────────────────────────────────

type Stage =
  | 'input' | 'commentator' | 'comments' | 'descriptions'
  | 'entities' | 'images' | 'audio' | 'transcription'
  | 'split' | 'clips' | 'video' | 'download'

type FlowMode = 'simple' | 'commentator' | 'video-story'

function getStages(mode: FlowMode, consistency: boolean): Stage[] {
  if (mode === 'video-story') {
    return ['input', 'audio', 'transcription', 'split',
      ...(consistency ? ['entities' as Stage] : []),
      'descriptions', 'images', 'clips', 'video', 'download']
  }
  return ([
    'input', 'commentator', 'comments',
    ...(consistency ? ['entities' as Stage] : []),
    'descriptions', 'images', 'audio', 'transcription', 'video', 'download'
  ] as Stage[]).filter(s => {
    if (s === 'commentator' || s === 'comments') return mode === 'commentator'
    return true
  })
}

const STAGE_LABELS: Record<Stage, string> = {
  input: 'Input', commentator: 'Commentator', comments: 'Comments',
  descriptions: 'Descriptions', entities: 'Entities', images: 'Images',
  audio: 'Audio', transcription: 'Transcription', video: 'Video',
  download: 'Download', split: 'Split',
  clips: 'Video Clips',
}

// ── Props ──────────────────────────────────────────────────

interface Props {
  mode: FlowMode
  projectId: string
  onBack: () => void
}

export default function StoryFlow({ mode, projectId, onBack }: Props) {
  // ── Navigation ──
  const [stage, setStage] = useState<Stage>('input')

  // ── Input state ──
  const [title, setTitle] = useState("")
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([150])
  const [language, setLanguage] = useState("english")
  const [imagePromptStyle, setImagePromptStyle] = useState("")
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb")
  const [consistency, setConsistency] = useState(false)

  // ── Commentator ──
  const [commentator, setCommentator] = useState<CommentatorConfig | null>(null)
  const [commName, setCommName] = useState("")
  const [commPersonality, setCommPersonality] = useState("")
  const [commImagePrompt, setCommImagePrompt] = useState("")
  const [commImage, setCommImage] = useState<string | null>(null)
  const [audioSystemPrompt, setAudioSystemPrompt] = useState("")

  // ── Pipeline data ──
  const [segments, setSegments] = useState<Segment[]>([])
  const [entities, setEntities] = useState<EntityAsset[]>([])
  const [imageStatuses, setImageStatuses] = useState<Map<number, 'generating' | 'error'>>(new Map())
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)

  // ── Loading ──
  const [loading, setLoading] = useState(false)

  // ── Hooks ──
  const audio = useAudio()
  const transcription = useTranscription()
  const videoClips = useVideoClips()
  const video = useVideo()
  const project = useProject()
  const dl = useDownload()

  // ── Derived ──
  const stages = useMemo(() => getStages(mode, consistency), [mode, consistency])
  const stageIdx = stages.indexOf(stage)
  const hasPrompts = segments.some(s => s.imagePrompt)
  const hasImages = segments.some(s => s.imagePath)
  const hasClips = segments.some(s => s.videoClipUrl)
  const hasComments = segments.some(s => s.type === 'comment')
  const hasAudio = audio.batches.some(b => b.status === 'completed' && b.url)
  const hasTranscription = transcription.results.length > 0
  const clipDuration = getVideoClipDuration()

  const maxStep = useMemo(() => {
    const idx = (s: Stage) => { const i = stages.indexOf(s); return i === -1 ? 0 : i }

    if (mode === 'video-story') {
      if (video.videoProps) return idx('download')
      if (hasClips) return idx('video')
      if (hasImages) return idx('clips')
      if (hasPrompts) return idx('images')
      if (consistency && entities.length > 0) return idx('descriptions')
      if (segments.length > 0) return idx(consistency ? 'entities' : 'descriptions')
      if (hasTranscription) return idx('split')
      if (hasAudio) return idx('transcription')
      return 0
    }

    if (video.videoProps) return idx('download')
    if (hasTranscription) return idx('video')
    if (hasAudio) return idx('transcription')
    if (hasImages) return idx('audio')
    if (hasPrompts) return idx('images')
    if (consistency && entities.length > 0) return idx('descriptions')
    if (hasComments && mode === 'commentator') return idx(consistency ? 'entities' : 'descriptions')
    if (commentator && mode === 'commentator') return idx('comments')
    if (segments.length > 0) return idx(mode === 'commentator' ? (consistency ? 'commentator' : 'descriptions') : (consistency ? 'entities' : 'descriptions'))
    return 0
  }, [stages, mode, video.videoProps, hasTranscription, hasAudio, hasImages, hasClips, hasPrompts, entities, hasComments, commentator, segments, consistency])

  // ── Load project ──
  useEffect(() => {
    project.load(projectId).then(p => {
      if (!p) return
      if (p.name) setTitle(p.name)
      if (p.scriptText) setScriptText(p.scriptText)
      if (p.segmentSize) setSegmentSize([p.segmentSize])
      if (p.language) setLanguage(p.language)
      if (p.style) setImagePromptStyle(p.style)
      if (p.voice) setAudioVoice(p.voice)
      if (p.consistency) setConsistency(p.consistency)
      if (p.segments) setSegments(p.segments)
      if (p.entities) setEntities(p.entities)
      if (p.commentator) {
        setCommentator(p.commentator)
        setCommName(p.commentator.name)
        setCommPersonality(p.commentator.personality)
        if (p.commentator.appearance?.imageUrl) setCommImage(p.commentator.appearance.imageUrl)
      }
      if (p.audioBatches) audio.setBatches(p.audioBatches)
      if (p.audioSystemPrompt) setAudioSystemPrompt(p.audioSystemPrompt)
      if (p.transcriptionResults) transcription.setResults(p.transcriptionResults)

      // Determine stage
      if (mode === 'video-story') {
        if (p.segments?.some((s: any) => s.videoClipUrl)) setStage('clips')
        else if (p.segments?.some((s: any) => s.imagePath)) setStage('images')
        else if (p.segments?.some((s: any) => s.imagePrompt)) setStage('descriptions')
        else if (p.segments?.length) setStage('split')
        else if (p.transcriptionResults?.length) setStage('transcription')
        else if (p.audioBatches?.some((b: any) => b.status === 'completed')) setStage('audio')
      } else {
        if (p.transcriptionResults?.length) setStage('video')
        else if (p.audioBatches?.some((b: any) => b.status === 'completed')) setStage('audio')
        else if (p.segments?.some((s: any) => s.imagePath)) setStage('images')
        else if (p.segments?.some((s: any) => s.imagePrompt)) setStage('descriptions')
        else if (p.segments?.length) setStage(mode === 'commentator' ? 'commentator' : 'descriptions')
      }
    }).catch(() => toast.error("Failed to load project"))
  }, [projectId])

  // ── Save ──
  const save = async (extra?: any) => {
    const data = {
      name: title || scriptText.substring(0, 30),
      flowType: mode === 'commentator' ? 'with-commentator' : mode,
      scriptText, segmentSize: segmentSize[0], language,
      style: imagePromptStyle, voice: audioVoice, consistency,
      segments, entities,
      commentator: commentator || undefined,
      audioBatches: audio.batches, audioSystemPrompt,
      transcriptionResults: transcription.results,
      ...extra,
    }
    const saved = await project.save(data)
    toast.success("Saved!")
    return saved
  }

  const audioOpts = () => ({
    text: mode === 'commentator'
      ? segments.filter(s => s.type).map(s => `${s.type === 'comment' ? 'commentator' : 'narrator'}: ${s.text}`).join('\n')
      : scriptText,
    voice: audioVoice, systemPrompt: audioSystemPrompt,
    projectId: project.projectId || projectId, projectName: title || 'untitled',
  })

  // ════════════════════════════════════════════════════════════
  //  ACTIONS — shared
  // ════════════════════════════════════════════════════════════

  const splitScenes = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/generate/split", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scriptText, segmentLength: segmentSize[0] }),
      })
      if (!res.ok) throw new Error()
      const newSegs: Segment[] = (await res.json()).segments.map((t: string) => ({ text: t }))
      setSegments(newSegs)
      setStage(mode === 'commentator' ? 'commentator' : 'descriptions')
      await save({ segments: newSegs })
    } catch { toast.error("Failed to split") }
    finally { setLoading(false) }
  }

  const saveCommentator = async () => {
    const config: CommentatorConfig = {
      id: commentator?.id || Date.now().toString(), name: commName, personality: commPersonality,
      appearance: { type: commImage?.startsWith('data:') ? 'upload' : 'generated', imageUrl: commImage || undefined, imagePrompt: commImagePrompt || undefined },
    }
    setCommentator(config); setStage('comments'); await save({ commentator: config })
  }

  const generateComments = async () => {
    if (!commentator) return; setLoading(true)
    try {
      const res = await fetch("/api/generate/commentator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: segments.map(s => s.text), commentatorDescription: `Name: ${commentator.name}. Personality: ${commentator.personality}` })
      })
      if (!res.ok) throw new Error()
      const data = await res.json(); setSegments(data.segments); await save({ segments: data.segments })
    } catch { toast.error("Failed") } finally { setLoading(false) }
  }

  const extractEntities = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/generate/entities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments })
      })
      if (!res.ok) throw new Error()
      const { entities: extracted } = await res.json()
      const ents: EntityAsset[] = extracted.map((e: any) => ({
        name: e.type,
        description: e.description,
        segment: e.segment,
        status: 'pending' as const
      }))
      setEntities(ents)
      await save({ entities: ents })
    } catch { toast.error("Failed to extract entities") } finally { setLoading(false) }
  }

  const generateDescriptions = async () => {
    setLoading(true)
    try {
      const segsForApi = mode === 'commentator'
        ? segments.map(s => s.type === 'comment' ? { ...s, text: `[Commentary by ${commentator?.name}]: ${s.text}` } : s)
        : segments
      const entitiesForApi = entities.map(e => ({ type: e.name, description: e.description || '', segment: e.segment || [] }))
      const res = await fetch("/api/generate/descriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segsForApi,
          entities: entitiesForApi,
          language,
          style: imagePromptStyle,
          commentatorName: commentator?.name,
          commentatorPersonality: commentator?.personality
        })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSegments(data.segments || segments)
      await save({ segments: data.segments })
    } catch { toast.error("Failed") } finally { setLoading(false) }
  }

  const generateEntities = async () => {
    setLoading(true)
    try {
      let pid = project.projectId; if (!pid) { const s = await save(); pid = s?.id }

      const missing = entities.filter(e => !e.imageUrl)
      const targets = missing.length > 0 ? missing : entities

      const processing = entities.map(e => {
        if (!targets.some(t => t.name === e.name)) return e
        return { ...e, status: 'generating' as const }
      })
      setEntities(processing)

      const completed = await Promise.all(processing.map(async e => {
        if (!targets.some(t => t.name === e.name) || !e.description) return e
        try {
          const r = await fetch("/api/generate/images", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(e.description, undefined, imagePromptStyle),
              imageConfig: { aspect_ratio: "16:9" }, projectId: pid, projectName: title
            })
          })
          if (!r.ok) throw new Error()
          return { ...e, imageUrl: (await r.json()).imageUrl, status: 'completed' as const }
        } catch { return { ...e, status: 'error' as const } }
      }))

      setEntities(completed); await save({ entities: completed })
    } catch { toast.error("Failed") } finally { setLoading(false) }
  }

  const generateSingleImage = async (segIndex: number) => {
    const seg = segments[segIndex]; if (!seg?.imagePrompt) return
    setImageStatuses(p => new Map(p).set(segIndex, 'generating'))
    try {
      const prompt = mode === 'commentator' && commentator?.appearance?.imageUrl
        ? COMMENTATOR_IMAGE_GENERATION_PROMPT(seg.imagePrompt) : GENERATE_SEGMENT_IMAGE_PROMPT(seg.imagePrompt, imagePromptStyle)
      const payload: any = { imagePrompt: prompt, imageConfig: { aspect_ratio: "16:9" }, systemPrompt: imagePromptStyle, projectId: project.projectId || projectId, projectName: title, index: segIndex }
      const matches = prompt.match(/<<([^>]+)>>/g)
      if (matches && entities.length) { const refs = entities.filter(e => matches.some(m => m.includes(e.name)) && e.imageUrl).map(e => e.imageUrl!); if (refs.length) payload.referenceImages = refs }
      else if (mode === 'commentator' && commentator?.appearance?.imageUrl) payload.referenceImage = commentator.appearance.imageUrl
      const res = await fetch('/api/generate/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      const data = await res.json()
      let updatedSegs: Segment[] = []
      setSegments(prev => {
        updatedSegs = prev.map((s, j) => j === segIndex ? { ...s, imagePath: data.imageUrl } : s)
        return updatedSegs
      })
      setImageStatuses(p => { const n = new Map(p); n.delete(segIndex); return n })
      await save({ segments: updatedSegs })
    } catch { setImageStatuses(p => new Map(p).set(segIndex, 'error')) }
  }

  const generateAllImages = async () => {
    let pid = project.projectId; if (!pid) { const s = await save(); pid = s?.id }

    if (consistency && entities.length > 0 && entities.some(e => !e.imageUrl)) {
      await generateEntities()
    }

    const isRegen = segments.every(s => s.imagePath)
    const queue: number[] = segments
      .map((seg, i) => (!seg.imagePrompt || (!isRegen && seg.imagePath)) ? -1 : i)
      .filter(i => i >= 0)

    const total = queue.length
    const progress = { done: 0, failed: 0 }
    console.log(`[image] Queue: ${total} items`)

    const failed = new Map<number, number>()
    const MAX_ATTEMPTS = 3

    while (queue.length > 0) {
      const batch = queue.splice(0, queue.length)
      const batchFailed: number[] = []

      await Promise.all(batch.map(async (segIndex) => {
        console.log(`[image] ${progress.done + 1}/${total} -> segment ${segIndex + 1}`)
        try {
          await generateSingleImage(segIndex)
          progress.done++
          console.log(`[image] ${progress.done}/${total} -> done`)
        } catch (e) {
          const attempts = (failed.get(segIndex) || 0) + 1
          if (attempts < MAX_ATTEMPTS) {
            failed.set(segIndex, attempts)
            batchFailed.push(segIndex)
            console.warn(`[image] segment ${segIndex + 1} -> retry ${attempts}/${MAX_ATTEMPTS}`)
          } else {
            progress.failed++
            console.error(`[image] segment ${segIndex + 1} -> error`)
            setImageStatuses(p => new Map(p).set(segIndex, 'error'))
          }
        }
      }))

      queue.push(...batchFailed)
    }

    console.log(`[image] Done: ${progress.done}/${total}, failed: ${progress.failed}`)
  }

  const generateAudioAction = async () => {
    const newBatches = await audio.generate(audioOpts())
    setStage('audio');
    await save({ audioBatches: newBatches })
  }

  const transcribeAction = async () => {
    const newResults = await transcription.transcribe(audio.batches, language)
    setStage('transcription');
    if (newResults) await save({ transcriptionResults: newResults })
  }

  // ════════════════════════════════════════════════════════════
  //  ACTIONS — video-story specific
  // ════════════════════════════════════════════════════════════

  const splitByDuration = () => {
    const newSegs = splitTranscriptionByDuration(transcription.results, audio.batches, clipDuration)
    if (newSegs.length === 0) { toast.error("No words found in transcription"); return }
    setSegments(newSegs)
    setStage('split')
    save({ segments: newSegs })
  }



  const generateAllClips = async () => {
    let pid = project.projectId; if (!pid) { const s = await save(); pid = s?.id }
    await videoClips.generateAll(segments, setSegments, {
      projectId: pid || projectId,
      projectName: title,
      clipDuration,
      onClipCompleted: async (newSegments) => { await save({ segments: newSegments }) }
    })
  }

  const generateVideoPreview = async () => {
    try {
      const segs = segments.filter(s => s.imagePrompt).map((s, i) => ({
        id: `seg-${i}`,
        text: s.text,
        imageUrl: s.videoClipUrl || s.imagePath || '',
      }))
      const alignmentMode = mode === 'video-story' ? 'video' as const : 'image' as const
      await video.generate(segs, audio.batches, transcription.results, alignmentMode)
      setStage('video')
    } catch (e: any) { toast.error(`Video generation failed: ${e.message}`) }
  }

  const renderVideoAction = async () => {
    if (!video.videoProps) return
    try {
      // For video-story, map videoClipUrl into the scenes
      const props = mode === 'video-story'
        ? {
          ...video.videoProps,
          scenes: video.videoProps.scenes.map((scene, i) => ({
            ...scene,
            videoClipUrl: segments[i]?.videoClipUrl || undefined,
          })),
        }
        : video.videoProps
      await video.render(props, captionStyle, project.projectId || undefined, title)
    } catch (e: any) { toast.error(`Render failed: ${e.message}`) }
  }

  const downloadZipAction = async () => {
    try {
      await dl.downloadZip({
        segments,
        audioUrls: audio.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
        transcriptionResults: transcription.results,
        filename: `${mode}-story-${Date.now()}.zip`,
      })
    } catch { toast.error("Download failed") }
  }

  // ── Execute config ──
  const exec = (() => {
    switch (stage) {
      case 'input':
        if (mode === 'video-story')
          return { fn: generateAudioAction, ok: !!scriptText.trim(), label: "Generate Audio", busy: audio.isLoading }
        return { fn: splitScenes, ok: !!scriptText.trim(), label: "Split Scenes", busy: loading }
      case 'commentator':
        return { fn: saveCommentator, ok: !!commName.trim() && !!commImage, label: "Save Commentator", busy: false }
      case 'comments':
        return { fn: generateComments, ok: !!commentator, label: hasComments ? "Regenerate" : "Generate Comments", busy: loading }
      case 'descriptions':
        return { fn: generateDescriptions, ok: segments.length > 0, label: hasPrompts ? "Regenerate" : "Generate Descriptions", busy: loading }
      case 'entities':
        return { fn: extractEntities, ok: segments.length > 0, label: entities.length > 0 ? "Regenerate" : "Extract Entities", busy: loading }
      case 'images':
        return { fn: generateAllImages, ok: hasPrompts, label: hasImages ? "Regenerate" : "Generate Images", busy: imageStatuses.size > 0 }
      case 'audio':
        if (mode === 'video-story')
          return { fn: generateAudioAction, ok: !!scriptText.trim(), label: hasAudio ? "Regenerate Audio" : "Generate Audio", busy: audio.isLoading }
        return { fn: generateAudioAction, ok: segments.length > 0, label: hasAudio ? "Regenerate" : "Generate Audio", busy: audio.isLoading }
      case 'transcription':
        return { fn: transcribeAction, ok: hasAudio, label: "Transcribe", busy: transcription.isLoading }
      case 'split':
        return { fn: splitByDuration, ok: hasTranscription, label: `Split by ${clipDuration}s clips`, busy: false }
      case 'clips':
        return { fn: generateAllClips, ok: hasImages, label: hasClips ? "Regenerate Clips" : "Generate Video Clips", busy: videoClips.isLoading }
      case 'video':
        return { fn: generateVideoPreview, ok: mode === 'video-story' ? hasClips || hasTranscription : hasTranscription, label: video.videoProps ? "Regenerate" : "Generate Preview", busy: video.isGenerating }
      case 'download':
        return { fn: downloadZipAction, ok: true, label: "Download ZIP", busy: dl.isDownloading }
    }
  })()!

  const canNext = stageIdx < maxStep

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════

  const modeTitle = mode === 'video-story' ? 'Video Story' : mode === 'commentator' ? 'Story with Commentator' : 'Simple Story'

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Header */}
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
            <h1 className="text-2xl font-bold">{modeTitle}</h1>
          </div>
          <Button onClick={() => save()} disabled={!scriptText.trim() || project.isSaving} variant="outline">
            {project.isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save
          </Button>
        </header>

        {/* Tabs */}
        <Tabs value={stage} onValueChange={v => { if (stages.indexOf(v as Stage) <= maxStep) setStage(v as Stage) }}>
          <TabsList className="w-full flex-wrap justify-start p-1">
            {stages.map((s, i) => (
              <TabsTrigger key={s} value={s} disabled={i > maxStep}
                className="flex-1 py-2 text-xs sm:text-sm truncate data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {i + 1}. {STAGE_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ═══ STAGES ═══ */}

        {/* INPUT */}
        {stage === 'input' && (
          <Card>
            <CardHeader><CardTitle>Project Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title (optional)</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Story title..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="portuguese">Portuguese</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Script</label>
                <Textarea value={scriptText} onChange={e => setScriptText(e.target.value)} placeholder="Your story..." className="min-h-[200px]" />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {mode !== 'video-story' && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Segment size: {segmentSize[0]} chars</label>
                    <Slider value={segmentSize} onValueChange={setSegmentSize} max={500} min={100} step={10} />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voice</label>
                  <VoicePicker
                    voices={NAGA_VOICES.map(v => ({ voiceId: v.externalId, name: v.name, previewUrl: v.previewUrl, labels: { description: v.description } } as any))}
                    value={audioVoice}
                    onValueChange={setAudioVoice}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Image/Video Style (System Prompt)</label>
                <Textarea value={imagePromptStyle} onChange={e => setImagePromptStyle(e.target.value)} placeholder="Visual style..." className="min-h-[80px]" />
              </div>
              {mode === 'video-story' && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <p className="text-sm">
                      <strong>Video models:</strong>{' '}
                      {ACTIONS.generateVideo.map(m => `${m.model} (${m.clipDuration}s)`).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      First available model will be used. Audio will be split into ~{clipDuration}s segments, each generating one AI video clip.
                    </p>
                  </CardContent>
                </Card>
              )}
              {(mode === 'simple' || mode === 'video-story') && (
                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Switch checked={consistency} onCheckedChange={setConsistency} />
                  <div>
                    <label className="text-base font-medium">Character Consistency</label>
                    <p className="text-sm text-muted-foreground">Extract entities and generate reference images.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* COMMENTATOR */}
        {stage === 'commentator' && (
          <Card>
            <CardHeader><CardTitle>Configure Commentator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Name" value={commName} onChange={e => setCommName(e.target.value)} />
              <Textarea placeholder="Personality..." value={commPersonality} onChange={e => setCommPersonality(e.target.value)} rows={3} />
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Textarea placeholder="Describe appearance..." value={commImagePrompt} onChange={e => setCommImagePrompt(e.target.value)} rows={2} />
                  <Button onClick={async () => {
                    if (!commImagePrompt.trim()) return; setLoading(true)
                    try { const r = await fetch('/api/generate/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagePrompt: commImagePrompt }) }); if (r.ok) { const d = await r.json(); if (d.imageUrl) setCommImage(d.imageUrl) } } finally { setLoading(false) }
                  }} disabled={loading || !commImagePrompt.trim()} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />} Generate
                  </Button>
                </div>
                <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
                  {commImage ? <img src={commImage} alt="" className="w-full h-full object-cover" /> :
                    <div className="text-center p-2"><input type="file" accept="image/*" className="hidden" id="comm-upload" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setCommImage(r.result as string); r.readAsDataURL(f) } }} /><label htmlFor="comm-upload" className="cursor-pointer text-xs text-muted-foreground"><Upload className="w-6 h-6 mx-auto mb-1" />Upload</label></div>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* COMMENTS */}
        {stage === 'comments' && (
          <Card>
            <CardHeader><CardTitle>Segments</CardTitle></CardHeader>
            <CardContent>
              {!hasComments ? <p className="text-center py-8 text-muted-foreground">Click below to generate.</p> :
                <div className="space-y-3">
                  {segments.filter(s => s.type).map((seg, i) => (
                    <div key={i} className={cn("p-3 rounded-lg text-sm", seg.type === 'comment' ? "bg-blue-50 border border-blue-100 italic" : "bg-muted/50")}>
                      {seg.type === 'comment' && commentator?.appearance?.imageUrl && <img src={commentator.appearance.imageUrl} className="w-6 h-6 rounded-full inline mr-2" alt="" />}
                      {seg.text}
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>
        )}

        {/* DESCRIPTIONS (simple/commentator) */}
        {stage === 'descriptions' && (
          <div className="space-y-4">
            {segments.map((seg, i) => (
              <Card key={i}><CardContent className="p-4 space-y-2">
                <div className="font-semibold text-xs text-muted-foreground uppercase">Scene {i + 1} {seg.type === 'comment' && '(Comment)'}</div>
                <p className="text-sm">{seg.text}</p>
                {seg.imagePrompt && <div className="bg-muted p-2 rounded text-sm italic text-muted-foreground border-l-2">{seg.imagePrompt}</div>}
              </CardContent></Card>
            ))}
          </div>
        )}

        {/* ENTITIES */}
        {stage === 'entities' && (
          <div className="space-y-6">
            <Card><CardHeader><CardTitle>Entities</CardTitle></CardHeader><CardContent>
              <div className="flex flex-wrap gap-2">{entities.map((e, i) => <span key={i} className="bg-muted px-3 py-1.5 rounded-full text-sm font-semibold border">{e.name}</span>)}</div>
            </CardContent></Card>
            {entities.some(e => e.description || e.imageUrl) && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entities.map((e, i) => (
                  <Card key={i} className="overflow-hidden p-0">
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {e.imageUrl ? <img src={e.imageUrl} alt={e.name} className="object-cover w-full h-full" /> :
                        <div className="text-muted-foreground text-sm">{e.status === 'generating' || loading ? <Loader2 className="h-8 w-8 animate-spin" /> : 'Pending'}</div>}
                    </div>
                    <CardContent><h3 className="font-bold">{e.name}</h3>{e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}</CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IMAGES (simple/commentator) */}
        {stage === 'images' && (
          <div className="grid grid-cols-2 gap-4">
            {segments.filter(s => s.imagePrompt).map((seg, i) => {
              const realIdx = segments.indexOf(seg); const st = imageStatuses.get(realIdx)
              return (
                <Card key={i}><CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground italic">{seg.imagePrompt}</p>
                  {seg.imagePath && st !== 'generating' ? (
                    <div className="relative group">
                      <img src={seg.imagePath} alt="" className="w-full rounded" />
                      <Button size="icon" variant="secondary" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => generateSingleImage(realIdx)}><RefreshCw className="w-4 h-4" /></Button>
                    </div>
                  ) : st === 'generating' ? <Skeleton className="w-full h-48" /> :
                    st === 'error' ? <div className="h-48 bg-muted rounded flex flex-col items-center justify-center gap-2"><span className="text-sm text-muted-foreground">Error</span><Button variant="outline" size="sm" onClick={() => generateSingleImage(realIdx)}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button></div> :
                      <div className="h-48 bg-muted/40 rounded flex items-center justify-center border border-dashed text-muted-foreground/50 text-sm">Waiting...</div>}
                </CardContent></Card>
              )
            })}
          </div>
        )}

        {/* AUDIO */}
        {stage === 'audio' && (
          <Card>
            <CardHeader><div className="flex justify-between items-center"><CardTitle>Audio</CardTitle>
              {audio.batches.length > 0 && <span className="text-xs text-muted-foreground">{audio.batches.filter(b => b.status === 'completed').length}/{audio.batches.length}</span>}
            </div></CardHeader>
            <CardContent>
              {!audio.batches.length && !audio.isLoading ? <p className="text-center py-8 text-muted-foreground">Click below to generate.</p> :
                audio.isLoading && !audio.batches.length ? <div className="flex justify-center py-8 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Generating...</div> :
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {audio.batches.map(b => (
                      <div key={b.index} className={cn("p-3 rounded border text-sm", b.status === 'error' ? "bg-red-50/50 border-red-200" : b.status === 'completed' ? "bg-green-50/30 border-green-200/50" : "bg-muted/50")}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono text-xs">#{b.index + 1} — {b.status}</span>
                          <div className="flex gap-1">
                            {b.status === 'completed' && b.url && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => new Audio(b.url!).play()}><Play className="w-3 h-3" /></Button>}
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => audio.regenerateBatch(b.index, audioOpts())} disabled={b.status === 'generating'}>{b.status === 'error' ? 'Retry' : 'Redo'}</Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 border-l-2 pl-1">{b.text}</p>
                        {b.status === 'completed' && b.url && <audio controls src={b.url} className="w-full h-8 mt-1" />}
                      </div>
                    ))}
                  </div>}
            </CardContent>
          </Card>
        )}

        {/* TRANSCRIPTION */}
        {stage === 'transcription' && (
          <Card>
            <CardHeader><CardTitle>Transcription (free proxy)</CardTitle></CardHeader>
            <CardContent>
              {!transcription.results.length && !transcription.isLoading ? <p className="text-center py-8 text-muted-foreground">Click "Transcribe" below.</p> :
                transcription.isLoading && !transcription.results.length ? <div className="flex justify-center py-8 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Finding proxies...</div> :
                  <div className="space-y-3">
                    {audio.batches.filter(b => b.status === 'completed' && b.url).map((b, i) => {
                      const r = transcription.results.find(r => r.url === b.url)
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded border">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                            <span className="text-sm truncate max-w-[300px]">{b.text.substring(0, 50)}...</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {r?.status === 'completed' ? <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Done</span> :
                              r?.status === 'error' ? <><span className="text-xs text-red-600"><X className="w-3 h-3 inline" />Error</span><Button size="sm" variant="ghost" className="h-6" onClick={() => transcription.retry(b.url!, language)}><RefreshCw className="w-3 h-3" /></Button></> :
                                <span className="text-xs text-muted-foreground">{transcription.isLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Pending'}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>}
            </CardContent>
          </Card>
        )}

        {/* SPLIT (video-story only) */}
        {stage === 'split' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audio Split into {clipDuration}s Segments</CardTitle>
                <CardDescription>
                  {segments.length > 0
                    ? `${segments.length} segments created. Each will become one AI video clip.`
                    : `Click below to split your transcribed audio into ~${clipDuration}s windows.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {segments.length > 0 && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {segments.map((seg, i) => (
                      <div key={i} className="p-3 bg-muted/50 rounded border text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="font-mono text-xs font-bold">#{i + 1}</span>
                          <span className="text-xs text-muted-foreground">
                            {((seg.startMs || 0) / 1000).toFixed(1)}s — {((seg.endMs || 0) / 1000).toFixed(1)}s
                          </span>
                        </div>
                        <p className="text-sm">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIDEO CLIPS (video-story only) */}
        {stage === 'clips' && (
          <div className="grid grid-cols-2 gap-4">
            {segments.filter(s => s.imagePrompt).map((seg, i) => {
              const st = videoClips.clipStatuses.get(i)
              return (
                <Card key={i}><CardContent className="p-4 space-y-2">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-xs font-bold">Clip #{i + 1}</span>
                    <span className="text-xs text-muted-foreground">{clipDuration}s</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic line-clamp-2">{seg.imagePrompt}</p>
                  {seg.videoClipUrl && st !== 'generating' ? (
                    <div className="relative group">
                      <video src={seg.videoClipUrl} controls className="w-full rounded" />
                      <Button size="icon" variant="secondary" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                        onClick={() => videoClips.regenerateClip(i, segments, setSegments, {
                          projectId: project.projectId || projectId, projectName: title, clipDuration,
                          onClipCompleted: async (newSegments) => { await save({ segments: newSegments }) }
                        })}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : st === 'generating' ? (
                    <div className="w-full h-48 bg-muted rounded animate-pulse flex items-center justify-center">
                      <div className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /><span className="text-xs text-muted-foreground">Generating {clipDuration}s clip...</span></div>
                    </div>
                  ) : st === 'error' ? (
                    <div className="h-48 bg-muted rounded flex flex-col items-center justify-center gap-2">
                      <span className="text-sm text-muted-foreground">Error</span>
                      <Button variant="outline" size="sm" onClick={() => videoClips.regenerateClip(i, segments, setSegments, {
                        projectId: project.projectId || projectId, projectName: title, clipDuration,
                        onClipCompleted: async (newSegments) => { await save({ segments: newSegments }) }
                      })}>
                        <RefreshCw className="w-4 h-4 mr-2" />Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="h-48 bg-muted/40 rounded flex items-center justify-center border border-dashed text-muted-foreground/50 text-sm">Waiting...</div>
                  )}
                </CardContent></Card>
              )
            })}
          </div>
        )}

        {/* VIDEO (all modes — Remotion compilation) */}
        {stage === 'video' && (
          <Card>
            <CardHeader><CardTitle>Video Compilation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Size ({captionStyle.fontSize}px)</label>
                  <Slider min={40} max={150} step={5} value={[captionStyle.fontSize]} onValueChange={v => setCaptionStyle(p => ({ ...p, fontSize: v[0] }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Highlight Color</label>
                  <div className="flex gap-2">
                    {["#FFE81F", "#FFFFFF", "#00FF00", "#FF00FF", "#00FFFF"].map(c => (
                      <button key={c} className={cn("w-6 h-6 rounded-full border", captionStyle.highlightColor === c && "ring-2 ring-primary ring-offset-2")} style={{ backgroundColor: c }} onClick={() => setCaptionStyle(p => ({ ...p, highlightColor: c }))} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Words/Line</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Button key={n} variant={captionStyle.maxWordsPerLine === n ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setCaptionStyle(p => ({ ...p, maxWordsPerLine: n }))}>{n}</Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={renderVideoAction} disabled={video.isRendering || !video.videoProps}>
                  {video.isRendering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering...</> : <><Download className="w-4 h-4 mr-2" />Render MP4</>}
                </Button>
              </div>
              {video.renderProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{video.renderProgress.stage === 'bundling' ? 'Bundling...' : video.renderProgress.stage === 'rendering' ? `Rendering ${video.renderProgress.renderedFrames ?? 0}/${video.renderProgress.totalFrames ?? '?'}` : 'Encoding...'}</span>
                    <span>{video.renderProgress.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${video.renderProgress.progress}%` }} /></div>
                </div>
              )}
              {video.videoProps ? <VideoPlayer props={{ ...video.videoProps, captionStyle }} /> :
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center"><p className="text-muted-foreground">Click "Generate Preview" below</p></div>}
              {video.videoProps && (
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground font-medium">Debug</summary>
                  <div className="mt-2 text-xs font-mono bg-muted p-3 rounded max-h-60 overflow-y-auto">
                    <p>Scenes: {video.videoProps.scenes.length} | Duration: {video.videoProps.durationInFrames}f ({(video.videoProps.durationInFrames / video.videoProps.fps).toFixed(1)}s)</p>
                    <p>Audio: {video.videoProps.audioTracks.length} tracks | Captions: {video.videoProps.captions.length}</p>
                    <p>Video clips: {video.videoProps.scenes.filter(s => s.videoClipUrl).length}</p>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {/* DOWNLOAD */}
        {stage === 'download' && (
          <Card>
            <CardHeader><CardTitle>Download</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
              <p className="text-muted-foreground text-center max-w-md">All assets ready. Download as ZIP.</p>
              <Button onClick={downloadZipAction} disabled={dl.isDownloading} size="lg" className="w-full max-w-xs">
                {dl.isDownloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />} Download ZIP
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-md z-40 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => { if (stageIdx > 0) setStage(stages[stageIdx - 1]) }} disabled={stageIdx === 0} className="w-28">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="lg" onClick={exec.fn} disabled={!exec.ok || exec.busy} className="flex-1 max-w-sm rounded-full shadow-lg font-semibold">
            {exec.busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />} {exec.label}
          </Button>
          <Button onClick={() => { if (canNext) setStage(stages[stageIdx + 1]) }} disabled={!canNext}
            className={cn("w-28 transition-all", canNext ? "shadow-md ring-2 ring-primary/20" : "opacity-40")}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}