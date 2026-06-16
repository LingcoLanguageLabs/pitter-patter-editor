/**
 * HEADER_TEMPLATES — adapted from pagy.co `templates/sg.ts`.
 *
 * Each is a real `header` bar (pagy's dedicated header node) holding one
 * full-width `row` — a wordmark on the left and the nav as a real x-axis stack
 * of ghost-button links (each its own block, spaced by the stack's per-child
 * left margin), with optional CTA buttons trailing. The Add-section modal drops
 * the picked header at the top of the page (replacing any existing one).
 */

import { button, header, heading, hstack, row, type SectionTemplate } from "./builders";

const BRAND = "Your brand";

/** Nav: a horizontal stack of ghost-button links, packed to one end of its grid
 *  span. Ghost buttons (not plain text) so the nav reads as one consistent
 *  button row with the trailing Sign-in / Get-started CTAs. */
function nav(items: string[], align: "left" | "center" | "right", start: number, end: number) {
  const justify = align === "right" ? "end" : align === "center" ? "center" : "start";
  return hstack(
    { start, end, justify },
    items.map((label) => button(label, { variant: "ghost", color: "neutral", size: "s" })),
  );
}

export const HEADER_TEMPLATES: SectionTemplate[] = [
  // 1 — wordmark left, nav right.
  header({}, [
    row(
      [heading(4, BRAND, { start: 1, end: 4, size: "s" }), nav(["Home", "About", "Contact"], "right", 5, 12)],
      { align: "center" },
    ),
  ]),

  // 2 — wordmark left, nav, then Sign in + Get started.
  header({}, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 3, size: "s" }),
        nav(["Home", "About", "Contact"], "right", 4, 9),
        button("Sign in", { start: 9, end: 10, align: "right", variant: "ghost", color: "neutral", size: "s" }),
        button("Get started", { start: 11, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 3 — wordmark left, nav centred, Sign in + Get started right.
  header({}, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 3, size: "s" }),
        nav(["Home", "Features", "About", "Contact"], "center", 4, 9),
        button("Sign in", { start: 9, end: 10, align: "right", variant: "ghost", color: "neutral", size: "s" }),
        button("Get started", { start: 11, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 4 — nav left (beside wordmark), CTAs right.
  header({}, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 2, size: "s" }),
        nav(["Home", "Features", "About"], "left", 3, 8),
        button("Sign in", { start: 9, end: 11, align: "right", variant: "ghost", color: "neutral", size: "s" }),
        button("Get started", { start: 11, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 5 — nav left, wordmark centred, CTA right.
  header({}, [
    row(
      [
        nav(["Home", "Features", "About"], "left", 1, 4),
        heading(4, BRAND, { start: 5, end: 8, align: "center", size: "s" }),
        button("Get started", { start: 9, end: 12, align: "right", variant: "primary", color: "primary", size: "s" }),
      ],
      { align: "center" },
    ),
  ]),

  // 6 — centred wordmark + nav only.
  header({}, [
    row(
      [heading(4, BRAND, { start: 4, end: 6, align: "left", size: "s" }), nav(["Home", "About", "Contact"], "right", 7, 9)],
      { align: "center" },
    ),
  ]),
];
