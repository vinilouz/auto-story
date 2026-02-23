export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface VisualDescription {
  imagePrompt: string
  imageUrl?: string
  status: 'pending' | 'generating' | 'completed' | 'error'
}

export interface EntityAsset {
  name: string
  description?: string
  imageUrl?: string
  status: 'pending' | 'generating' | 'completed' | 'error'
}

export interface AudioBatch {
  index: number
  text: string
  status: 'pending' | 'generating' | 'completed' | 'error'
  url?: string
  error?: string
}

export interface TranscriptionResult {
  url: string
  status: 'completed' | 'error'
  transcriptionUrl?: string
  data?: TranscriptionData
  error?: string
}

export interface TranscriptionWord {
  text: string
  startMs: number
  endMs: number
}

export type TranscriptionData = TranscriptionWord[] | { words: TranscriptionWord[] }

export interface CaptionStyle {
  fontSize: number
  fontFamily: string
  fontWeight: number
  maxWordsPerLine: number
  uppercase: boolean
  highlightColor: string
}

export interface ProjectData {
  id?: string | null
  name: string
  flowType: 'simple' | 'with-commentator'
  consistency: boolean
  scriptText: string
  segmentSize: number
  language: string
  style?: string
  voice?: string
  segments?: string[]
  entities?: EntityAsset[]
  visualDescriptions?: VisualDescription[]
  segmentsWithComments?: SegmentWithComment[]
  audioUrls?: string[]
  audioBatches?: AudioBatch[]
  audioSystemPrompt?: string
  transcriptionResults?: TranscriptionResult[]
  commentator?: CommentatorConfig
}

export interface SegmentWithComment {
  type: 'scene_text' | 'comment'
  content: string
}

export interface CommentatorConfig {
  id: string
  name: string
  personality: string
  appearance: {
    type: 'upload' | 'generated'
    imageUrl?: string
    imagePrompt?: string
    description?: string
  }
  voice?: string
}

export interface VideoSegment {
  id: string
  text: string
  imageUrl: string
}

export interface VoiceConfig {
  narrator: string
  commentator?: string
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 60,
  fontFamily: "TikTok Sans, sans-serif",
  fontWeight: 800,
  maxWordsPerLine: 3,
  uppercase: true,
  highlightColor: "#FFE81F"
}

export const DEFAULT_SEGMENT_SIZE = 150
export const DEFAULT_SEGMENT_SIZE_COMMENTATOR = 200
