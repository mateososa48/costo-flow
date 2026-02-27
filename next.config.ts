import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for pdfjs-dist and @napi-rs/canvas in Node.js API routes
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
