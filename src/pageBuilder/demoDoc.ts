/**
 * Demo document for the PageBuilder story — mirrors the Pagy screenshot:
 * a single section containing a container (two paragraphs + "Get in
 * touch" button), then a "Work" heading, then a gradient image.
 */

import type { Schema, Node as PmNode } from "prosemirror-model";

/** Inline-svg-data-uri gradient — matches the rainbow gradient in Pagy's demo. */
export const GRADIENT_IMAGE_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 540" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"  stop-color="#ff5fa2"/>
      <stop offset="35%" stop-color="#ffb968"/>
      <stop offset="65%" stop-color="#9b8bff"/>
      <stop offset="100%" stop-color="#4ccbff"/>
    </linearGradient>
    <filter id="b" x="0" y="0" width="100%" height="100%">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
  </defs>
  <rect width="800" height="540" fill="url(#g)" filter="url(#b)"/>
</svg>`);

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

  return doc.create(null, [
    section.create(FULL, [
      p(
        "I’m Ethan Brooks, a designer based in Melbourne. I make digital experiences that are simple, intuitive, and mildly entertaining to use. If it’s not easy, it’s probably my fault, and I’m probably already fixing it while pretending everything’s fine.",
      ),
      p(
        "Currently, I’m working on product design at Beacon. Before this, I designed at Lumen, Stitch, and a travel app that launched just before everyone stopped traveling.",
      ),
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
    ]),
  ]);
}
