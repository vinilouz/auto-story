import { POST } from '@/app/api/generate/route'
import { splitText } from '@/lib/text-segmentation'
import { generateSceneDescriptions } from '@/lib/ai/processors/scene-visualizer'
import { generateSingleImage } from '@/lib/ai/processors/image-generator'

// Mock the dependencies
jest.mock('@/lib/text-segmentation')
jest.mock('@/lib/ai/processors/scene-visualizer')
jest.mock('@/lib/ai/processors/image-generator')

const mockSplitText = splitText as jest.MockedFunction<typeof splitText>
const mockGenerateSceneDescriptions = generateSceneDescriptions as jest.MockedFunction<typeof generateSceneDescriptions>
const mockGenerateSingleImage = generateSingleImage as jest.MockedFunction<typeof generateSingleImage>

describe('/api/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should process text successfully with all steps', async () => {
    // Setup mocks
    mockSplitText.mockReturnValue(['segment1', 'segment2'])
    mockGenerateSceneDescriptions.mockResolvedValue({
      visualDescriptions: [
        { imagePrompt: 'prompt1' },
        { imagePrompt: 'prompt2' }
      ]
    })

    // Mock single image generation for each call
    mockGenerateSingleImage
      .mockResolvedValueOnce('url1')
      .mockResolvedValueOnce('url2')

    const requestBody = {
      text: 'This is a test text',
      segmentLength: 100
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      segments: ['segment1', 'segment2'],
      visualDescriptions: [
        { imagePrompt: 'prompt1', imageUrl: 'url1', status: 'completed' },
        { imagePrompt: 'prompt2', imageUrl: 'url2', status: 'completed' }
      ]
    })

    expect(mockSplitText).toHaveBeenCalledWith('This is a test text', 100)
    expect(mockGenerateSceneDescriptions).toHaveBeenCalledWith({
      segments: ['segment1', 'segment2']
    })

    // Check calls to generateSingleImage
    expect(mockGenerateSingleImage).toHaveBeenCalledTimes(2)
    expect(mockGenerateSingleImage).toHaveBeenCalledWith({ imagePrompt: 'prompt1' })
    expect(mockGenerateSingleImage).toHaveBeenCalledWith({ imagePrompt: 'prompt2' })
  })

  it('should handle missing required fields', async () => {
    const requestBody = {
      text: 'This is a test text'
      // segmentLength is missing
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('Missing required fields')
  })

  it('should handle invalid segmentLength', async () => {
    const requestBody = {
      text: 'This is a test text',
      segmentLength: -10
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('segmentLength must be a positive number')
  })

  it('should handle empty text', async () => {
    const requestBody = {
      text: '',
      segmentLength: 100
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('Missing required fields')
  })

  it('should handle processing errors gracefully', async () => {
    mockSplitText.mockImplementation(() => {
      throw new Error('Processing failed')
    })

    const requestBody = {
      text: 'This is a test text',
      segmentLength: 100
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Processing failed')
  })

  it('should handle image generation errors', async () => {
    mockSplitText.mockReturnValue(['segment1'])
    mockGenerateSceneDescriptions.mockResolvedValue({
      visualDescriptions: [{ imagePrompt: 'prompt1' }]
    })
    mockGenerateSingleImage.mockRejectedValue(new Error('Image generation failed'))

    const requestBody = {
      text: 'This is a test text',
      segmentLength: 100
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    // The route now catches image generation errors and returns partial success with 'error' status
    expect(response.status).toBe(200)
    expect(data.visualDescriptions[0].status).toBe('error')
  })

  it('should handle malformed JSON', async () => {
    const request = {
      json: async () => {
        throw new Error('Invalid JSON')
      }
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
  })

  it('should return segments without visual descriptions when no descriptions generated', async () => {
    mockSplitText.mockReturnValue(['segment1', 'segment2'])
    mockGenerateSceneDescriptions.mockResolvedValue({
      visualDescriptions: []
    })
    // mockGenerateSingleImage shouldn't be called if list is empty

    const requestBody = {
      text: 'This is a test text',
      segmentLength: 100
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      segments: ['segment1', 'segment2'],
      visualDescriptions: []
    })
  })
})