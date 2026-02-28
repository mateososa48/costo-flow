import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for pdfjs-dist and @napi-rs/canvas in Node.js API routes
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  // Force Vercel's output file tracing to include the pdfjs worker files
  // (they are not statically imported so OFT misses them otherwise)
  experimental: {
    outputFileTracingIncludes: {
      "/api/invoices/parse": [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      ],
    },
  },
};

export default nextConfig;
