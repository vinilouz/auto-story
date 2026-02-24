import { useState, useCallback } from "react"
import { RemotionVideoProps } from "@/lib/video/types"
import { alignVideoProps } from "@/lib/video/aligner"
import { VisualDescription, AudioBatch, TranscriptionResult, CaptionStyle, VideoSegment, TranscriptionWord } from "./types"

interface VideoGenerationConfig {
  getSegments: () => VideoSegment[]
  audioBatches: AudioBatch[]
  transcriptionResults: TranscriptionResult[]
  projectId?: string
  projectName?: string
}

export function useVideoGeneration(config: VideoGenerationConfig) {
  const [videoProps, setVideoProps] = useState<RemotionVideoProps | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState<{
    progress: number
    stage: string
    renderedFrames?: number
    totalFrames?: number
  } | null>(null)

  const generateVideo = async () => {
    const completedAudio = config.audioBatches.filter(b => b.status === 'completed' && b.url)
    const audioUrls = completedAudio.map(b => b.url!)

    if (!audioUrls.length || !config.transcriptionResults.length) {
      throw new Error('Missing audio or transcription data')
    }

    setIsGenerating(true)

    try {
      const transcriptionMap = new Map(
        config.transcriptionResults
          .filter(r => r.status === 'completed' && r.data)
          .map(r => [r.url, r.data])
      )

      const validAudioUrls = audioUrls.filter(url => transcriptionMap.has(url))

      const orderedTranscriptions = validAudioUrls.map(url => {
        const rawData = transcriptionMap.get(url)!
        const words = Array.isArray(rawData) ? rawData : rawData.words || []
        return {
          words: words.map((w: TranscriptionWord) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs
          }))
        }
      })

      if (validAudioUrls.length === 0) {
        throw new Error('No valid transcriptions found')
      }

      const segments = config.getSegments()

      const audioDurations = await Promise.all(
        validAudioUrls.map(url => new Promise<number>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`Timeout waiting for metadata: ${url}`)
            resolve(0)
          }, 5000)

          const audio = new Audio(url)
          audio.onloadedmetadata = () => {
            clearTimeout(timeout)
            resolve(audio.duration)
          }
          audio.onerror = () => {
            clearTimeout(timeout)
            resolve(0)
          }
        }))
      )

      const props = alignVideoProps(
        segments,
        orderedTranscriptions,
        validAudioUrls,
        audioDurations
      )

      if (props.durationInFrames <= 0) {
        throw new Error('Video duration is zero')
      }

      setVideoProps(props)
      return props
    } catch (error) {
      console.error('Video generation error:', error)
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  const renderVideo = async (captionStyle: CaptionStyle) => {
    if (!videoProps) return

    setIsRendering(true)
    setRenderProgress({ progress: 0, stage: 'bundling' })

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoProps: { ...videoProps, captionStyle },
          projectId: config.projectId,
          projectName: config.projectName
        })
      })

      if (!res.ok) {
        let errorMsg = 'Render request failed'
        try {
          const errorData = await res.json()
          errorMsg = errorData.error || errorMsg
        } catch { }
        throw new Error(errorMsg)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

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
              totalFrames: data.totalFrames
            })
          } else if (data.type === 'complete') {
            const videoUrl = data.videoUrl
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
    } catch (error) {
      console.error('Render error:', error)
      throw error
    } finally {
      setIsRendering(false)
      setRenderProgress(null)
    }
  }

  const setVideoPropsDirect = useCallback((props: RemotionVideoProps | null) => {
    setVideoProps(props)
  }, [])

  return {
    videoProps,
    setVideoProps: setVideoPropsDirect,
    generateVideo,
    renderVideo,
    isGenerating,
    isRendering,
    renderProgress
  }
}
