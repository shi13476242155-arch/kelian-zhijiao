import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import electron from "vite-plugin-electron";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts"
      }
    ])
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()]
    }
  },
  server: {
    port: 5174
  }
});
