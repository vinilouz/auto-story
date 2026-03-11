// Mock OpenAI client
const mockOpenAI = jest.fn(() => ({
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
}));

jest.mock("openai", () => {
  return mockOpenAI;
});

// Set dangerouslyAllowBrowser for tests
mockOpenAI.dangerouslyAllowBrowser = true;

// Mock NextResponse
jest.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    constructor(url, options) {
      this.url = url;
      this.options = options;
    }

    async json() {
      return this.options?.body ? JSON.parse(this.options.body) : {};
    }
  },
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
      body: body,
    })),
  },
}));
