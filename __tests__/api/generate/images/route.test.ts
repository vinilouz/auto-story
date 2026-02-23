import { POST } from '@/app/api/generate/images/route'
import { generateSingleImage } from '@/lib/ai/processors/image-generator'
import { StorageService } from '@/lib/storage'

// Mock the dependencies
jest.mock('@/lib/ai/processors/image-generator')
jest.mock('@/lib/storage')

const mockGenerateSingleImage = generateSingleImage as jest.MockedFunction<typeof generateSingleImage>

describe('/api/generate/images', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should generate an image successfully without saving if no project info provided', async () => {
    mockGenerateSingleImage.mockResolvedValue('https://example.com/generated.jpg')

    const requestBody = {
      imagePrompt: 'A beautiful sunset'
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ imageUrl: 'https://example.com/generated.jpg' })
    expect(mockGenerateSingleImage).toHaveBeenCalledWith({
      imagePrompt: requestBody.imagePrompt,
      referenceImage: undefined,
      referenceImages: undefined,
      imageConfig: undefined,
      systemPrompt: undefined
    })
    expect(StorageService.saveBase64Image).not.toHaveBeenCalled()
  })

  it('should generate an image and save it locally if project info and base64 provided', async () => {
    mockGenerateSingleImage.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=')
      ; (StorageService.saveBase64Image as jest.Mock).mockResolvedValue('/projects/test/images/generated.png')

    const requestBody = {
      imagePrompt: 'A beautiful sunset',
      projectId: 'proj-123',
      projectName: 'Test Project'
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.imageUrl).toBe('/projects/test/images/generated.png')
    expect(StorageService.saveBase64Image).toHaveBeenCalled()
  })

  it('should return 400 if imagePrompt is missing', async () => {
    const requestBody = {}

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required field: imagePrompt')
  })

  it('should handle API errors from the AI provider', async () => {
    mockGenerateSingleImage.mockRejectedValue(new Error('AI Provider error'))

    const requestBody = {
      imagePrompt: 'A beautiful sunset'
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })
})