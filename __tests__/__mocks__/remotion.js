const React = require("react");

module.exports = {
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 100,
    width: 1920,
    height: 1080,
  }),
  AbsoluteFill: ({ children }) => React.createElement("div", null, children),
  Sequence: ({ children }) => React.createElement("div", null, children),
  Audio: () => React.createElement("div"),
  Video: () => React.createElement("div"),
  Img: (props) => React.createElement("img", props),
  staticFile: (name) => `/static/${name}`,
  interpolate: jest.fn(),
  spring: jest.fn(() => 1),
  Easing: { linear: jest.fn() },
  freeze: jest.fn(),
  delayRender: jest.fn(),
  continueRender: jest.fn(),
  cancelRender: jest.fn(),
  getStaticFiles: jest.fn(() => []),
  watchStaticFile: jest.fn(),
};
