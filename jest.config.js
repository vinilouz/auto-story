const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/__tests__/mocks.js",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^remotion$": "<rootDir>/__tests__/__mocks__/remotion.js",
    "^@remotion/player$": "<rootDir>/__tests__/__mocks__/remotion-player.js",
    "^@remotion/transitions$":
      "<rootDir>/__tests__/__mocks__/remotion-transitions.js",
    "^@remotion/animation-utils$":
      "<rootDir>/__tests__/__mocks__/remotion-animation-utils.js",
    "^@remotion/media$": "<rootDir>/__tests__/__mocks__/remotion-media.js",
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
