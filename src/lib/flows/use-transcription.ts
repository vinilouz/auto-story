import { useState, useCallback } from "react"
import { AudioBatch, TranscriptionResult } from "./types"

export function useTranscription(
  audioBatches: AudioBatch[],
  language: string
) {
  const [results, setResults] = useState<TranscriptionResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const transcribe = async () => {
    const urls = audioBatches
      .filter(b => b.status === 'completed' && b.url)
      .map(b => b.url!)

    if (urls.length === 0) return

    setIsLoading(true)

    try {
      const langCode = language === 'english' ? 'en' : 'pt'

      const res = await fetch('/api/generate/transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls: urls, language: langCode })
      })

      if (!res.ok) throw new Error('Transcription failed')
      const data = await res.json()

      setResults(prev => {
        const map = new Map(prev.map(r => [r.url, r]))
        data.results.forEach((r: TranscriptionResult) => map.set(r.url, r))
        return Array.from(map.values())
      })

      return data.results
    } catch (error) {
      console.error('Transcription error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const retry = useCallback(async (url: string) => {
    setResults(prev => prev.filter(r => r.url !== url))
    setIsLoading(true)

    try {
      const langCode = language === 'english' ? 'en' : 'pt'

      const res = await fetch('/api/generate/transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls: [url], language: langCode })
      })

      if (!res.ok) throw new Error('Retry failed')
      const data = await res.json()

      if (data.results?.[0]) {
        setResults(prev => prev.map(r => r.url === url ? data.results[0] : r))
      }
    } catch (error) {
      console.error('Transcription retry error:', error)
      setResults(prev => [
        ...prev,
        { url, status: 'error' as const, error: 'Retry failed' }
      ])
    } finally {
      setIsLoading(false)
    }
  }, [language])

  const setResultsDirect = useCallback((newResults: TranscriptionResult[]) => {
    setResults(newResults)
  }, [])

  return {
    results,
    setResults: setResultsDirect,
    transcribe,
    retry,
    isLoading
  }
}
