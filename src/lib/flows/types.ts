export interface Segment {
  text: string
  type?: 'scene_text' | 'comment'
  entities?: string[]
  imagePrompt?: string
  imagePath?: string
  /** For video story flow: the generated video clip URL */
  videoClipUrl?: string
  /** Time window this segment covers in the audio */
  startMs?: number
  endMs?: number
}

export interface EntityAsset {
  name: string
  description?: string
  segment?: number[]
  imageUrl?: string
  status: 'pending' | 'generating' | 'completed' | 'error'
}

export interface AudioBatch {
  index: number; text: string
  status: 'pending' | 'generating' | 'completed' | 'error'
  url?: string; error?: string
}

export interface TranscriptionResult {
  url: string
  status: 'completed' | 'error'
  transcriptionUrl?: string
  data?: TranscriptionWord[] | { words: TranscriptionWord[] }
  error?: string
}

export interface TranscriptionWord {
  text: string; startMs: number; endMs: number
}

export interface CaptionStyle {
  fontSize: number; fontFamily: string; fontWeight: number
  maxWordsPerLine: number; uppercase: boolean; highlightColor: string
}

export interface CommentatorConfig {
  id: string; name: string; personality: string
  appearance: { type: 'upload' | 'generated'; imageUrl?: string; imagePrompt?: string }
  voice?: string
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 60, fontFamily: "TikTok Sans, sans-serif", fontWeight: 800,
  maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F"
}