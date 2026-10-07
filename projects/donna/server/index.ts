import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { analysisInputSchema } from "../shared/schema.js";
import { runAnalysis } from "./analysis.js";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT must be between 1024 and 65535.");
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  if (!hosts.includes(req.headers.host || "")) {
    res
      .status(403)
      .json({ error: "This development app is available on localhost only." });
    return;
  }
  const origin = req.headers.origin;
  if (origin && !hosts.some((host) => origin === `http://${host}`)) {
    res.status(403).json({ error: "Unrecognized request origin." });
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use("/api", express.json({ limit: "1mb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("/api/status", (_req, res) =>
  res.json({
    analysisAvailable: Boolean(process.env.OPENAI_API_KEY),
    provider: "OpenAI",
  }),
);
let analysisInProgress = false;
app.post("/api/review", async (req, res) => {
  const parsed = analysisInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error: parsed.error.issues.map((issue) => issue.message).join(" "),
      });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res
      .status(503)
      .json({
        error:
          "Live analysis is not connected. Add OPENAI_API_KEY to the server .env file and restart. Local review remains available.",
      });
    return;
  }
  if (analysisInProgress) {
    res
      .status(429)
      .json({
        error:
          "A review is already running. Wait for it to finish before starting another.",
      });
    return;
  }
  analysisInProgress = true;
  try {
    res.json(
      await runAnalysis(
        parsed.data,
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_MODEL || "gpt-6-astra",
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Analysis timed out. No partial findings were added."
        : error instanceof Error
          ? error.message
          : "Analysis failed. Your local review is unchanged.";
    res.status(502).json({ error: message });
  } finally {
    analysisInProgress = false;
  }
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Unknown endpoint." }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.use((_req, res) => res.sendFile(path.join(root, "dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    try {
      const html = await readFile(path.join(root, "index.html"), "utf8");
      res
        .type("html")
        .send(await vite.transformIndexHtml(req.originalUrl, html));
    } catch (error) {
      next(error);
    }
  });
}
app.use(
  (
    error: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res
      .status(error.status || 500)
      .json({
        error:
          error.status === 413
            ? "Request is too large."
            : "The request could not be processed.",
      });
  },
);
app.listen(port, "127.0.0.1", () =>
  console.log(`Donna is available at http://localhost:${port}`),
);
