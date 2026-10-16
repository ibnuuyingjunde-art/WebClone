import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { resolve } from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { crawlWebsite } from "../crawler";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/manus-routes.json", (_req, res) => res.sendFile(resolve(process.cwd(), "public/manus-routes.json")));
  app.post("/api/crawl", async (req, res) => {
    const target = typeof req.body?.url === "string" ? req.body.url : "";
    if (!target.trim()) return res.status(400).json({ error: "A target URL is required" });
    try {
      const startedAt = Date.now();
      const result = await crawlWebsite(target);
      result.stats.durationMs = Date.now() - startedAt;
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to crawl this URL";
      return res.status(400).json({ error: message });
    }
  });
  app.get("/api/crawl/stream", async (req, res) => {
    const target = typeof req.query.url === "string" ? req.query.url : "";
    if (!target.trim()) return res.status(400).json({ error: "A target URL is required" });
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("progress", { stage: "validating", completed: 0, discovered: 1 });
    try {
      const startedAt = Date.now();
      const result = await crawlWebsite(target, { onProgress: progress => send("progress", progress) });
      result.stats.durationMs = Date.now() - startedAt;
      send("complete", result);
    } catch (error) {
      send("error", { error: error instanceof Error ? error.message : "Unable to crawl this URL" });
    } finally {
      res.end();
    }
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
