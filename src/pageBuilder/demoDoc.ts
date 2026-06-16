/**
 * Demo document for the PageBuilder story — a two-slide deck. Slide 1
 * mirrors the Pagy screenshot (a section with a container of two intro
 * paragraphs + a "Get in touch" button, a "Work" heading, and images);
 * slide 2 is a minimal section so render-gating (only the active slide
 * mounts) is observable.
 */

import type { Schema, Node as PmNode } from "prosemirror-model";

import { FOOTER_TEMPLATES } from "./sections/footer";
import { HEADER_TEMPLATES } from "./sections/header";

// Gradient placeholder lives as a real asset, referenced by URL rather
// than an inline `data:` blob — keeps the doc readable and the Image
// block's Source field a tidy path instead of a 700-char URI. The
// `?no-inline` query stops Vite from inlining the (small) SVG back into
// a data URI, so we always get a served file path.
import workGradient from "./assets/work-gradient.svg?no-inline";

/** URL of the rainbow gradient placeholder used in the demo. */
export const GRADIENT_IMAGE_URI = workGradient;

/** A real photo hotlinked from Unsplash, so the demo shows the Image
 *  block with actual content (not just the gradient placeholder).
 *  Unsplash permits hotlinking `images.unsplash.com` URLs; the query
 *  params ask their CDN for a reasonably-sized, auto-formatted crop. */
export const WORK_PHOTO_URL =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80";

export function buildPersonalSiteDoc(schema: Schema): PmNode {
  const section = schema.nodes["section"]!;
  const paragraph = schema.nodes["paragraph"]!;
  const heading = schema.nodes["heading"]!;
  const buttonNode = schema.nodes["button"]!;
  const image = schema.nodes["image"]!;
  const doc = schema.nodes["doc"]!;

  // Section spans the full grid (0–12 → CSS .start-left .end-12 →
  // grid-column 1 / 14). Children default to shuffle's 4/9 which puts
  // them in a centered column inside the section — same as Pagy's
  // default block alignment in image 8.
  const FULL = { shuffleStart: 0, shuffleEnd: 12 } as const;

  const p = (text: string) => paragraph.create(null, schema.text(text));
  const h = (level: number, text: string) =>
    heading.create({ level }, schema.text(text));

  // Container wrapping the two intro paragraphs. No spread passed, so it
  // takes shuffle's default 4/9 — the same start/stop the surrounding blocks
  // get (the centered content column), NOT the section's full-width 0–12.
  const container = schema.nodes["container"]!;
  const page = schema.nodes["page"]!;
  // The site-wide header / footer (built from the same templates the
  // Add-section modal offers). The doc is `header? page+ footer?`, so these
  // are the GLOBAL masters — rendered around every page. New pages inherit
  // them automatically; a page detaches or hides its own. They live ONCE here,
  // not per-page, so editing one changes every page that inherits it.
  const header = schema.nodeFromJSON(HEADER_TEMPLATES[0]);
  const footer = schema.nodeFromJSON(FOOTER_TEMPLATES[0]);
  // Two pages so render-gating is observable: only the active slide's content
  // mounts, but the global bars persist across both.
  return doc.create(null, [
    header,
    page.create({ id: "page-1", title: "Intro" }, [
      section.create(FULL, [
        container.create(null, [
          p(
            "I’m Ethan Brooks, a designer based in Melbourne. I make digital experiences that are simple, intuitive, and mildly entertaining to use. If it’s not easy, it’s probably my fault, and I’m probably already fixing it while pretending everything’s fine.",
          ),
          p(
            "Currently, I’m working on product design at Beacon. Before this, I designed at Lumen, Stitch, and a travel app that launched just before everyone stopped traveling.",
          ),
        ]),
        buttonNode.create({
          label: "Get in touch",
          variant: "primary",
          href: "#",
        }),
        h(3, "Work"),
        image.create({
          src: GRADIENT_IMAGE_URI,
          alt: "Recent work",
          aspect: "16/9",
        }),
        // A real photo example (hotlinked) so the Image block isn't only
        // ever the gradient placeholder. Different aspect + shadow to show
        // the new presentation controls on real content.
        image.create({
          src: WORK_PHOTO_URL,
          alt: "Mountain landscape",
          aspect: "3/2",
          radius: "large",
          frame: "shadow",
        }),
      ]),
    ]),
    page.create({ id: "page-2", title: "Work" }, [
      section.create(FULL, [
        h(1, "Second slide"),
        p(
          "This slide’s content only mounts while it’s the active slide — the deck stays one document, but the canvas renders one page at a time.",
        ),
      ]),
    ]),
    footer,
  ]);
}

/**
 * Layout-coverage deck — exercises the grid features the personal-site demo
 * doesn't: a multi-column `row` (two `container`s side by side) and a themed
 * `card`. Used to confirm the static `SiteRenderer` reproduces shuffle's grid
 * (column spans + side-by-side rows) identically to the editor.
 */
export function buildLayoutTestDoc(schema: Schema): PmNode {
  const n = schema.nodes;
  const t = (s: string) => schema.text(s);
  const p = (s: string) => n["paragraph"]!.create(null, t(s));
  const h = (level: number, s: string) =>
    n["heading"]!.create({ level }, t(s));
  const FULL = { shuffleStart: 0, shuffleEnd: 12 } as const;

  return n["doc"]!.create(null, [
    n["page"]!.create({ id: "layout-1", title: "Layout" }, [
      n["section"]!.create(FULL, [
        h(2, "Two-column row"),
        n["row"]!.create(null, [
          n["container"]!.create({ shuffleStart: 0, shuffleEnd: 6 }, [
            h(3, "Left"),
            p("Left column — should occupy the left half of the grid, beside the right column (not stacked)."),
          ]),
          n["container"]!.create({ shuffleStart: 6, shuffleEnd: 12 }, [
            h(3, "Right"),
            p("Right column — sits to the right of the left column on the same row."),
          ]),
        ]),
        h(2, "Card"),
        n["card"]!.create({ padding: "l", radius: "large", theme: "primary" }, [
          h(3, "Card title"),
          p("Card body text inside a themed card with padding and a large radius."),
          n["button"]!.create({ label: "Card button", variant: "primary", href: "#" }),
        ]),
      ]),
    ]),
  ]);
}
