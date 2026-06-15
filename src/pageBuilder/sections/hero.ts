/** HERO_TEMPLATES — ported from pagy.co `templates/sf.ts`. */

import { button, buttonStack, container, heading, image, paragraph, row, section, type SectionTemplate } from "./builders";

const LEAD =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

/** A centered "Get started / Learn more" CTA pair meeting at the band centre. */
function ctaCenter(): ReturnType<typeof row> {
  return row([
    button("Get started", { start: 4, end: 6, align: "right", variant: "primary", color: "primary" }),
    button("Learn more", { start: 7, end: 9, align: "left", variant: "secondary", color: "neutral" }),
  ]);
}

/** A left-aligned CTA pair. */
function ctaLeft(start = 1): ReturnType<typeof row> {
  return row([
    button("Get started", { start, end: start + 1, variant: "primary", color: "primary" }),
    button("Learn more", { start: start + 2, end: start + 3, variant: "secondary", color: "neutral" }),
  ]);
}

export const HERO_TEMPLATES: SectionTemplate[] = [
  // 1 — centered headline + CTA, generous vertical room.
  section({ padding: "large" }, [
    heading(1, "Make something wonderful", { start: 4, end: 9, align: "center", size: "xl" }),
    paragraph(LEAD, { start: 4, end: 9, align: "center", size: "l" }),
    ctaCenter(),
  ]),

  // 2 — centered headline + CTA, then a full-width image.
  section({ padding: "large" }, [
    heading(1, "Make something wonderful", { start: 4, end: 9, align: "center", size: "xl" }),
    paragraph(LEAD, { start: 4, end: 9, align: "center", size: "l" }),
    ctaCenter(),
    image({ start: 1, end: 12, aspect: "16/9", radius: "large" }),
  ]),

  // 3 — split: copy on the left, image on the right.
  section({ padding: "large" }, [
    row(
      [
        container({ start: 1, end: 6 }, [
          heading(1, "Make something wonderful", { start: 1, end: 6, align: "left", size: "xl" }),
          paragraph(LEAD, { start: 1, end: 6, align: "left", size: "l" }),
          buttonStack({ start: 1, end: 6 }, [
            button("Get started", { variant: "primary", color: "primary" }),
            button("Learn more", { variant: "secondary", color: "neutral" }),
          ]),
        ]),
        image({ start: 7, end: 12, aspect: "4/3", radius: "large" }),
      ],
      { align: "center" },
    ),
  ]),

  // 4 — left-aligned headline + CTA, then a full-width image.
  section({ padding: "large" }, [
    heading(1, "Make something wonderful", { start: 1, end: 7, align: "left", size: "xl" }),
    paragraph(LEAD, { start: 1, end: 7, align: "left", size: "l" }),
    ctaLeft(1),
    image({ start: 1, end: 12, aspect: "16/9", radius: "large" }),
  ]),
];
