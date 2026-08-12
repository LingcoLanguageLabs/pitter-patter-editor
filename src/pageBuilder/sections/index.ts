/**
 * Section template library for the "Add a section" modal.
 *
 * Mirrors pagy.co's category list (Global + 9 template groups). "Global"
 * is where a site's own reusable/shared sections would live; this build
 * has no shared-blocks backend yet, so it stays empty (the modal shows
 * pagy's "Your shared sections will appear here." state). The other nine
 * groups are hard-coded templates, ported from `pagy.co/src/editor/
 * templates/*` into this schema's document JSON.
 */

import type { JsonNode } from "../runtime/shuffleLayout";
import type { SectionTemplate } from "./builders";

import { CTA_TEMPLATES } from "./cta";
import { FAQ_TEMPLATES } from "./faq";
import { FEATURES_TEMPLATES } from "./features";
import { FOOTER_TEMPLATES } from "./footer";
import { HEADER_TEMPLATES } from "./header";
import { HERO_TEMPLATES } from "./hero";
import { LOGOS_TEMPLATES } from "./logos";
import { PRICING_TEMPLATES } from "./pricing";
import { RESULTS_TEMPLATES } from "./results";
import { TESTIMONIALS_TEMPLATES } from "./testimonials";

export type { SectionTemplate } from "./builders";

export interface SectionCategory {
  name: string;
  templates: SectionTemplate[];
  /** True for the user's own shared sections (no hard-coded templates). */
  shared?: boolean;
}

export const SECTION_CATEGORIES: SectionCategory[] = [
  { name: "Global", templates: [], shared: true },
  { name: "Header", templates: HEADER_TEMPLATES },
  { name: "Hero", templates: HERO_TEMPLATES },
  { name: "Features", templates: FEATURES_TEMPLATES },
  { name: "Logos", templates: LOGOS_TEMPLATES },
  { name: "Testimonials", templates: TESTIMONIALS_TEMPLATES },
  { name: "Pricing", templates: PRICING_TEMPLATES },
  { name: "FAQ", templates: FAQ_TEMPLATES },
  { name: "Call to action", templates: CTA_TEMPLATES },
  { name: "Results", templates: RESULTS_TEMPLATES },
  { name: "Footer", templates: FOOTER_TEMPLATES },
];

/** The empty section inserted by "Add a blank section" — a centred,
 *  roomy section with one empty paragraph ready to type into. */
export const BLANK_SECTION: JsonNode = {
  type: "section",
  attrs: {
    padding: "large",
    minHeight: "medium",
    contentAlign: "center",
    background: "solid",
  },
  content: [
    {
      type: "paragraph",
      attrs: { align: "center", size: "m", shuffleStart: 4, shuffleEnd: 9 },
      content: [],
    },
  ],
};

/** The lone section a brand-new site starts with — top-aligned with a
 *  full-width, left-aligned paragraph ready to type into. Differs from
 *  {@link BLANK_SECTION} (which "Add a blank section" centres) on purpose. */
export const BLANK_SITE_SECTION: JsonNode = {
  type: "section",
  attrs: {
    padding: "large",
    minHeight: "medium",
    contentAlign: "top",
    background: "solid",
  },
  content: [
    {
      type: "paragraph",
      attrs: { align: "left", size: "m", shuffleStart: 1, shuffleEnd: 12 },
      content: [],
    },
  ],
};
