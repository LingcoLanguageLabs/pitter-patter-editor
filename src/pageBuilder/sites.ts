/**
 * Sample-site catalog — the page builder's "global store" of starter sites.
 *
 * Each entry bundles the metadata the site picker shows (name, plan,
 * subdomain) with a document builder + a theme. The UI store seeds its
 * `sites` list from {@link SAMPLE_SITES} and tracks `activeSiteId`; picking a
 * site re-themes (via `setActiveSite`) and the `<Shell>` re-mounts the editor
 * keyed on the active id so the new document loads.
 *
 * Mirrors pagy's notion of a `site` (where doc + theme live on the server);
 * pitter-patter has no API yet, so the catalog is in-memory and "+ New site"
 * appends a fresh blank site at runtime. Adding a curated sample is one entry
 * in {@link SAMPLE_SITES} — the intent is to grow this to ~5 starters.
 */

import type { Schema, Node as PmNode } from "prosemirror-model";

import { buildIcelandSiteDoc, buildLayoutTestDoc, buildPersonalSiteDoc } from "./demoDoc";
import type { InitialDocBuilder } from "./schema";
import { BLANK_SITE_SECTION } from "./sections";
import type { Theme } from "./theme/css";

export interface SampleSite {
  /** Stable id — the store's `activeSiteId` and the editor's remount key. */
  id: string;
  /** Display name shown in the picker (e.g. "YAG 1"). */
  name: string;
  /** Plan badge text (e.g. "Free"). */
  plan: string;
  /** Subdomain shown under the name (e.g. "yag1.pagy.site"). */
  subdomain: string;
  /** Builds the site's document against the page-builder schema. */
  buildDoc: InitialDocBuilder;
  /** The site's theme — colors + fonts + button/input tokens. */
  theme: Theme;
}

/** YAG 1's palette — Karla 500, green-on-cream — matching the pagy
 *  screenshot the builder pixel-matches against. */
const YAG_THEME: Theme = {
  colors: {
    background: "#ffffff",
    neutral: "#34384f",
    primary: "#62bfad",
    secondary: "#d0ece6",
    tertiary: "#f9f7e8",
  },
  fonts: { base: "Karla", heading: "Karla", headingWeight: "500" },
  buttons: { radius: "", style: "" },
  inputs: { shape: "radius-small", style: "solid" },
};

/** A clean neutral palette for blank / new sites — white canvas, dark text,
 *  a single blue accent. Distinct enough from YAG that a switch is obvious. */
const BLANK_THEME: Theme = {
  colors: {
    background: "#ffffff",
    neutral: "#1f2430",
    primary: "#2f6df6",
    secondary: "#e7edff",
    tertiary: "#f4f6fb",
  },
  fonts: { base: "Karla", heading: "Karla", headingWeight: "600" },
  buttons: { radius: "", style: "" },
  inputs: { shape: "radius-small", style: "solid" },
};

/**
 * "Exploring Iceland" — the field-guide palette extracted from the Claude
 * design deck (see `buildIcelandSiteDoc`). The deck's real tokens are warm
 * neutrals + a single cool accent: background = warm "journal paper", neutral =
 * warm near-black ink, primary = a cool slate-blue (the only brand color). No
 * secondary/tertiary — the deck uses exactly one accent (later dark chapters
 * re-tint per subject, but that's not the cover). Fonts: Playfair Display
 * headings over a Spectral body — exactly the deck's pairing. Spectral isn't on
 * the pagy CDN, so it's registered as a `source: "google"` font and loads from
 * Google Fonts (see ThemeStyle / font-face-css). Heading weight 800 matches the
 * deck's heavy display cut.
 */
const ICELAND_THEME: Theme = {
  colors: {
    background: "#faf8f4",
    neutral: "#1b1916",
    primary: "#3c6e88",
  },
  fonts: { base: "Spectral", heading: "Playfair Display", headingWeight: "800" },
  // Crisp, near-square button corners (the deck's ~3px radius), filled in the
  // accent — `none` is closer than `small` (8px).
  buttons: { radius: "none", style: "" },
  inputs: { shape: "radius-small", style: "solid" },
};

/**
 * A minimal starter document: a single page holding one empty, top-aligned
 * section with a left-aligned paragraph ready to type into — no header or
 * footer masters (the doc model makes both optional). Used by the "Totally
 * Blank" sample and every "+ New site".
 */
export function buildBlankSiteDoc(schema: Schema): PmNode {
  const doc = schema.nodes["doc"]!;
  const page = schema.nodes["page"]!;
  const section = schema.nodeFromJSON(BLANK_SITE_SECTION);
  return doc.create(null, [
    page.create({ id: "page-1", title: "Home" }, [section]),
  ]);
}

/** Seed catalog. The first entry is the default on first load. */
export const SAMPLE_SITES: SampleSite[] = [
  {
    id: "yag1",
    name: "YAG 1",
    plan: "Free",
    subdomain: "yag1.pagy.site",
    buildDoc: buildPersonalSiteDoc,
    theme: YAG_THEME,
  },
  {
    id: "exploring-iceland",
    name: "Exploring Iceland",
    plan: "Free",
    subdomain: "iceland.pagy.site",
    buildDoc: buildIcelandSiteDoc,
    theme: ICELAND_THEME,
  },
  {
    id: "layout-lab",
    name: "Layout Lab",
    plan: "Free",
    subdomain: "layoutlab.pagy.site",
    buildDoc: buildLayoutTestDoc,
    theme: BLANK_THEME,
  },
  {
    id: "totally-blank",
    name: "Totally Blank",
    plan: "Free",
    subdomain: "totallyblank.pagy.site",
    buildDoc: buildBlankSiteDoc,
    theme: BLANK_THEME,
  },
];

/**
 * Mints a fresh blank site for "+ New site". The caller supplies a sequence
 * number (the store derives it from the current catalog) so ids/subdomains
 * stay unique without a clock or RNG — keeping site ids deterministic.
 */
export function createBlankSite(seq: number): SampleSite {
  return {
    id: `site-${seq}`,
    name: `New site ${seq}`,
    plan: "Free",
    subdomain: `newsite${seq}.pagy.site`,
    buildDoc: buildBlankSiteDoc,
    theme: BLANK_THEME,
  };
}
