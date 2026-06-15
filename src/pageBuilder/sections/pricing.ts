/** PRICING_TEMPLATES — ported from pagy.co `templates/sx.ts`. */

import type { JsonNode } from "../runtime/shuffleLayout";
import { bold, button, card, heading, paragraph, row, section, txt, type SectionTemplate } from "./builders";

const SUB = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do.";

/** A pricing tier card: name, price, three features, CTA. */
function tier(start: number, end: number, name: string, price: string): ReturnType<typeof card> {
  return card({ start, end, padding: "l" }, [
    heading(3, name, { start, end, size: "m" }),
    paragraph([bold(price), txt("/month")], { start, end, size: "l" }),
    paragraph("Feature one", { start, end, size: "s" }),
    paragraph("Feature two", { start, end, size: "s" }),
    paragraph("Feature three", { start, end, size: "s" }),
    button("Get started", { start, end, width: "fill", variant: "primary", color: "primary", size: "m" }),
  ]);
}

function intro(): JsonNode[] {
  return [
    heading(2, "Pricing", { start: 4, end: 9, align: "center", size: "l" }),
    paragraph(SUB, { start: 4, end: 9, align: "center", size: "m" }),
  ];
}

export const PRICING_TEMPLATES: SectionTemplate[] = [
  // 1 — single tier.
  section({ padding: "large" }, [...intro(), tier(5, 8, "Basic", "$19")]),

  // 2 — two tiers.
  section({ padding: "large" }, [...intro(), row([tier(3, 6, "Basic", "$19"), tier(7, 10, "Pro", "$49")])]),

  // 3 — three tiers.
  section({ padding: "large" }, [
    ...intro(),
    row([tier(1, 4, "Basic", "$19"), tier(5, 8, "Pro", "$49"), tier(9, 12, "Business", "$99")]),
  ]),
];
