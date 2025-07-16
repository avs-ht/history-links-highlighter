import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        highlighter: resolve(__dirname, "src/highlighter.ts"),
      },

      output: {
        entryFileNames: (chunkInfo) => {
          // сохраняем исходные имена для манифеста
          if (chunkInfo.name === "background") return "background.js";
          if (chunkInfo.name === "highlighter") return "highlighter.js";
          return "assets/[name].js";
        },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
