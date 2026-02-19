import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
};

export default nextConfig;
