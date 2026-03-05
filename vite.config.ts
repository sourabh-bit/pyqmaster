import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

const isReplit = process.env.REPL_ID !== undefined;
const rootDir = process.cwd();

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss(), metaImagesPlugin()];

  if (isReplit) {
    const [runtimeErrorModal, cartographer, devBanner] = await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal"),
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);

    plugins.push(
      runtimeErrorModal.default(),
      cartographer.cartographer(),
      devBanner.devBanner()
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "client", "src"),
        "@shared": path.resolve(rootDir, "shared"),
        "@assets": path.resolve(rootDir, "attached_assets"),
      },
    },
    css: {
      postcss: {
        plugins: [],
      },
    },
    root: path.resolve(rootDir, "client"),
    build: {
      outDir: "../dist/public",
      emptyOutDir: true,
      assetsDir: "assets",
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
            "ui-vendor": ["lucide-react"],
          },
        },
      },
      minify: "esbuild",
      target: "es2020",
      chunkSizeWarningLimit: 1200,
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
