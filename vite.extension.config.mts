import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

const extensionConfig = {
  base: "./",
  plugins: react(),
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  publicDir: false,
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "extension/index.html"),
        sandbox: resolve(__dirname, "extension/sandbox.html"),
        background: resolve(__dirname, "src/extension/background.ts"),
      },
      output: {
        entryFileNames: (chunk: { name: string }) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
};

export default extensionConfig;
