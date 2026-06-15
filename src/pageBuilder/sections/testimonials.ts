/** TESTIMONIALS_TEMPLATES — adapted from pagy.co `templates/sv.ts`. */

import { bold, card, image, muted, paragraph, row, section, txt, type SectionTemplate } from "./builders";

const QUOTE =
  "“Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. Duis cursus, mi quis viverra ornare, eros dolor interdum nulla.”";

/** A boxed testimonial: quote, then name + role. */
function quoteCard(start: number, end: number): ReturnType<typeof card> {
  return card({ start, end, padding: "l" }, [
    paragraph(QUOTE, { start, end, size: "m" }),
    paragraph([bold("Molly Davis")], { start, end, size: "s" }),
    paragraph([muted("CEO at FlowTask")], { start, end, size: "xs" }),
  ]);
}

export const TESTIMONIALS_TEMPLATES: SectionTemplate[] = [
  // 1 — one large centred quote with an avatar + attribution.
  section({ padding: "large" }, [
    paragraph(QUOTE, { start: 3, end: 10, align: "center", size: "l" }),
    image({ start: 6, end: 7, shape: "circle", aspect: "original", radius: "none" }),
    paragraph([txt("Molly Davis")], { start: 4, end: 9, align: "center", size: "m" }),
    paragraph([muted("CEO at FlowTask")], { start: 4, end: 9, align: "center", size: "xs" }),
  ]),

  // 2 — two testimonials side by side.
  section({ padding: "large" }, [row([quoteCard(1, 6), quoteCard(7, 12)])]),

  // 3 — three testimonials.
  section({ padding: "large" }, [row([quoteCard(1, 4), quoteCard(5, 8), quoteCard(9, 12)])]),
];
