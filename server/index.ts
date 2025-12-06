import * as dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// ------------------------------
// GLOBAL CORS (Render Friendly)
// ------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.sendStatus(200);
  }
  next();
});

// ------------------------------
// LOGGING
// ------------------------------
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalJson = res.json;
  res.json = function (body, ...args) {
    capturedJsonResponse = body;
    return originalJson.apply(res, [body, ...args]);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const ms = Date.now() - start;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${ms}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  // your routes + websocket setup
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ------------------------------
  // PRODUCTION STATIC HANDLING
  // ------------------------------
  if (process.env.NODE_ENV === "production") {
    const staticDir = path.join(process.cwd(), "dist/public");
    app.use(express.static(staticDir));

    // React SPA fallback
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ------------------------------
  // 🚀 RENDER-SAFE SERVER START
  // ------------------------------
  const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

  // WebSocket stability fixes
  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 66000;

  httpServer.listen(PORT, "0.0.0.0", () => {
    log(`Server running on Render port ${PORT}`);
  });
})();
