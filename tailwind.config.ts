import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eng: {
          bg: "#0f172a",
          panel: "#1e293b",
          panel2: "#273449",
          border: "#334155",
          text: "#e2e8f0",
          muted: "#94a3b8",
          accent: "#2563eb",
          accent2: "#3b82f6",
          ok: "#16a34a",
          warn: "#ea580c",
          err: "#dc2626",
          paper: "#f8fafc",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
