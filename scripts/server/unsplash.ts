/**
 * Unsplash proxy.
 *
 *   GET  /api/unsplash/search?q=mountains&page=1[&per_page=12]
 *        [&orientation=landscape|portrait|squarish]
 *        [&color=black_and_white|black|white|yellow|orange|red|purple|
 *                magenta|green|teal|blue]
 *        [&order_by=relevant|latest]
 *   GET  /api/unsplash/random?count=12[&query=mountains][&orientation=…]
 *   POST /api/unsplash/track-download   { download_location }
 *
 * Calls the Unsplash REST API server-side using `UNSPLASH_ACCESS_KEY`
 * (read from .env). The key never reaches the browser. Each response
 * is normalized to a small shape the picker needs:
 *
 *   { id, urls: { thumb, small, regular, full },
 *     description, alt_description,
 *     user: { name, links: { html } },
 *     links: { html, download_location } }
 *
 * Per Unsplash API guidelines:
 *  - the picker MUST attribute the photographer with
 *    `?utm_source=pitter-patter&utm_medium=referral` on their link
 *    (the frontend handles that), and
 *  - when a photo is actually USED (inserted), the app MUST ping the
 *    photo's `download_location` — that's what `/track-download` is for.
 * We also force `content_filter=high` so searches return safe results.
 */

import { Hono } from "hono";

const UNSPLASH_BASE = "https://api.unsplash.com";

/** Whitelisted filter values, mirroring the Unsplash API's enums. Anything
 *  outside these is dropped rather than forwarded, so a bad query param can't
 *  make Unsplash 400 the whole search. */
const ORIENTATIONS = new Set(["landscape", "portrait", "squarish"]);
const COLORS = new Set([
  "black_and_white",
  "black",
  "white",
  "yellow",
  "orange",
  "red",
  "purple",
  "magenta",
  "green",
  "teal",
  "blue",
]);
const ORDERS = new Set(["relevant", "latest"]);

interface UnsplashPhoto {
  id: string;
  urls: {
    thumb?: string;
    small?: string;
    regular?: string;
    full?: string;
  };
  description: string | null;
  alt_description: string | null;
  user: {
    name: string;
    links: { html: string };
  };
  links: { html: string; download_location?: string };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

function normalize(p: UnsplashPhoto): UnsplashPhoto {
  return {
    id: p.id,
    urls: {
      thumb: p.urls.thumb,
      small: p.urls.small,
      regular: p.urls.regular,
      full: p.urls.full,
    },
    description: p.description,
    alt_description: p.alt_description,
    user: {
      name: p.user.name,
      links: { html: p.user.links.html },
    },
    // `download_location` rides through so the frontend can ping it via
    // `/track-download` when the photo is inserted (Unsplash requirement).
    links: { html: p.links.html, download_location: p.links.download_location },
  };
}

export const unsplashRoutes = new Hono();

unsplashRoutes.get("/search", async (c) => {
  if (!process.env["UNSPLASH_ACCESS_KEY"]) {
    return c.json(
      {
        error:
          "UNSPLASH_ACCESS_KEY is not set. Add it to .env or your shell env.",
      },
      500,
    );
  }
  const q = c.req.query("q") ?? "";
  const page = c.req.query("page") ?? "1";
  const perPage = c.req.query("per_page") ?? "12";
  const orientation = c.req.query("orientation") ?? "";
  const color = c.req.query("color") ?? "";
  const orderBy = c.req.query("order_by") ?? "";

  if (!q.trim()) {
    return c.json({ results: [], total: 0, total_pages: 0 });
  }

  const url = new URL(`${UNSPLASH_BASE}/search/photos`);
  url.searchParams.set("query", q);
  url.searchParams.set("page", page);
  url.searchParams.set("per_page", perPage);
  // Safe results by default (the picker has no NSFW toggle).
  url.searchParams.set("content_filter", "high");
  // Optional filters — only forwarded when they're valid enum values, so a
  // stray param can't 400 the upstream request.
  if (ORIENTATIONS.has(orientation)) url.searchParams.set("orientation", orientation);
  if (COLORS.has(color)) url.searchParams.set("color", color);
  if (ORDERS.has(orderBy)) url.searchParams.set("order_by", orderBy);

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${process.env["UNSPLASH_ACCESS_KEY"]}`,
      "Accept-Version": "v1",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return c.json(
      { error: `Unsplash search failed (${res.status}) ${body.slice(0, 200)}` },
      502,
    );
  }

  const data = (await res.json()) as UnsplashSearchResponse;
  return c.json({
    results: data.results.map(normalize),
    total: data.total,
    total_pages: data.total_pages,
  });
});

unsplashRoutes.get("/random", async (c) => {
  if (!process.env["UNSPLASH_ACCESS_KEY"]) {
    return c.json(
      {
        error:
          "UNSPLASH_ACCESS_KEY is not set. Add it to .env or your shell env.",
      },
      500,
    );
  }
  const count = c.req.query("count") ?? "12";
  const query = c.req.query("query") ?? "";
  const orientation = c.req.query("orientation") ?? "";

  const url = new URL(`${UNSPLASH_BASE}/photos/random`);
  url.searchParams.set("count", count);
  url.searchParams.set("content_filter", "high");
  if (query) url.searchParams.set("query", query);
  if (ORIENTATIONS.has(orientation)) url.searchParams.set("orientation", orientation);

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${process.env["UNSPLASH_ACCESS_KEY"]}`,
      "Accept-Version": "v1",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return c.json(
      { error: `Unsplash random failed (${res.status}) ${body.slice(0, 200)}` },
      502,
    );
  }

  const data = (await res.json()) as UnsplashPhoto[];
  return c.json({
    results: data.map(normalize),
  });
});

/**
 * Trigger a download event for a used photo. Unsplash REQUIRES this whenever a
 * photo is actually inserted (not just browsed) — it's how photographers get
 * credited usage stats. The frontend POSTs the photo's `download_location`
 * (returned in `links.download_location`); we hit it with the access key.
 * Best-effort: failures here never block the insert, so we always 200 to the
 * client and only surface the upstream status in the body.
 */
unsplashRoutes.post("/track-download", async (c) => {
  if (!process.env["UNSPLASH_ACCESS_KEY"]) {
    return c.json({ ok: false, error: "UNSPLASH_ACCESS_KEY is not set." }, 500);
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    download_location?: string;
  };
  const loc = body.download_location ?? "";
  // Only follow Unsplash's own API host — never an arbitrary URL from the client.
  if (!loc.startsWith(`${UNSPLASH_BASE}/`)) {
    return c.json({ ok: false, error: "Invalid download_location" }, 400);
  }

  const res = await fetch(loc, {
    headers: {
      Authorization: `Client-ID ${process.env["UNSPLASH_ACCESS_KEY"]}`,
      "Accept-Version": "v1",
    },
  });
  return c.json({ ok: res.ok, status: res.status });
});
