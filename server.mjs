import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const port = Number(process.env.PORT || 8080);
const host = "0.0.0.0";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method Not Allowed");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad Request");
  }

  const relativePath = normalize(pathname).replace(/^([/\\])+/, "");
  let filePath = join(root, relativePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  // Client-side routes fall back to the SPA entry point; missing assets remain 404.
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    const looksLikeAsset = extname(pathname) !== "";
    if (looksLikeAsset) {
      res.writeHead(404);
      return res.end("Not Found");
    }
    filePath = join(root, "index.html");
  }

  const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  const cacheControl = pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });

  if (req.method === "HEAD") return res.end();
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  console.log(`Afrixa static server listening on ${host}:${port}`);
});
