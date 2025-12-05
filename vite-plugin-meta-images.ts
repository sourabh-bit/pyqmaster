import type { Plugin } from "vite";
import fs from "fs";
import path from "path";

/**
 * Vite plugin that updates og:image and twitter:image meta tags
 * to point to the app's opengraph image with the correct Replit domain.
 */
export function metaImagesPlugin(): Plugin {
  return {
    name: "vite-plugin-meta-images",

    transformIndexHtml(html) {
      const baseUrl = getDeploymentUrl();
      if (!baseUrl) {
        log(
          "[meta-images] No Replit deployment domain found, skipping meta tag updates"
        );
        return html; // ALWAYS return html
      }

      // Detect opengraph image
      const publicDir = path.resolve(process.cwd(), "client", "public");
      const ogPaths = ["png", "jpg", "jpeg"].map((ext) => ({
        ext,
        path: path.join(publicDir, `opengraph.${ext}`),
      }));

      const found = ogPaths.find((f) => fs.existsSync(f.path));
      if (!found) {
        log(
          "[meta-images] OpenGraph image not found, skipping meta tag updates"
        );
        return html; // ALWAYS return html
      }

      const imageUrl = `${baseUrl}/opengraph.${found.ext}`;
      log("[meta-images] Updating meta image tags to:", imageUrl);

      // FIXED REGEX — this works for <meta ...> and <meta ... />
      let finalHtml = html.replace(
        /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/g,
        `<meta property="og:image" content="${imageUrl}" />`
      );

      finalHtml = finalHtml.replace(
        /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/g,
        `<meta name="twitter:image" content="${imageUrl}" />`
      );

      return finalHtml; // ALWAYS return string
    },
  };
}

function getDeploymentUrl(): string | null {
  if (process.env.REPLIT_INTERNAL_APP_DOMAIN) {
    const url = `https://${process.env.REPLIT_INTERNAL_APP_DOMAIN}`;
    log("[meta-images] Using internal app domain:", url);
    return url;
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    const url = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    log("[meta-images] Using dev domain:", url);
    return url;
  }

  return null;
}

function log(...args: any[]): void {
  if (process.env.NODE_ENV === "production") {
    console.log(...args);
  }
}
