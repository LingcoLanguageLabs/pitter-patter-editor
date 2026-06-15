/** CTA_TEMPLATES — ported from pagy.co `templates/sj.ts`. */

import {
  button,
  buttonStack,
  container,
  heading,
  image,
  paragraph,
  row,
  section,
  type SectionTemplate,
} from "./builders";

const LEAD =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

export const CTA_TEMPLATES: SectionTemplate[] = [
  // 1 — split: copy + buttons left, image right.
  section({ padding: "large" }, [
    row(
      [
        container({ start: 1, end: 6 }, [
          heading(2, "Make something wonderful", { start: 1, end: 6, align: "left", size: "l" }),
          paragraph(LEAD, { start: 1, end: 6, align: "left", size: "m" }),
          buttonStack({ start: 1, end: 6 }, [
            button("Get started", { variant: "primary", color: "primary" }),
            button("Contact us", { variant: "secondary", color: "neutral" }),
          ]),
        ]),
        image({ start: 7, end: 12, aspect: "16/9", radius: "large" }),
      ],
      { align: "center" },
    ),
  ]),

  // 2 — left-aligned copy with a button pair.
  section({ padding: "large" }, [
    heading(2, "Make something wonderful", { start: 1, end: 8, align: "left", size: "l" }),
    paragraph("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.", {
      start: 1,
      end: 8,
      align: "left",
      size: "m",
    }),
    row([
      button("Get started", { start: 1, end: 2, variant: "primary", color: "primary" }),
      button("Contact us", { start: 3, end: 4, variant: "secondary", color: "neutral" }),
    ]),
  ]),

  // 3 — centred copy with a button pair.
  section({ padding: "large" }, [
    heading(2, "Make something wonderful", { start: 3, end: 10, align: "center", size: "l" }),
    paragraph("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.", {
      start: 3,
      end: 10,
      align: "center",
      size: "m",
    }),
    row([
      button("Get started", { start: 4, end: 6, align: "right", variant: "primary", color: "primary" }),
      button("Contact us", { start: 7, end: 9, align: "left", variant: "secondary", color: "neutral" }),
    ]),
  ]),
];
