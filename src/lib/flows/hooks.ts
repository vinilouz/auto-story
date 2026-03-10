import { useState, useCallback, useRef } from "react"
import { AudioBatch, TranscriptionResult, CaptionStyle, Segment, TranscriptionWord } from "./types"
import { RemotionVideoProps } from "@/lib/video/types"
import { alignVideoProps, AlignmentMode } from "@/lib/video/aligner"

// ── Audio ──────────────────────────────────────────────────

export function useAudio() {
  const [batches, setBatches] = useState<AudioBatch[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const generate = async (opts: {
    text: string; voice?: string; systemPrompt?: string
    projectId: string; projectName: string; targetBatchIndices?: number[]
  }) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/generate/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      })
      if (!res.ok) throw new Error('Audio generation failed')
      const data = await res.json()
      if (data.batches) setBatches(data.batches)
      return data.batches as AudioBatch[]
    } finally { setIsLoading(false) }
  }

  const regenerateBatch = useCallback(async (index: number, opts: Parameters<typeof generate>[0]) => {
    setBatches(prev => {
      const exists = prev.find(b => b.index === index)
      return exists
        ? prev.map(b => b.index === index ? { ...b, status: 'generating' as const } : b)
        : [...prev, { index, text: '', status: 'generating' as const }]
    })
    try {
      const res = await fetch('/api/generate/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...opts, targetBatchIndices: [index] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const updated = data.batches?.find((b: AudioBatch) => b.index === index)
      if (updated) setBatches(prev => prev.map(b => b.index === index ? updated : b))
    } catch {
      setBatches(prev => prev.map(b => b.index === index ? { ...b, status: 'error' as const } : b))
    }
  }, [])

  return { batches, setBatches, generate, regenerateBatch, isLoading }
}

// ── Transcription ──────────────────────────────────────────

export function useTranscription() {
  const [results, setResults] = useState<TranscriptionResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const transcribe = async (audioBatches: AudioBatch[], language: string) => {
    const urls = audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!)
    if (!urls.length) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/generate/transcription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls: urls, language: language === 'english' ? 'en' : 'pt' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      let updatedResults: TranscriptionResult[] = []
      setResults(prev => {
        const map = new Map(prev.map(r => [r.url, r]))
        data.results.forEach((r: TranscriptionResult) => map.set(r.url, r))
        updatedResults = Array.from(map.values())
        return updatedResults
      })
      return updatedResults
    } finally { setIsLoading(false) }
  }

  const retry = useCallback(async (url: string, language: string) => {
    setResults(prev => prev.filter(r => r.url !== url))
    setIsLoading(true)
    try {
      const res = await fetch('/api/generate/transcription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls: [url], language: language === 'english' ? 'en' : 'pt' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      let updatedResults: TranscriptionResult[] = []
      if (data.results?.[0]) {
        setResults(prev => {
          updatedResults = [...prev.filter(r => r.url !== url), data.results[0]]
          return updatedResults
        })
      }
      return updatedResults
    } catch {
      setResults(prev => [...prev, { url, status: 'error' as const, error: 'Retry failed' }])
    } finally { setIsLoading(false) }
  }, [])

  return { results, setResults, transcribe, retry, isLoading }
}

// ── Video Clips (AI-generated 6-8s clips) ──────────────────

export function useVideoClips() {
  const [clipStatuses, setClipStatuses] = useState<Map<number, 'generating' | 'completed' | 'error'>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  const generateAll = async (
    segments: Segment[],
    setSegments: React.Dispatch<React.SetStateAction<Segment[]>>,
    opts: { projectId?: string | null; projectName?: string; clipDuration?: number; onClipCompleted?: (newSegments: Segment[]) => Promise<void> }
  ) => {
    setIsLoading(true)

    const queue: number[] = segments
      .map((seg, i) => (!seg.imagePrompt || seg.videoClipUrl) ? -1 : i)
      .filter(i => i >= 0)

    const total = queue.length
    const progress = { done: 0, failed: 0 }
    console.log(`[video] Queue: ${total} items`)

    const failed = new Map<number, number>()
    const MAX_ATTEMPTS = 3

    while (queue.length > 0) {
      const batch = queue.splice(0, queue.length)
      const batchFailed: number[] = []

      await Promise.all(batch.map(async (i) => {
        console.log(`[video] ${progress.done + 1}/${total} -> clip ${i + 1}`)
        setClipStatuses(p => new Map(p).set(i, 'generating'))

        try {
          const res = await fetch('/api/generate/video-clips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: segments[i].imagePrompt,
              referenceImage: segments[i].imagePath,
              duration: opts.clipDuration,
              projectId: opts.projectId,
              projectName: opts.projectName,
              index: i,
            }),
          })
          if (!res.ok) throw new Error('Clip generation failed')
          const data = await res.json()

          let updatedSegments: Segment[] = []
          setSegments(prev => {
            updatedSegments = prev.map((s, j) => j === i ? { ...s, videoClipUrl: data.videoUrl } : s)
            return updatedSegments
          })
          setClipStatuses(p => new Map(p).set(i, 'completed'))
          progress.done++
          console.log(`[video] ${progress.done}/${total} -> done`)

          if (opts.onClipCompleted) {
            await opts.onClipCompleted(updatedSegments)
          }
        } catch (e) {
          const attempts = (failed.get(i) || 0) + 1
          if (attempts < MAX_ATTEMPTS) {
            failed.set(i, attempts)
            batchFailed.push(i)
            console.warn(`[video] clip ${i + 1} -> retry ${attempts}/${MAX_ATTEMPTS}`)
          } else {
            progress.failed++
            console.error(`[video] clip ${i + 1} -> error`)
            setClipStatuses(p => new Map(p).set(i, 'error'))
          }
        }
      }))

      queue.push(...batchFailed)
    }

    console.log(`[video] Done: ${progress.done}/${total}, failed: ${progress.failed}`)
    setIsLoading(false)
  }

  const regenerateClip = async (
    index: number,
    segments: Segment[],
    setSegments: React.Dispatch<React.SetStateAction<Segment[]>>,
    opts: { projectId?: string | null; projectName?: string; clipDuration?: number; onClipCompleted?: (newSegments: Segment[]) => Promise<void> }
  ) => {
    const seg = segments[index]
    if (!seg?.imagePrompt) return

    setClipStatuses(p => new Map(p).set(index, 'generating'))

    try {
      const res = await fetch('/api/generate/video-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: seg.imagePrompt,
          referenceImage: seg.imagePath,
          duration: opts.clipDuration,
          projectId: opts.projectId,
          projectName: opts.projectName,
          index: index,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      let updatedSegments: Segment[] = []
      setSegments(prev => {
        updatedSegments = prev.map((s, j) => j === index ? { ...s, videoClipUrl: data.videoUrl } : s)
        return updatedSegments
      })
      setClipStatuses(p => new Map(p).set(index, 'completed'))

      if (opts.onClipCompleted) {
        await opts.onClipCompleted(updatedSegments)
      }
    } catch {
      setClipStatuses(p => new Map(p).set(index, 'error'))
    }
  }

  return { clipStatuses, generateAll, regenerateClip, isLoading }
}

// ── Remotion Video (compilation, NOT generation) ───────────

export function useVideo() {
  const [videoProps, setVideoProps] = useState<RemotionVideoProps | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState<{
    progress: number; stage: string; renderedFrames?: number; totalFrames?: number
  } | null>(null)

  const generate = async (
    segments: { id: string; text: string; imageUrl: string }[],
    audioBatches: AudioBatch[],
    transcriptionResults: TranscriptionResult[],
    alignmentMode: AlignmentMode = 'video'
  ) => {
    const completed = audioBatches.filter(b => b.status === 'completed' && b.url)
    const urls = completed.map(b => b.url!)
    const tMap = new Map(transcriptionResults.filter(r => r.status === 'completed' && r.data).map(r => [r.url, r.data]))
    const validUrls = urls.filter(u => tMap.has(u))
    if (!validUrls.length) throw new Error('No valid transcriptions')

    setIsGenerating(true)
    try {
      const transcriptions = validUrls.map(u => {
        const raw = tMap.get(u)!
        const words: TranscriptionWord[] = Array.isArray(raw) ? raw : (raw as any).words || []
        return { words: words.map(w => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })) }
      })

      const durations = await Promise.all(validUrls.map(url => new Promise<number>(resolve => {
        const t = setTimeout(() => resolve(0), 5000)
        const a = new Audio(url)
        a.onloadedmetadata = () => { clearTimeout(t); resolve(a.duration) }
        a.onerror = () => { clearTimeout(t); resolve(0) }
      })))

      const props = alignVideoProps(segments, transcriptions, validUrls, durations, [], undefined, alignmentMode)
      if (props.durationInFrames <= 0) throw new Error('Zero duration')
      setVideoProps(props)
      return props
    } finally { setIsGenerating(false) }
  }

  const render = async (
    props: RemotionVideoProps, captionStyle: CaptionStyle,
    projectId?: string, projectName?: string
  ) => {
    setIsRendering(true)
    setRenderProgress({ progress: 0, stage: 'bundling' })
    try {
      const res = await fetch('/api/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoProps: { ...props, captionStyle }, projectId, projectName }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Render failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
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
          if (data.type === 'progress') setRenderProgress(data)
          else if (data.type === 'complete') {
            const link = document.createElement('a')
            link.href = data.videoUrl; link.download = `video-${Date.now()}.mp4`
            document.body.appendChild(link); link.click(); document.body.removeChild(link)
          } else if (data.type === 'error') throw new Error(data.error)
        }
      }
    } finally { setIsRendering(false); setRenderProgress(null) }
  }

  return { videoProps, setVideoProps, generate, render, isGenerating, isRendering, renderProgress }
}

// ── Project ────────────────────────────────────────────────

export function useProject() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const saveQueue = useRef<Promise<any>>(Promise.resolve())

  const load = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`)
    if (res.status === 404) {
      setProjectId(id)
      return null
    }
    if (!res.ok) throw new Error('Load failed')
    const data = await res.json()
    setProjectId(data.id)
    return data
  }

  const save = async (data: Record<string, any>) => {
    setIsSaving(true)

    const task = saveQueue.current.then(async () => {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: projectId, ...data }),
        })
        if (!res.ok) throw new Error('Save failed')
        const saved = await res.json()
        setProjectId(saved.id)
        return saved
      } finally {
        setIsSaving(false)
      }
    }).catch(e => {
      setIsSaving(false)
      throw e
    })

    saveQueue.current = task.catch(() => { })
    return task
  }

  return { projectId, setProjectId, load, save, isSaving }
}

// ── Download ───────────────────────────────────────────────

export function useDownload() {
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadZip = async (payload: {
    segments: Segment[]; audioUrls: string[]
    transcriptionResults: TranscriptionResult[]; filename?: string
  }) => {
    setIsDownloading(true)
    try {
      const res = await fetch('/api/generate/zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = payload.filename || `story-${Date.now()}.zip`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } finally { setIsDownloading(false) }
  }

  return { downloadZip, isDownloading }
}

// ── Utility: split transcription by clip duration ──────────

export function splitTranscriptionByDuration(
  transcriptionResults: TranscriptionResult[],
  audioBatches: AudioBatch[],
  clipDurationSec: number,
): Segment[] {
  // Flatten all words with global timing
  const allWords: (TranscriptionWord & { globalStartMs: number; globalEndMs: number })[] = []
  let globalOffsetMs = 0

  const completedBatches = audioBatches.filter(b => b.status === 'completed' && b.url)

  for (const batch of completedBatches) {
    const result = transcriptionResults.find(r => r.url === batch.url && r.status === 'completed' && r.data)
    if (!result?.data) continue

    const words: TranscriptionWord[] = Array.isArray(result.data) ? result.data : result.data.words || []
    const lastWord = words[words.length - 1]
    const batchDurationMs = lastWord ? lastWord.endMs : 0

    for (const w of words) {
      allWords.push({
        ...w,
        globalStartMs: globalOffsetMs + w.startMs,
        globalEndMs: globalOffsetMs + w.endMs,
      })
    }

    globalOffsetMs += batchDurationMs
  }

  if (allWords.length === 0) return []

  const totalDurationMs = allWords[allWords.length - 1].globalEndMs
  const clipDurationMs = clipDurationSec * 1000
  const numSegments = Math.ceil(totalDurationMs / clipDurationMs)

  const segments: Segment[] = []

  for (let i = 0; i < numSegments; i++) {
    const windowStart = i * clipDurationMs
    const windowEnd = (i + 1) * clipDurationMs

    const wordsInWindow = allWords.filter(w =>
      w.globalStartMs >= windowStart && w.globalStartMs < windowEnd
    )

    const text = wordsInWindow.map(w => w.text).join(' ').trim() || `[Segment ${i + 1}]`

    segments.push({
      text,
      startMs: windowStart,
      endMs: Math.min(windowEnd, totalDurationMs),
    })
  }

  return segments
}