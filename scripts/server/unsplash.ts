/**
 * Unsplash proxy.
 *
 *   GET /api/unsplash/search?q=mountains&page=1[&per_page=12]
 *   GET /api/unsplash/random?count=12[&query=mountains]
 *
 * Calls the Unsplash REST API server-side using `UNSPLASH_ACCESS_KEY`
 * (read from .env). The key never reaches the browser. Each response
 * is normalized to a small shape the picker needs:
 *
 *   { id, urls: { thumb, small, regular, full },
 *     description, alt_description,
 *     user: { name, links: { html } },
 *     links: { html } }
 *
 * Per Unsplash API guidelines, the picker MUST include attribution to
 * the photographer with `?utm_source=pitter-patter&utm_medium=referral`
 * on the photographer link. The frontend handles that.
 */

import { Hono } from "hono";

const UNSPLASH_BASE = "https://api.unsplash.com";

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
  links: { html: string };
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
    links: { html: p.links.html },
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

  if (!q.trim()) {
    return c.json({ results: [], total: 0, total_pages: 0 });
  }

  const url = new URL(`${UNSPLASH_BASE}/search/photos`);
  url.searchParams.set("query", q);
  url.searchParams.set("page", page);
  url.searchParams.set("per_page", perPage);

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

  const url = new URL(`${UNSPLASH_BASE}/photos/random`);
  url.searchParams.set("count", count);
  if (query) url.searchParams.set("query", query);

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
