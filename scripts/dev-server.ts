/**
 * Local dev backend for Pitter Patter editor extensions that need
 * server-side support — AI today, soon Unsplash search, comments, and
 * anything else that can't run from the browser alone.
 *
 *   yarn dev:server               # listens on http://localhost:3001
 *   ANTHROPIC_API_KEY=sk-ant-...  # required for /api/ai (in .env)
 *
 * Routes mount as `/api/<module>/...`. The frontend extensions that
 * call them are configured with a base URL — point at this server in
 * dev, point at your real backend in prod.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { aiRoutes } from "./server/ai";
import { collabRoutes } from "./server/collab";
import { unsplashRoutes } from "./server/unsplash";

const app = new Hono();

app.use("/*", cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true, time: Date.now() }));

// ── /api/ai/...     — Vercel AI SDK + Anthropic streaming
app.route("/api/ai", aiRoutes);

// ── /api/docs/...   — pitter-patter collab + presence + comments + snapshots
app.route("/api/docs", collabRoutes);

// ── /api/unsplash/...  — Unsplash photo search proxy
app.route("/api/unsplash", unsplashRoutes);

const port = Number(process.env["PORT"] ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[dev-server] listening on http://localhost:${info.port}`);
  // eslint-disable-next-line no-console
  console.log(`              POST  /api/ai`);
  // eslint-disable-next-line no-console
  console.log(`              POST  /api/docs/:id/commits`);
  // eslint-disable-next-line no-console
  console.log(`              POST  /api/docs/:id/comments/threads`);
  // eslint-disable-next-line no-console
  console.log(`              GET   /health`);
});
