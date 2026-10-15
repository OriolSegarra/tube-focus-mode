import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "#111111",
        surface: "#191919",
        "surface-raised": "#1F1F1F",
        hairline: "rgba(255,255,255,0.12)",
        ink: "#F7F6F3",
        "ink-muted": "#9B9A97",
        accent: "#FF5A1F",
        "accent-ink": "#111111",
        ok: "#4AA785",
        warn: "#D9730D",
        danger: "#E03E3E",
      },
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Space Mono", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        hard: "4px 4px 0 0 rgba(0,0,0,0.9)",
        "hard-accent": "4px 4px 0 0 #FF5A1F",
      },
    },
  },
  plugins: [],
} satisfies Config;
