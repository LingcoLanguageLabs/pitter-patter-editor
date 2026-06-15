/** LOGOS_TEMPLATES — ported from pagy.co `templates/sb.ts`. */

import { heading, image, row, section, type SectionTemplate } from "./builders";

/** A strip of evenly-spaced logo placeholders across the band. */
function logoStrip(count: number): ReturnType<typeof row> {
  const span = Math.floor(12 / count);
  const imgs = Array.from({ length: count }, (_, i) => {
    const start = i * span + 1;
    return image({ start, end: start + span - 1, aspect: "3/2", radius: "none" });
  });
  return row(imgs, { align: "center" });
}

export const LOGOS_TEMPLATES: SectionTemplate[] = [
  // 1 — left heading, six logos.
  section({ padding: "medium" }, [
    heading(2, "Trusted by", { start: 1, end: 6, align: "left", size: "l" }),
    logoStrip(6),
  ]),

  // 2 — centred heading, five logos.
  section({ padding: "medium" }, [
    heading(2, "Trusted by", { start: 1, end: 12, align: "center", size: "l" }),
    logoStrip(5),
  ]),
];
