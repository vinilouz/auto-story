// Setup mocks before any imports
import '__tests__/mocks'

import 'whatwg-fetch'

// Mock environment variables
process.env.VOID_BASE_URL = 'https://mock-endpoint.com/v1'
process.env.VOID_API_KEY = 'test-api-key'