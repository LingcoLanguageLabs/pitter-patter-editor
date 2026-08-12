/**
 * Local persistence for the sample-site catalog — a DEBUG convenience.
 *
 * There's no backend yet, so this mirrors the serializable slice of the store
 * to `localStorage` and rehydrates it on load, letting edits (and any "+ New
 * site" entries) survive a page reload. We persist only:
 *
 *   • `activeSiteId`     — which site to reopen
 *   • `docCache`         — per-site ProseMirror doc JSON (the actual edits)
 *   • `themeCache`       — per-site theme overrides from the design panels
 *   • custom site meta   — sites minted at runtime ("+ New site"). The seed
 *                          `SAMPLE_SITES` are always present and their builder
 *                          functions can't be serialized, so only runtime sites
 *                          are stored and re-hydrated with `buildBlankSiteDoc`.
 *
 * `clearPersistedSites()` backs the picker's "Reset" — it wipes this key so the
 * next load (or the in-place reset in the store) starts from the clean seed.
 */

import { SAMPLE_SITES, buildBlankSiteDoc, type SampleSite } from "./sites";
import type { Theme } from "./theme/css";

const STORAGE_KEY = "pb-debug-sites-v1";

/** Serializable metadata for a runtime-minted site (no `buildDoc` function). */
interface PersistedSiteMeta {
  id: string;
  name: string;
  plan: string;
  subdomain: string;
  theme: Theme;
}

interface PersistedShape {
  version: 1;
  activeSiteId: string;
  docCache: Record<string, unknown>;
  themeCache: Record<string, Theme>;
  customSites: PersistedSiteMeta[];
}

/** The rehydrated slice handed back to the store on init. */
export interface HydratedSites {
  sites: SampleSite[];
  activeSiteId: string;
  docCache: Record<string, unknown>;
  themeCache: Record<string, Theme>;
}

const SEED_IDS = new Set(SAMPLE_SITES.map((s) => s.id));

/**
 * Read + reconstruct the persisted catalog state. Returns `null` when there's
 * nothing stored, the payload is unreadable, or its version is stale — callers
 * then fall back to the seed catalog. Tolerant of any parse/storage error so a
 * corrupt entry can never block startup (the Reset action clears it).
 */
export function loadPersistedSites(): HydratedSites | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let data: PersistedShape;
  try {
    data = JSON.parse(raw) as PersistedShape;
  } catch {
    return null;
  }
  if (!data || data.version !== 1) return null;

  const customSites: SampleSite[] = (data.customSites ?? []).map((meta) => ({
    ...meta,
    buildDoc: buildBlankSiteDoc,
  }));
  const sites = [...SAMPLE_SITES, ...customSites];
  const activeSiteId = sites.some((s) => s.id === data.activeSiteId)
    ? data.activeSiteId
    : SAMPLE_SITES[0]!.id;

  return {
    sites,
    activeSiteId,
    docCache: data.docCache ?? {},
    themeCache: data.themeCache ?? {},
  };
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced write of the catalog slice to `localStorage`. The store calls this
 * on every change (via a subscription); the debounce coalesces the frequent
 * editor-driven updates into at most one write per idle window. Best-effort —
 * quota / serialization failures are swallowed (it's a debug aid).
 */
export function persistSites(slice: {
  sites: SampleSite[];
  activeSiteId: string;
  docCache: Record<string, unknown>;
  themeCache: Record<string, Theme>;
}): void {
  if (typeof window === "undefined") return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const customSites: PersistedSiteMeta[] = slice.sites
      .filter((s) => !SEED_IDS.has(s.id))
      .map(({ id, name, plan, subdomain, theme }) => ({
        id,
        name,
        plan,
        subdomain,
        theme,
      }));
    const payload: PersistedShape = {
      version: 1,
      activeSiteId: slice.activeSiteId,
      docCache: slice.docCache,
      themeCache: slice.themeCache,
      customSites,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded / serialization failure — ignore (best-effort debug aid).
    }
  }, 400);
}

/** Wipe persisted catalog state (backs the picker's "Reset"). */
export function clearPersistedSites(): void {
  if (typeof window === "undefined") return;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
