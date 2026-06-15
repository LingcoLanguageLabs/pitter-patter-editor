/** FOOTER_TEMPLATES — ported from pagy.co `templates/sk.ts`. */

import { bold, container, heading, link, muted, paragraph, row, section, txt, type SectionTemplate } from "./builders";

const BRAND = "Your brand";

/** A footer link column: a bold label then a list of links. */
function linkColumn(start: number, end: number, label: string, links: string[]): ReturnType<typeof container> {
  return container({ start, end }, [
    paragraph([bold(label)], { start, end, size: "s" }),
    ...links.map((l) => paragraph([link(l)], { start, end, size: "s" })),
  ]);
}

export const FOOTER_TEMPLATES: SectionTemplate[] = [
  // 1 — brand blurb + three link columns.
  section({ padding: "medium" }, [
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

  // 2 — wordmark left, social links right.
  section({ padding: "small" }, [
    row(
      [
        heading(4, BRAND, { start: 1, end: 3, size: "s" }),
        paragraph([link("Twitter"), txt("    "), link("Instagram"), txt("    "), link("LinkedIn")], {
          start: 7,
          end: 12,
          align: "right",
          size: "s",
        }),
      ],
      { align: "center" },
    ),
  ]),

  // 3 — centred social links.
  section({ padding: "small" }, [
    paragraph([link("Twitter"), txt("    "), link("Instagram"), txt("    "), link("LinkedIn")], {
      start: 4,
      end: 9,
      align: "center",
      size: "s",
    }),
    paragraph([muted("© 2026 " + BRAND)], { start: 4, end: 9, align: "center", size: "xs" }),
  ]),
];
