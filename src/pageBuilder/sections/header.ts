/**
 * HEADER_TEMPLATES — adapted from pagy.co `templates/sg.ts`.
 *
 * pagy has a dedicated `header` node with nested horizontal `stack`s for
 * nav. This schema has neither, so we model a header as a normal `section`
 * (small padding) holding one full-width `row`: a wordmark on the left and
 * the nav as an inline link-run in a right/centre-aligned paragraph, with
 * optional CTA buttons trailing. Visually equivalent, no new node types.
 */

import { button, heading, link, paragraph, row, section, txt, type SectionTemplate } from "./builders";

const BRAND = "Your brand";

/** Inline nav: links separated by a wider gap (collapsed whitespace → nbsp). */
function nav(items: string[], align: "left" | "center" | "right", start: number, end: number) {
  const content: ReturnType<typeof txt>[] = [];
  items.forEach((label, i) => {
    if (i > 0) content.push(txt("    "));
    content.push(link(label));
  });
  return paragraph(content, { start, end, align, size: "s" });
}

export const HEADER_TEMPLATES: SectionTemplate[] = [
  // 1 — wordmark left, nav right.
  section({ padding: "small" }, [
    row(
      [heading(4, BRAND, { start: 1, end: 4, size: "m" }), nav(["Home", "About", "Contact"], "right", 5, 12)],
      { align: "center" },
    ),
  ]),

  // 2 — wordmark left, nav, then Sign in + Get started.
  section({ padding: "small" }, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 3, size: "m" }),
        nav(["Home", "About", "Contact"], "right", 4, 9),
        button("Sign in", { start: 9, end: 10, align: "right", variant: "ghost", color: "neutral", size: "s" }),
        button("Get started", { start: 11, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 3 — wordmark left, nav centred, Sign in + Get started right.
  section({ padding: "small" }, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 3, size: "m" }),
        nav(["Home", "Features", "About", "Contact"], "center", 4, 9),
        button("Sign in", { start: 9, end: 10, align: "right", variant: "ghost", color: "neutral", size: "s" }),
        button("Get started", { start: 11, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 4 — nav left (beside wordmark), CTAs right.
  section({ padding: "small" }, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 2, size: "m" }),
        nav(["Home", "Features", "About"], "left", 3, 8),
        button("Sign in", { start: 9, end: 11, align: "right", variant: "ghost", color: "neutral", size: "s" }),
        button("Get started", { start: 11, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 5 — nav left, wordmark centred, CTA right.
  section({ padding: "small" }, [
    row(
      [
        nav(["Home", "Features", "About"], "left", 1, 4),
        heading(4, BRAND, { start: 5, end: 8, align: "center", size: "m" }),
        button("Get started", { start: 9, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 6 — centred wordmark + nav only.
  section({ padding: "small" }, [
    row(
      [heading(4, BRAND, { start: 4, end: 6, align: "left", size: "m" }), nav(["Home", "About", "Contact"], "right", 7, 9)],
      { align: "center" },
    ),
  ]),
];
