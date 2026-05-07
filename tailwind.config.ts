import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CostoFlow brand palette
        brand: {
          bg: "#1a1714",         // warm dark background
          surface: "#211e1b",    // card surface
          border: "#2e2a26",     // subtle borders
          navy: "#1b2a4a",       // deep navy accent
          gold: "#c8a882",       // warm gold / blush
          text: "#f0ece6",       // warm off-white
          muted: "#8a8078",      // muted text
          danger: "#c0392b",     // error / warning red
          success: "#2e7d52",    // success green
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 2px 8px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover": "0 4px 16px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(200,168,130,0.15)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
