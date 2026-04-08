import * as dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import path from "path";

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 5000;

let isServerReady = false;
let startupError: Error | null = null;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ------------------------------
// BODY PARSING
// ------------------------------
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
// BASIC LOGGING
// ------------------------------
app.use((req, _res, next) => {
  console.log(req.method, req.url);
  next();
});

// ------------------------------
// GLOBAL CORS
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
// ROOT (ALWAYS 200)
// ------------------------------
app.get("/", (_req, res) => {
  res.status(200).send("Server is running");
});

// ------------------------------
// HEALTH CHECK
// ------------------------------
app.get("/health", (_req, res) => {
  const timestamp = new Date().toISOString();

  if (startupError) {
    return res.status(500).json({
      status: "error",
      timestamp,
      message: startupError.message,
    });
  }

  if (!isServerReady) {
    return res.status(200).json({
      status: "starting",
      timestamp,
    });
  }

  return res.status(200).json({
    status: "ok",
    timestamp,
  });
});

// ------------------------------
// LOGGER
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

// ------------------------------
// API RESPONSE LOGGER
// ------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  let responseBody: any;

  const originalJson = res.json;
  res.json = function (body, ...args) {
    responseBody = body;
    return originalJson.apply(res, [body, ...args]);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (responseBody) {
        logLine += ` :: ${JSON.stringify(responseBody)}`;
      }

      log(logLine);
    }
  });

  next();
});

// ------------------------------
// 🔥 FINAL STARTUP GATE FIX
// ------------------------------
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/health") {
    return next();
  }

  if (startupError) {
    return res.status(500).json({ message: "Server startup failed" });
  }

  // ONLY block API, NOT entire server
  if (!isServerReady && req.path.startsWith("/api")) {
    return res.status(503).json({ message: "Server is starting" });
  }

  next();
});

// ------------------------------
// ERROR HANDLING
// ------------------------------
process.on("uncaughtException", (error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  log(`Uncaught exception: ${message}`, "server");
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
  log(`Unhandled rejection: ${message}`, "server");
});

httpServer.on("clientError", (error, socket) => {
  log(`Client error: ${error.message}`, "server");

  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  }
});

httpServer.on("error", (error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  startupError = error instanceof Error ? error : new Error(message);
  log(`HTTP server error: ${message}`, "server");
});

// ------------------------------
// SERVER SETTINGS
// ------------------------------
httpServer.setTimeout(120000);
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;

httpServer.listen(PORT, "0.0.0.0", () => {
  log(`Server running on port ${PORT}`);
});

// ------------------------------
// INIT
// ------------------------------
(async () => {
  await registerRoutes(httpServer, app);

  const isDevScript = process.env.npm_lifecycle_event === "dev";
  const isProduction = process.env.NODE_ENV === "production" && !isDevScript;

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }

    log(`Error ${status}: ${message}`, "server");
  });

  app.use("/api", (_req, res) => {
    res.status(404).send("Route not found");
  });

  if (isProduction) {
    const staticDir = path.join(process.cwd(), "dist/public");
    app.use(express.static(staticDir));

    app.get("*", (req, res, next) => {
      if (
        req.path.startsWith("/api") ||
        req.path === "/health" ||
        req.path === "/ws"
      ) {
        return next();
      }

      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  isServerReady = true;
  startupError = null;

  log("Server bootstrap complete", "server");
})().catch((error) => {
  startupError = error instanceof Error ? error : new Error(String(error));
  const message = startupError.stack || startupError.message;

  log(`Server failed to start: ${message}`, "server");
});