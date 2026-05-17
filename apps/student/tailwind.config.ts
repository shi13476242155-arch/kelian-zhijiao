import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17191c",
        paper: "#f7f6f4",
        brand: {
          50: "#fff8f4",
          100: "#fbeee8",
          200: "#f2d8cf",
          400: "#e2a08e",
          500: "#d9826b",
          600: "#bd6a56"
        },
        aura: {
          50: "#f7f3fb",
          100: "#eee6f6",
          400: "#b79bd7",
          500: "#9574bd"
        },
        workspace: {
          bg: "#f7f6f4",
          card: "#ffffff",
          border: "#ebe7e2",
          muted: "#6f706f"
        }
      },
      boxShadow: {
        soft: "0 18px 45px rgba(50, 42, 36, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
