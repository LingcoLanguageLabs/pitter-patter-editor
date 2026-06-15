/**
 * FAQ_TEMPLATES — adapted from pagy.co `templates/sw.ts`.
 *
 * pagy renders FAQs as an interactive `accordion`; this schema has no
 * accordion node, so we lay them out as question (heading) + answer
 * (paragraph) pairs — the same content, statically expanded.
 */

import { container, heading, paragraph, row, section, type SectionTemplate } from "./builders";

const Q = "What do people frequently ask you?";
const A =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur in ipsum massa. Mauris quis suscipit urna. Curabitur mollis, leo vitae lacinia cursus.";

/** One question + answer pair, anchored to the given columns. */
function qa(start: number, end: number): ReturnType<typeof container> {
  return container({ start, end }, [
    heading(4, Q, { start, end, size: "m" }),
    paragraph(A, { start, end, size: "m" }),
  ]);
}

export const FAQ_TEMPLATES: SectionTemplate[] = [
  // 1 — centred heading, single column of Q&As.
  section({ padding: "large" }, [
    heading(2, "Frequently asked questions", { start: 3, end: 10, align: "center", size: "l" }),
    paragraph(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur in ipsum massa.",
      { start: 3, end: 10, align: "center", size: "m" },
    ),
    qa(3, 10),
    qa(3, 10),
    qa(3, 10),
  ]),

  // 2 — two columns of Q&As.
  section({ padding: "large" }, [
    heading(2, "Frequently asked questions", { start: 1, end: 12, align: "center", size: "l" }),
    row([
      container({ start: 1, end: 6 }, [qa(1, 6), qa(1, 6)]),
      container({ start: 7, end: 12 }, [qa(7, 12), qa(7, 12)]),
    ]),
  ]),
];
