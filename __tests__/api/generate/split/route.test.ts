import { POST } from '@/app/api/generate/split/route'
import { splitText } from '@/lib/text-segmentation'

// Mock the dependency
jest.mock('@/lib/text-segmentation')
const mockSplitText = splitText as jest.MockedFunction<typeof splitText>

describe('/api/generate/split', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should split text successfully', async () => {
    const mockSegments = [
      'This is the first segment.',
      'This is the second segment.',
      'This is the third segment.'
    ]

    mockSplitText.mockReturnValue(mockSegments)

    const requestBody = {
      text: 'This is the first segment. This is the second segment. This is the third segment.',
      segmentLength: 30
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ segments: mockSegments })
    expect(mockSplitText).toHaveBeenCalledWith(requestBody.text, requestBody.segmentLength)
  })

  it('should handle missing text field', async () => {
    const requestBody = {
      segmentLength: 30
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: text, segmentLength')
  })

  it('should handle missing segmentLength field', async () => {
    const requestBody = {
      text: 'This is a test text'
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: text, segmentLength')
  })

  it('should handle empty text', async () => {
    const requestBody = {
      text: '',
      segmentLength: 30
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: text, segmentLength')
  })

  it('should handle zero segmentLength', async () => {
    const requestBody = {
      text: 'This is a test text',
      segmentLength: 0
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    // 0 is treated as falsy in the validation
    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields: text, segmentLength')
  })

  it('should handle negative segmentLength', async () => {
    const mockSegments = ['This is a test text']
    mockSplitText.mockReturnValue(mockSegments)

    const requestBody = {
      text: 'This is a test text',
      segmentLength: -10
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    // Note: The API doesn't validate segmentLength, it just passes it through
    expect(response.status).toBe(200)
    expect(data).toEqual({ segments: mockSegments })
    expect(mockSplitText).toHaveBeenCalledWith('This is a test text', -10)
  })

  it('should handle single segment', async () => {
    const mockSegments = ['This is a short text.']
    mockSplitText.mockReturnValue(mockSegments)

    const requestBody = {
      text: 'This is a short text.',
      segmentLength: 100
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ segments: mockSegments })
  })

  it('should handle empty segments result', async () => {
    mockSplitText.mockReturnValue([])

    const requestBody = {
      text: '   ',
      segmentLength: 30
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ segments: [] })
  })

  it('should handle processing errors', async () => {
    mockSplitText.mockImplementation(() => {
      throw new Error('Text processing failed')
    })

    const requestBody = {
      text: 'This is a test text',
      segmentLength: 30
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

  it('should handle very long text', async () => {
    const mockSegments = ['Segment 1', 'Segment 2', 'Segment 3']
    mockSplitText.mockReturnValue(mockSegments)

    const longText = 'A'.repeat(100000)

    const requestBody = {
      text: longText,
      segmentLength: 5000
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ segments: mockSegments })
  })

  it('should handle text with special characters', async () => {
    const mockSegments = ['Text with émojis 🎉 and spéciäl chârs!']
    mockSplitText.mockReturnValue(mockSegments)

    const requestBody = {
      text: 'Text with émojis 🎉 and spéciäl chârs!',
      segmentLength: 50
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ segments: mockSegments })
  })

  it('should handle text with line breaks and tabs', async () => {
    const mockSegments = ['First line', 'Second line']
    mockSplitText.mockReturnValue(mockSegments)

    const requestBody = {
      text: 'First line\nSecond line\twith tabs',
      segmentLength: 20
    }

    const request = {
      json: async () => requestBody
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ segments: mockSegments })
  })
})