import { POST } from '@/app/api/generate/images/route'
import { generateSingleImage } from '@/lib/ai/processors/image-generator'

// Mock the dependency
jest.mock('@/lib/ai/processors/image-generator')
const mockGenerateSingleImage = generateSingleImage as jest.MockedFunction<typeof generateSingleImage>

describe('/api/generate/images', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should generate images successfully', async () => {
    const mockResponse = {
      visualDescriptions: [
        { imagePrompt: 'A beautiful sunset', imageUrl: 'https://example.com/image1.jpg', status: 'completed' },
        { imagePrompt: 'A forest scene', imageUrl: 'https://example.com/image2.jpg', status: 'completed' }
      ]
    }

    mockGenerateSingleImage.mockResolvedValue('https://example.com/image.jpg')

    const requestBody = {
      visualDescriptions: [
        { imagePrompt: 'A beautiful sunset' },
        { imagePrompt: 'A forest scene' }
      ]
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResponse)
    expect(mockGenerateSingleImage).toHaveBeenCalledWith({
      visualDescriptions: requestBody.visualDescriptions,
      imageConfig: undefined
    })
  })

  it('should generate images with custom config', async () => {
    const mockResponse = {
      visualDescriptions: [
        { imagePrompt: 'A beautiful sunset', imageUrl: 'https://example.com/image1.jpg', status: 'completed' }
      ]
    }

    mockGenerateSingleImage.mockResolvedValue('https://example.com/image.jpg')

    const requestBody = {
      visualDescriptions: [
        { imagePrompt: 'A beautiful sunset' }
      ],
      imageConfig: {
        aspect_ratio: '16:9',
        image_size: '4K'
      }
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResponse)
    expect(mockGenerateSingleImage).toHaveBeenCalledWith({
      visualDescriptions: requestBody.visualDescriptions,
      imageConfig: requestBody.imageConfig
    })
  })

  it('should handle missing visualDescriptions field', async () => {
    const requestBody = {}

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: visualDescriptions (array)')
  })

  it('should handle empty visualDescriptions array', async () => {
    const requestBody = {
      visualDescriptions: []
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: visualDescriptions (array)')
  })

  it('should handle non-array visualDescriptions', async () => {
    const requestBody = {
      visualDescriptions: 'not an array'
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: visualDescriptions (array)')
  })

  it('should handle image generation errors', async () => {
    mockGenerateSingleImage.mockRejectedValue(new Error('Image generation failed'))

    const requestBody = {
      visualDescriptions: [
        { imagePrompt: 'A test image' }
      ]
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

  it('should handle partial image generation success', async () => {
    const mockResponse = {
      visualDescriptions: [
        { imagePrompt: 'Success image', imageUrl: 'https://example.com/image1.jpg', status: 'completed' },
        { imagePrompt: 'Failed image', status: 'error' },
        { imagePrompt: 'Pending image', status: 'generating' }
      ]
    }

    mockGenerateSingleImage.mockResolvedValue('https://example.com/image.jpg')

    const requestBody = {
      visualDescriptions: [
        { imagePrompt: 'Success image' },
        { imagePrompt: 'Failed image' },
        { imagePrompt: 'Pending image' }
      ]
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResponse)
  })

  it('should handle empty image prompts', async () => {
    const mockResponse = {
      visualDescriptions: [
        { imagePrompt: '', imageUrl: 'https://example.com/image1.jpg', status: 'completed' }
      ]
    }

    mockGenerateSingleImage.mockResolvedValue('https://example.com/image.jpg')

    const requestBody = {
      visualDescriptions: [
        { imagePrompt: '' }
      ]
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResponse)
  })

  it('should validate image config format', async () => {
    const mockResponse = {
      visualDescriptions: [
        { imagePrompt: 'A test image', status: 'completed' }
      ]
    }
    mockGenerateSingleImage.mockResolvedValue('https://example.com/image.jpg')

    const requestBody = {
      visualDescriptions: [
        { imagePrompt: 'A test image' }
      ],
      imageConfig: {
        aspect_ratio: 'invalid_ratio',
        image_size: 'invalid_size'
      }
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResponse)
    // Should pass validation (actual config validation happens in the processor)
    expect(mockGenerateSingleImage).toHaveBeenCalledWith({
      visualDescriptions: requestBody.visualDescriptions,
      imageConfig: requestBody.imageConfig
    })
  })
})