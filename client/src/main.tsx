import "./lib/chat-storage-patch";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register Service Worker for PWA (PRODUCTION ONLY)
// Disable in development to prevent issues
const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const appBuildHash = (() => {
  try {
    const moduleUrl = new URL(import.meta.url);
    const match = moduleUrl.pathname.match(/index-([A-Za-z0-9_-]+)\.js$/);
    if (match?.[1]) return match[1];
  } catch (_err) {
    // no-op
  }
  return (window as any).__APP_VERSION__ || "dev";
})();

if ('serviceWorker' in navigator && !isDevelopment) {
  window.addEventListener('load', () => {
    const swUrl = `/sw.js?v=${encodeURIComponent(appBuildHash)}`;
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('SW registered:', registration.scope);

        const forceWaitingWorker = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };
        forceWaitingWorker();

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") {
              forceWaitingWorker();
            }
          });
        });
        
        let updateTimer: number | null = null;
        const triggerUpdate = () => {
          if (document.hidden || navigator.onLine === false) return;
          registration.update().catch(() => {});
        };

        const scheduleUpdateChecks = () => {
          if (updateTimer != null) {
            window.clearInterval(updateTimer);
            updateTimer = null;
          }
          if (!document.hidden) {
            // Lower update frequency to reduce battery/network load.
            updateTimer = window.setInterval(triggerUpdate, 30 * 60 * 1000);
          }
        };

        const onVisibilityChange = () => {
          if (!document.hidden) triggerUpdate();
          scheduleUpdateChecks();
        };

        window.addEventListener("online", triggerUpdate);
        document.addEventListener("visibilitychange", onVisibilityChange);
        scheduleUpdateChecks();
        triggerUpdate();
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
} else if (isDevelopment) {
  // Unregister any existing service workers in development
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
