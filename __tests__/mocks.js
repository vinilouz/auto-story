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

// Mock Remotion
jest.mock("remotion", () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 100,
    width: 1920,
    height: 1080,
  }),
  AbsoluteFill: ({ children }) => <div>{children}</div>,
  Sequence: ({ children }) => <div>{children}</div>,
  Audio: () => <div />,
  Video: () => <div />,
  Img: () => <img />,
  staticFile: (name) => `/static/${name}`,
  interpolate: jest.fn(),
  spring: jest.fn(() => 1),
  Easing: { linear: jest.fn() },
}));

jest.mock("@remotion/transitions", () => ({
  slide: jest.fn(() => ({})),
  fade: jest.fn(() => ({})),
}));

jest.mock("@remotion/animation-utils", () => ({
  interpolateStyles: jest.fn(),
}));

// Mock @remotion/player
jest.mock("@remotion/player", () => ({
  Player: () => <div data-testid="remotion-player">Player</div>,
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => {
  const icons = new Proxy(
    {},
    {
      get: (_, prop) => {
        const Icon = () => <span data-icon={prop.toString()} />;
        Icon.displayName = prop.toString();
        return Icon;
      },
    },
  );
  return icons;
});
