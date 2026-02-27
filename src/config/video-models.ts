export interface VideoModelConfig {
  id: string
  name: string
  clipDurationSeconds: number
  referenceImageField: 'image_urls' | 'reference_image_url' | 'wan_image_url'
  extraParams?: Record<string, unknown>
}

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: 'grok-imagine-video',
    name: 'Grok Video (6s)',
    clipDurationSeconds: 6,
    referenceImageField: 'image_urls'
  },
  {
    id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast (8s)',
    clipDurationSeconds: 8,
    referenceImageField: 'reference_image_url'
  },
  {
    id: 'wan-2.6',
    name: 'Wan 2.6 (15s)',
    clipDurationSeconds: 15,
    referenceImageField: 'wan_image_url',
    extraParams: { aspectRatio: '16:9', duration: 15, resolution: '1080P', sound: true }
  }
]
