// Setup mocks before any imports
import "__tests__/mocks";

import "whatwg-fetch";
import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;

// Mock ResizeObserver for Radix UI components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver for LazyVideo component
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    this.callback([{ isIntersecting: true }]);
  }
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverMock;

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock environment variables
process.env.VOID_BASE_URL = "https://mock-endpoint.com/v1";
process.env.VOID_API_KEY = "test-api-key";
