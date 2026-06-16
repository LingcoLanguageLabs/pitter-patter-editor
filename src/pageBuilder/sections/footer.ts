/**
 * FOOTER_TEMPLATES — ported from pagy.co `templates/sk.ts`.
 *
 * Each is a real `footer` bar (pagy renders footers as sections; we give them a
 * dedicated node). The Add-section modal drops the picked footer at the bottom
 * of the page (replacing any existing one). `padding` is the symmetric vertical
 * px the footer's `py-{unit}` class renders.
 *
 * Footer links — both the column nav lists and the social rows — are ghost
 * buttons (each its own block, spaced by the stack's per-child margin), matching
 * the header nav, rather than plain text-link paragraphs.
 */

import { bold, button, container, footer, heading, hstack, muted, paragraph, row, type SectionTemplate } from "./builders";

const BRAND = "Your brand";

/** One nav link as a ghost button — the shared look for the footer columns and
 *  social rows (and the header nav). */
function navButton(label: string) {
  return button(label, { variant: "ghost", color: "neutral", size: "s" });
}

/** A footer link column: a bold label, then a vertical stack of ghost-button
 *  links packed to the left (content-width, not stretched edge to edge). */
function linkColumn(start: number, end: number, label: string, links: string[]): ReturnType<typeof container> {
  return container({ start, end, align: "start" }, [
    paragraph([bold(label)], { size: "s" }),
    ...links.map(navButton),
  ]);
}

/** A horizontal run of social ghost-button links (the x-axis twin of a column). */
function socialRow(
  o: { start: number; end: number; justify: "start" | "center" | "end" },
  links: string[],
) {
  return hstack({ start: o.start, end: o.end, justify: o.justify }, links.map(navButton));
}

export const FOOTER_TEMPLATES: SectionTemplate[] = [
  // 1 — brand blurb + three link columns.
  footer({ padding: 64 }, [
    row([
      container({ start: 1, end: 4 }, [
        heading(4, BRAND, { start: 1, end: 4, size: "s" }),
        paragraph("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.", {
          start: 1,
          end: 4,
          size: "s",
        }),
        paragraph([muted("© 2026")], { start: 1, end: 4, size: "xs" }),
      ]),
      linkColumn(7, 8, "Product", ["Features", "Pricing", "Changelog"]),
      linkColumn(9, 10, "Company", ["About", "Careers", "Contact"]),
      linkColumn(11, 12, "Follow us", ["Instagram", "Twitter", "LinkedIn"]),
    ]),
  ]),

  // 2 — wordmark left, social links right (x-axis stack).
  footer({ padding: 48 }, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 3, size: "s" }),
        socialRow({ start: 7, end: 12, justify: "end" }, ["Twitter", "Instagram", "LinkedIn"]),
      ],
      { align: "center" },
    ),
  ]),

  // 3 — centred social links (x-axis stack).
  footer({ padding: 48 }, [
    socialRow({ start: 4, end: 9, justify: "center" }, ["Twitter", "Instagram", "LinkedIn"]),
    paragraph([muted("© 2026 " + BRAND)], { start: 4, end: 9, align: "center", size: "xs" }),
  ]),
];
