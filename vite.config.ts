import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

const isReplit = process.env.REPL_ID !== undefined;
const rootDir = process.cwd();

// 👇 declare variables
let runtimeErrorModal: any;
let cartographer: any;
let devBanner: any;

// 👇 only load in Replit
if (isReplit) {
  runtimeErrorModal = require("@replit/vite-plugin-runtime-error-modal").default;
  cartographer = require("@replit/vite-plugin-cartographer").cartographer;
  devBanner = require("@replit/vite-plugin-dev-banner").devBanner;
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(isReplit ? [runtimeErrorModal(), cartographer(), devBanner()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "client", "src"),
      "@shared": path.resolve(rootDir, "shared"),
      "@assets": path.resolve(rootDir, "attached_assets"),
    },
  },
  root: path.resolve(rootDir, "client"),
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
