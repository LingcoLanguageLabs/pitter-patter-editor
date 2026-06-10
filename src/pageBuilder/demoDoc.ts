/**
 * Demo document for the PageBuilder story — mirrors the Pagy screenshot:
 * a single section containing a container (two paragraphs + "Get in
 * touch" button), then a "Work" heading, then a gradient image.
 */

import type { Schema, Node as PmNode } from "prosemirror-model";

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
  return doc.create(null, [
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
  ]);
}
