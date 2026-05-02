import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

function copyExtensionAssets() {
  return {
    name: "copy-extension-assets",
    closeBundle() {
      const files = [
        ["manifest.json", "dist/manifest.json"],
        ["icons/icon-16.png", "dist/icons/icon-16.png"],
        ["icons/icon-32.png", "dist/icons/icon-32.png"],
        ["icons/icon-48.png", "dist/icons/icon-48.png"],
        ["icons/icon-128.png", "dist/icons/icon-128.png"],
        ["src/content/overlay.css", "dist/src/content/overlay.css"],
        ["src/offscreen/blob-download.html", "dist/src/offscreen/blob-download.html"]
      ] as const;

      for (const [from, to] of files) {
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    }
  };
}

export default defineConfig({
  plugins: [copyExtensionAssets()],
  build: {
    emptyOutDir: true,
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        "src/background/service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        "src/content/index": resolve(__dirname, "src/content/index.ts"),
        "src/extractor/page-extractor": resolve(__dirname, "src/extractor/page-extractor.ts"),
        "src/offscreen/blob-download": resolve(__dirname, "src/offscreen/blob-download.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        format: "es"
      }
    }
  }
});
