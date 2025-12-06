import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, mkdir, cp, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// server deps to bundle for performance
const allowlist = [
  "@google/generative-ai",
  "@neondatabase/serverless",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "web-push",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  console.log("🧹 Cleaning dist folder...");
  await rm("dist", { recursive: true, force: true });

  console.log("📦 Building client...");
  await viteBuild();

  console.log("🚚 Moving client build to dist/public...");
  const publicDir = path.resolve("dist/public");
  await mkdir(publicDir, { recursive: true });

  await cp("client/dist", publicDir, { recursive: true })
    .catch(() => console.warn("⚠ Failed to copy client/dist → dist/public"));

  console.log("🛠 Building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {})
  ];

  // Externals = everything except allowlist
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  const result = await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    alias: {
      "@shared": path.resolve(rootDir, "shared"),
    }
  });

  console.log("✔ Server build complete.");

  // Check output
  try {
    const { stat, readdir } = await import("fs/promises");
    const stats = await stat("dist/index.cjs");

    console.log("📄 dist/index.cjs created, size:", stats.size, "bytes\n");

    console.log("=== Build Output Structure ===");
    const distContents = await readdir("dist", { withFileTypes: true });
    for (const item of distContents) {
      if (item.isDirectory()) {
        console.log(`📁 dist/${item.name}/`);
        const sub = await readdir(path.join("dist", item.name));
        sub.forEach((f) => console.log(`   └─ ${f}`));
      } else {
        console.log(`📄 dist/${item.name}`);
      }
    }
    console.log("=== End Build Output Structure ===\n");

  } catch (err) {
    console.error("❌ ERROR: dist/index.cjs missing!");
    process.exit(1);
  }
}

buildAll().catch((err) => {
  console.error("🔥 Build failed:", err);
  process.exit(1);
});
