import { POST } from '@/app/api/generate/descriptions/route'
import { generateSceneDescriptions } from '@/lib/ai/processors/scene-visualizer'

// Mock the dependency
jest.mock('@/lib/ai/processors/scene-visualizer')
const mockGenerateSceneDescriptions = generateSceneDescriptions as jest.MockedFunction<typeof generateSceneDescriptions>

describe('/api/generate/descriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should generate visual descriptions successfully with all parameters', async () => {
    const mockResponse = {
      visualDescriptions: [
        { imagePrompt: 'A beautiful sunset over mountains' },
      ],
      entities: [
        { name: 'John', description: 'Tall guy', status: 'pending' }
      ]
    }

    mockGenerateSceneDescriptions.mockResolvedValue(mockResponse)

    const requestBody = {
      segments: ['The sun set behind the mountains.'],
      context: 'commentator',
      commentatorImage: 'data:img',
      commentatorName: 'Jane',
      commentatorPersonality: 'Happy',
      language: 'english',
      style: 'anime',
      consistency: true
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResponse)
    expect(mockGenerateSceneDescriptions).toHaveBeenCalledWith({
      segments: requestBody.segments,
      context: requestBody.context,
      commentatorImage: requestBody.commentatorImage,
      commentatorName: requestBody.commentatorName,
      commentatorPersonality: requestBody.commentatorPersonality,
      language: requestBody.language,
      style: requestBody.style,
      consistency: requestBody.consistency
    })
  })

  it('should handle missing segments field', async () => {
    const requestBody = {}

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: segments (array)')
  })

  it('should handle empty segments array', async () => {
    const requestBody = {
      segments: []
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: segments (array)')
  })

  it('should handle non-array segments', async () => {
    const requestBody = {
      segments: 'not an array'
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: segments (array)')
  })

  it('should handle processing errors', async () => {
    mockGenerateSceneDescriptions.mockRejectedValue(new Error('AI processing failed'))

    const requestBody = {
      segments: ['A test segment']
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
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
    expect(data.error).toBe('Internal server error')
  })
})