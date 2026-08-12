/**
 * Demo document for the PageBuilder story — a two-slide deck. Slide 1
 * mirrors the Pagy screenshot (a section with a container of two intro
 * paragraphs + a "Get in touch" button, a "Work" heading, and images);
 * slide 2 is a minimal section so render-gating (only the active slide
 * mounts) is observable.
 */

import type { Schema, Node as PmNode } from "prosemirror-model";

import { buildCategorization } from "./items/categorization";
import { buildFillBlanks } from "./items/fillBlanks";
import { buildMarkTokens } from "./items/markTokens";
import { buildMultipleChoice } from "./items/multipleChoice";
import { button, header, heading, hstack, paragraph, row, section, txt } from "./sections/builders";
import { FOOTER_TEMPLATES } from "./sections/footer";
import { HEADER_TEMPLATES } from "./sections/header";

// Gradient placeholder lives as a real asset, referenced by URL rather
// than an inline `data:` blob — keeps the doc readable and the Image
// block's Source field a tidy path instead of a 700-char URI. The
// `?no-inline` query stops Vite from inlining the (small) SVG back into
// a data URI, so we always get a served file path.
import workGradient from "./assets/work-gradient.svg?no-inline";
// Stylized Iceland silhouette backing the "Labeled image" map on chapter two.
import icelandMap from "./assets/iceland-map.svg?no-inline";
// Chapter-three animal cards (author-supplied Unsplash photos). `?url` forces a
// served file path for each .avif rather than inlining.
import puffinImg from "./assets/animals/puffin.avif?url";
import reindeerImg from "./assets/animals/reindeer.avif?url";
import humpbackImg from "./assets/animals/humpback.avif?url";
import minkeImg from "./assets/animals/minke.avif?url";
import horseImg from "./assets/animals/horse.avif?url";
import sheepImg from "./assets/animals/sheep.avif?url";

/** URL of the rainbow gradient placeholder used in the demo. */
export const GRADIENT_IMAGE_URI = workGradient;

/** A real photo hotlinked from Unsplash, so the demo shows the Image
 *  block with actual content (not just the gradient placeholder).
 *  Unsplash permits hotlinking `images.unsplash.com` URLs; the query
 *  params ask their CDN for a reasonably-sized, auto-formatted crop. */
export const WORK_PHOTO_URL =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80";

export function buildPersonalSiteDoc(schema: Schema): PmNode {
  const section = schema.nodes["section"]!;
  const paragraph = schema.nodes["paragraph"]!;
  const heading = schema.nodes["heading"]!;
  const buttonNode = schema.nodes["button"]!;
  const image = schema.nodes["image"]!;
  const imageCaption = schema.nodes["image_caption"]!;
  const vector = schema.nodes["vector"]!;
  const doc = schema.nodes["doc"]!;

  // Section spans the full grid (0–12 → CSS .start-left .end-12 →
  // grid-column 1 / 14). Children default to shuffle's 4/9 which puts
  // them in a centered column inside the section — same as Pagy's
  // default block alignment in image 8.
  const FULL = { shuffleStart: 0, shuffleEnd: 12 } as const;

  const p = (text: string) => paragraph.create(null, schema.text(text));
  const h = (level: number, text: string) =>
    heading.create({ level }, schema.text(text));

  // Container wrapping the two intro paragraphs. No spread passed, so it
  // takes shuffle's default 4/9 — the same start/stop the surrounding blocks
  // get (the centered content column), NOT the section's full-width 0–12.
  const container = schema.nodes["container"]!;
  const page = schema.nodes["page"]!;
  // The site-wide header / footer (built from the same templates the
  // Add-section modal offers). The doc is `header? page+ footer?`, so these
  // are the GLOBAL masters — rendered around every page. New pages inherit
  // them automatically; a page detaches or hides its own. They live ONCE here,
  // not per-page, so editing one changes every page that inherits it.
  const header = schema.nodeFromJSON(HEADER_TEMPLATES[0]);
  const footer = schema.nodeFromJSON(FOOTER_TEMPLATES[0]);
  // Two pages so render-gating is observable: only the active slide's content
  // mounts, but the global bars persist across both.
  return doc.create(null, [
    header,
    page.create({ id: "page-1", title: "Intro" }, [
      section.create(FULL, [
        container.create(null, [
          p(
            "I’m Ethan Brooks, a designer based in Melbourne. I make digital experiences that are simple, intuitive, and mildly entertaining to use. If it’s not easy, it’s probably my fault, and I’m probably already fixing it while pretending everything’s fine.",
          ),
          p(
            "Currently, I’m working on product design at Beacon. Before this, I designed at Lumen, Stitch, and a travel app that launched just before everyone stopped traveling.",
          ),
        ]),
        buttonNode.create({
          label: "Check answers",
          variant: "primary",
          action: "check",
          checkScope: "activity",
        }),
        h(3, "Work"),
        image.create(
          {
            src: GRADIENT_IMAGE_URI,
            alt: "Recent work",
            aspect: "16/9",
          },
          imageCaption.create(),
        ),
        // A real photo example (hotlinked) so the Image block isn't only
        // ever the gradient placeholder. Different aspect + shadow to show
        // the new presentation controls on real content.
        image.create(
          {
            src: WORK_PHOTO_URL,
            alt: "Mountain landscape",
            aspect: "3/2",
            radius: "large",
            frame: "shadow",
          },
          imageCaption.create(),
        ),
        // A vector block: inline SVG (a star) recolored to the theme's primary
        // slot via `tint` (drives currentColor). Sized to 25% of the column.
        vector.create({
          markup:
            '<svg viewBox="0 0 24 24" fill="#1f2937" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
          alt: "Star",
          width: 25,
          align: "center",
          tint: "primary",
        }),
        // A learning item alongside ordinary blocks: authored inline in the
        // editor (tab between prompt + options), answered in the site renderer.
        buildMultipleChoice(schema, "Which city is Ethan based in?", [
          { text: "Sydney" },
          { text: "Melbourne", correct: true },
          { text: "Brisbane" },
        ]),
        // A fill-blanks question: select text in the stem → "Mark as blank".
        // The first blank also accepts an alternative spelling/synonym.
        buildFillBlanks(schema, [
          "Ethan designs ",
          { blank: "digital", alternates: ["online"] },
          " experiences at ",
          { blank: "Beacon" },
          ".",
        ]),
        // A word-bank fill-blanks question with distractors (extra words that
        // fit no blank) mixed into the bank.
        buildFillBlanks(
          schema,
          [
            "He prototypes in ",
            { blank: "Figma" },
            " and ships with ",
            { blank: "React" },
            ".",
          ],
          { wordBank: true, distractors: ["Sketch", "Vue"] },
        ),
        // A mark-the-words question: the full sentence shows and the student
        // clicks the answer words. Select words in the editor → "Mark target" to
        // set the key (here, the verbs).
        buildMarkTokens(
          schema,
          "Click all the verbs.",
          "Ethan sketches the layout, builds the prototype, and ships the redesign.",
          ["sketches", "builds", "ships"],
        ),
        // A categorization question: drag the item cards into the right group
        // in the editor to set the answer key; students re-sort them (grid =
        // drag-and-drop, matrix = radio buttons).
        buildCategorization(
          schema,
          "Sort each tool into where it's used",
          [
            { name: "Design", items: ["Figma", "Sketch"] },
            { name: "Code", items: ["React", "TypeScript"] },
          ],
        ),
      ]),
    ]),
    page.create({ id: "page-2", title: "Work" }, [
      section.create(FULL, [
        h(1, "Second slide"),
        p(
          "This slide’s content only mounts while it’s the active slide — the deck stays one document, but the canvas renders one page at a time.",
        ),
      ]),
    ]),
    footer,
  ]);
}

/**
 * Layout-coverage deck — exercises the grid features the personal-site demo
 * doesn't: a multi-column `row` (two `container`s side by side) and a themed
 * `card`. Used to confirm the static `SiteRenderer` reproduces shuffle's grid
 * (column spans + side-by-side rows) identically to the editor.
 */
export function buildLayoutTestDoc(schema: Schema): PmNode {
  const n = schema.nodes;
  const t = (s: string) => schema.text(s);
  const p = (s: string) => n["paragraph"]!.create(null, t(s));
  const h = (level: number, s: string) =>
    n["heading"]!.create({ level }, t(s));
  const FULL = { shuffleStart: 0, shuffleEnd: 12 } as const;

  return n["doc"]!.create(null, [
    n["page"]!.create({ id: "layout-1", title: "Layout" }, [
      n["section"]!.create(FULL, [
        h(2, "Two-column row"),
        n["row"]!.create(null, [
          n["container"]!.create({ shuffleStart: 0, shuffleEnd: 6 }, [
            h(3, "Left"),
            p("Left column — should occupy the left half of the grid, beside the right column (not stacked)."),
          ]),
          n["container"]!.create({ shuffleStart: 6, shuffleEnd: 12 }, [
            h(3, "Right"),
            p("Right column — sits to the right of the left column on the same row."),
          ]),
        ]),
        h(2, "Card"),
        n["card"]!.create({ padding: "l", radius: "large", theme: "primary" }, [
          h(3, "Card title"),
          p("Card body text inside a themed card with padding and a large radius."),
          n["button"]!.create({ label: "Card button", variant: "primary", href: "#" }),
        ]),
      ]),
    ]),
  ]);
}

/**
 * "Exploring Iceland" — a learning-site cover modeled on the Claude design deck
 * of the same name. Slide 1 is the field-guide hero, built entirely through
 * section settings: Background = image, Colors = `inverted` (flips text light
 * AND tints the `--color-background` scrim dark, since the scrim reads that
 * var), Overlay = strong, Min height = large, Align content = bottom. The giant
 * "Iceland" wordmark uses the new heading `xxl` size (fluid `clamp`, tight
 * leading). Palette + fonts live in ICELAND_THEME (sites.ts): warm paper bg,
 * warm-ink neutral, one cool slate-blue accent; Playfair Display headings over
 * a Source Serif body (Spectral, the deck's body face, isn't on the font CDN).
 * The deck's mono eyebrow/labels render in the body serif — the theme has no
 * third (mono) font slot. The cover photo is seeded (the existing demo mountain
 * shot); swap it via Section settings → Background → Image.
 */
export function buildIcelandSiteDoc(schema: Schema): PmNode {
  const doc = schema.nodes["doc"]!;
  const page = schema.nodes["page"]!;

  // Cover authored as raw JSON so the section can carry the image / overlay /
  // theme attrs the `section()` template helper doesn't expose; its children
  // use the shared section builders. Omitted attrs (padding, video) take their
  // schema defaults via `nodeFromJSON`.
  const cover = schema.nodeFromJSON({
    type: "section",
    attrs: {
      theme: "inverted",
      minHeight: "large",
      contentAlign: "bottom",
      background: "image",
      image: WORK_PHOTO_URL,
      overlay: "strong",
      htmlId: "intro",
    },
    content: [
      paragraph("AN INTERACTIVE FIELD GUIDE", { size: "xs", start: 1, end: 8 }),
      heading(1, "Iceland", { size: "xxl", start: 1, end: 12 }),
      heading(
        3,
        [txt("it most definitely exists… probably", [{ type: "em" }])],
        { size: "l", start: 1, end: 10 },
      ),
      hstack({ start: 1, end: 9, align: "center", justify: "start" }, [
        button("Begin the journey  →", {
          variant: "primary",
          color: "primary",
          size: "l",
          action: "nextPage",
        }),
        paragraph(
          "A short tour through the land, the wildlife, the energy and the people of a young island still being built.",
          { size: "m" },
        ),
      ]),
    ],
  });

  // Chapter two — "geography & ecosystem". A light section (default theme):
  // chapter eyebrow + title + subtitle, then the interactive map (the new
  // "Labeled image" content item), then the closing description. The map is
  // authored as inline JSON so it can carry its full-width shuffle span; its
  // empty stem renders nothing (the completer guards an empty intro).
  const geographyMap = {
    type: "labeled_image",
    attrs: {
      itemId: "iceland-geography",
      src: icelandMap,
      alt: "Stylized map of Iceland with regional markers",
      eyebrow: "Tap a marker",
      shuffleStart: 0,
      shuffleEnd: 12,
      markers: [
        { id: "rvk", x: 0.3, y: 0.72, label: "Reykjavík", body: "Iceland's capital and home to two-thirds of the population — a compact, colorful city on the southwest coast." },
        { id: "sjk", x: 0.16, y: 0.5, label: "Snæfellsjökull", body: "A glacier-capped stratovolcano on the western peninsula, the gateway in Journey to the Center of the Earth." },
        { id: "thv", x: 0.37, y: 0.64, label: "Þingvellir", body: "A rift valley where the Atlantic plates pull apart — and where Iceland's parliament was founded in 930 AD." },
        { id: "aks", x: 0.52, y: 0.34, label: "Akureyri", body: "The 'capital of the north', a fjord-side town and gateway to whale-watching and the Diamond Circle." },
        { id: "vtj", x: 0.63, y: 0.56, label: "Vatnajökull", body: "Europe's largest ice cap by volume, hiding several active volcanoes beneath the ice." },
        { id: "hfn", x: 0.74, y: 0.69, label: "Höfn", body: "A fishing harbor in the southeast, famed for langoustine and views of the Vatnajökull glacier tongues." },
      ],
    },
    content: [{ type: "labeled_image_prompt", content: [{ type: "paragraph" }] }],
  };

  const geography = schema.nodeFromJSON(
    section({}, [
      paragraph("Chapter Two · The Lay of the Land", { size: "xs", start: 1, end: 9 }),
      heading(1, "Exploring Iceland", { size: "xl", start: 1, end: 11 }),
      heading(3, [txt("geography & ecosystem", [{ type: "em" }])], { size: "l", start: 1, end: 10 }),
      geographyMap,
      paragraph(
        "A Nordic island nation defined by its dramatic landscape of volcanoes, geysers and lava fields — most of its people gathered in the southwest, the vast interior left to ice and stone.",
        { size: "m", start: 1, end: 9 },
      ),
    ]),
  );

  // Chapter three — "Wildlife & Ecosystem". A DARK section (theme inverted, so
  // text is cream and the cards pop), carrying a GRADED Multiple Choice in the
  // new image-grid layout: tap the animals that live wild in Iceland, then
  // Check. Built with buildMultipleChoice (multiple + grid) and widened to the
  // full content band. Card photos are author-set per option (left empty here —
  // each card shows its name on a tinted card until an image is added).
  const wildlifeMc = buildMultipleChoice(
    schema,
    "Tap every animal you'd actually meet in the wild — then check. Not everything that feels Icelandic roams free.",
    [
      // Wild (correct):
      { text: "Atlantic Puffin", correct: true, image: puffinImg },
      { text: "Reindeer", correct: true, image: reindeerImg },
      { text: "Humpback Whale", correct: true, image: humpbackImg },
      { text: "Minke Whale", correct: true, image: minkeImg },
      // Iconic but domestic (distractors):
      { text: "Icelandic Horse", image: horseImg },
      { text: "Sheep", image: sheepImg },
    ],
    { multiple: true, layout: "grid" },
  );
  const wildlifeMcWide = wildlifeMc.type.create(
    { ...wildlifeMc.attrs, shuffleStart: 1, shuffleEnd: 12 },
    wildlifeMc.content,
  );
  // The deck's "Check my answer" — grading is button-driven in this builder
  // (the MC no longer renders its own Check), so a `check`-action button scoped
  // to the activity grades the grid + reveals correct/incorrect on the cards.
  const checkButton = schema.nodes["button"]!.create({
    label: "Check my answer",
    variant: "primary",
    color: "primary",
    size: "m",
    action: "check",
    checkScope: "activity",
    shuffleStart: 1,
    shuffleEnd: 4,
  });
  const wildlife = schema.nodes["section"]!.create(
    { theme: "inverted", htmlId: "wildlife" },
    [
      schema.nodeFromJSON(
        paragraph("Chapter Three · Wildlife", { size: "xs", start: 1, end: 9 }),
      ),
      schema.nodeFromJSON(
        heading(1, "Wildlife & Ecosystem", { size: "xl", start: 1, end: 11 }),
      ),
      wildlifeMcWide,
      checkButton,
    ],
  );

  // Global masters: a wordmark header + the slim Back/Next deck pager (with its
  // dynamic page counter). The cover hides BOTH — it's the chrome-free title
  // page and its own CTA steps the deck — so they appear from chapter two on.
  const headerNode = schema.nodeFromJSON(
    header({ background: "" }, [
      row([heading(4, "ICELAND · A FIELD GUIDE", { start: 1, end: 9, size: "s" })]),
    ]),
  );
  const footerNode = schema.nodeFromJSON(FOOTER_TEMPLATES[3]!);

  return doc.create(null, [
    headerNode,
    page.create({ id: "page-1", title: "Cover", hideHeader: true, hideFooter: true }, [cover]),
    page.create({ id: "page-2", title: "Geography" }, [geography]),
    page.create({ id: "page-3", title: "Wildlife" }, [wildlife]),
    footerNode,
  ]);
}
