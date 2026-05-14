import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        paper: "#f6f8fb",
        teal: {
          600: "#087f8c",
          700: "#066b75"
        },
        amber: {
          500: "#d18b00"
        }
      },
      boxShadow: {
        soft: "0 20px 60px rgba(31, 41, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
