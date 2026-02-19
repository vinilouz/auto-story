// Setup mocks before any imports
import '__tests__/mocks'

import 'whatwg-fetch'

// Mock environment variables
process.env.AI_ENDPOINT = 'https://mock-endpoint.com/v1'
process.env.AI_API_KEY = 'test-api-key'