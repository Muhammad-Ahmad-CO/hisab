import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        espresso: {
          950: "#14100b",
          900: "#1c1510",
          800: "#261c13",
          700: "#3a2b1a",
          600: "#4d3a24",
        },
        paper: {
          50: "#faf3e6",
          100: "#f3e8d2",
          200: "#e7d6b4",
          300: "#d9bf8f",
        },
        gold: {
          200: "#f9d998",
          300: "#f6c76b",
          400: "#efa93f",
          500: "#e0912b",
          600: "#b96f1f",
          700: "#8a5218",
        },
      },
      fontFamily: {
        display: ["Georgia", "'Times New Roman'", "serif"],
        sans: [
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          '"Noto Sans"',
          '"Noto Nastaliq Urdu"',
          "sans-serif",
        ],
      },
      boxShadow: {
        "glow-gold": "0 0 36px 6px rgba(239,169,63,0.35)",
        "glow-gold-lg": "0 0 72px 16px rgba(239,169,63,0.25)",
        card: "0 12px 32px -14px rgba(0,0,0,0.6)",
        "card-inset": "inset 0 1px 0 0 rgba(246,199,107,0.12)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
        rise: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.85" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.2,0.6,0.4,1) infinite",
        rise: "rise 0.45s cubic-bezier(0.2,0.7,0.3,1) both",
        breathe: "breathe 3.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
