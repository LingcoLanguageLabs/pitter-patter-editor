/** FEATURES_TEMPLATES — ported from pagy.co `templates/sy.ts`. */

import { container, heading, image, paragraph, row, section, type SectionTemplate } from "./builders";

const LEAD =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

/** A copy column: heading + body, anchored to the given columns. */
function copy(start: number, end: number, title: string): ReturnType<typeof container> {
  return container({ start, end }, [
    heading(2, title, { start, end, size: "l" }),
    paragraph(LEAD, { start, end, size: "m" }),
  ]);
}

/** A small "feature card" column: image + sub-heading + body. */
function featureCol(start: number, end: number, title: string): ReturnType<typeof container> {
  return container({ start, end }, [
    image({ start, end, aspect: "4/3", radius: "medium" }),
    heading(3, title, { start, end, size: "m" }),
    paragraph(LEAD, { start, end, size: "s" }),
  ]);
}

export const FEATURES_TEMPLATES: SectionTemplate[] = [
  // 1 — centred intro + a wide product shot.
  section({ padding: "large" }, [
    heading(2, "The best short heading", { start: 4, end: 9, align: "center", size: "l" }),
    paragraph(LEAD, { start: 4, end: 9, align: "center", size: "m" }),
    image({ start: 2, end: 11, aspect: "16/9", radius: "large" }),
  ]),

  // 2 — image left, copy right.
  section({ padding: "large" }, [
    row([image({ start: 1, end: 6, aspect: "4/3", radius: "large" }), copy(7, 12, "Grab attention with a good heading here")], {
      align: "center",
    }),
  ]),

  // 3 — copy left, image right.
  section({ padding: "large" }, [
    row([copy(1, 6, "Grab attention with a good heading here"), image({ start: 7, end: 12, aspect: "4/3", radius: "large" })], {
      align: "center",
    }),
  ]),

  // 4 — a list of three features beside an image.
  section({ padding: "large" }, [
    row(
      [
        container({ start: 1, end: 6 }, [
          heading(3, "Feature one", { start: 1, end: 6, size: "m" }),
          paragraph(LEAD, { start: 1, end: 6, size: "s" }),
          heading(3, "Feature two", { start: 1, end: 6, size: "m" }),
          paragraph(LEAD, { start: 1, end: 6, size: "s" }),
          heading(3, "Feature three", { start: 1, end: 6, size: "m" }),
          paragraph(LEAD, { start: 1, end: 6, size: "s" }),
        ]),
        image({ start: 7, end: 12, aspect: "4/3", radius: "large" }),
      ],
      { align: "center" },
    ),
  ]),

  // 5 — three feature columns.
  section({ padding: "large" }, [
    row([featureCol(1, 4, "Feature one"), featureCol(5, 8, "Feature two"), featureCol(9, 12, "Feature three")]),
  ]),
];
