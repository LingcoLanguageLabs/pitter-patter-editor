/**
 * Page-builder schema.
 *
 * The schema is built in a small pipeline (`buildPageBuilderSchema`)
 * that runs five named steps:
 *
 *   1. addPageBuilderNodes  — adds `page`, `section`, `button`, `card`,
 *                              `video`, `audio`, swaps `image` to a
 *                              block-level node.
 *   2. requirePageRoot      — tightens `doc.content` to `page+` so the
 *                              root holds slides (each a `section+`
 *                              page), not bare sections/paragraphs.
 *   3. addShuffleNodes      — shuffle's own augmentation: adds
 *                              `container` + `row` nodes and
 *                              `shuffleStart/End` attrs.
 *   4. constrainBlocksToSection — stamps every block-group node with
 *                              `pitterPatter.shuffle.containedBy =
 *                              "section"` so shuffle aborts drops
 *                              that would land outside the dragged
 *                              block's section.
 *
 * Each step takes a `Schema` and returns a new `Schema`. The order
 * matters: containment runs AFTER shuffle so the `container`/`row`
 * nodes shuffle adds are stamped too — otherwise dragging one isn't
 * section-constrained and its drop escapes into a new section.
 */

import {
  Schema,
  type MarkSpec,
  type NodeSpec,
  type Node as PmNode,
} from "prosemirror-model";
import { addShuffleNodes } from "@pitter-patter/shuffle";
import { tableNodes } from "prosemirror-tables";

import {
  accordionHeaderSpec,
  accordionItemSpec,
  accordionPanelSpec,
  accordionSpec,
} from "./blocks/accordion";
import {
  tabLabelSpec,
  tabPanelSpec,
  tabSpec,
  tabsSpec,
} from "./blocks/tabs";
import { EMBED_ALLOW, toEmbedUrl } from "./embed";
import { ITEM_DEFINITIONS } from "./items/registry";
import {
  ITEM_EXPLANATION_NODE,
  itemExplanationSpec,
} from "./items/shared/explanation";
import {
  FOOTER_PADDING_DEFAULT,
  footerClass,
  HEADER_PADDING_DEFAULT,
  headerClass,
  SECTION_PADDING_DEFAULT,
  sectionPaddingClass,
  sectionPaddingFromClassName,
  sectionPaddingPx,
} from "./spacing";
import type { TransitionSpeed, TransitionType } from "./transitions";

// ────────────────────────────────────────────────────────────────
// Shared attr value types — referenced by node specs + by the
// BlockSettings forms so the schema and the UI can't drift.
// ────────────────────────────────────────────────────────────────

export const ALIGN_VALUES = ["left", "center", "right"] as const;
export const SIZE_VALUES = ["xs", "s", "m", "l", "xl"] as const;
export const ALIGN_CONTENT_VALUES = [
  "top",
  "middle",
  "bottom",
  "stretch",
] as const;
export type Align = (typeof ALIGN_VALUES)[number];
export type Size = (typeof SIZE_VALUES)[number];
export type AlignContent = (typeof ALIGN_CONTENT_VALUES)[number];

// Stack (the container as a flex primitive). `axis` flips the container's
// main axis; `stackAlign`/`stackJustify` are the cross/main flex alignment;
// `wrap` toggles flex-wrap. Named `stack*` (not `align`/`justify`) so they
// don't collide with the generic text `align` → `pp-align` class mapping.
export const STACK_AXIS_VALUES = ["vertical", "horizontal"] as const;
export const STACK_ALIGN_VALUES = ["stretch", "start", "center", "end"] as const;
export const STACK_JUSTIFY_VALUES = ["start", "center", "end", "between"] as const;
export type StackAxis = (typeof STACK_AXIS_VALUES)[number];
export type StackAlign = (typeof STACK_ALIGN_VALUES)[number];
export type StackJustify = (typeof STACK_JUSTIFY_VALUES)[number];

/** Default paragraph size — stamped when converting a heading back to
 *  a paragraph (pagy: `defaultSizeForBlockType("paragraph")`). */
export const PARAGRAPH_DEFAULT_SIZE: Size = "m";

/** Inline text colors — theme *slots*, not raw colors, exactly pagy's
 *  `color` leaf values. The mark renders `pp-text -muted` etc. and the
 *  canvas CSS maps each slot to its theme variable, so recoloring the
 *  theme recolors marked text for free. */
export const TEXT_COLOR_VALUES = [
  "muted",
  "light",
  "primary",
  "secondary",
  "tertiary",
] as const;
export type TextColor = (typeof TEXT_COLOR_VALUES)[number];

/** Link style variants — pagy's `style` on link elements: "" is the
 *  default underlined treatment, "minimal" drops the underline. */
export const LINK_VARIANTS = ["", "minimal"] as const;
export type LinkVariant = (typeof LINK_VARIANTS)[number];

/** Inline language tagging — pick a language for a run of text and the
 *  `language` mark stamps `lang="<code>"` (+ `data-lang`) on the rendered
 *  span. The `lang` attribute is the real payload: screen readers switch
 *  voice/pronunciation, the browser hyphenates + spellchecks in that
 *  language, and CSS can target `:lang(es)`. Built for mixed-language
 *  content (e.g. a Spanish phrase inside an English lesson). Curated set of
 *  common languages; extend freely — each is just a `{ code, label }` pair
 *  where `code` is the BCP-47 tag. */
export const LANGUAGE_OPTIONS = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "hi", label: "Hindi" },
  { code: "la", label: "Latin" },
] as const;
export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

/** Header background treatment — pagy's `background`: "" = Solid (paints the
 *  theme background), "blur" = translucent + backdrop-blur, "transparent" =
 *  no fill (content shows through to whatever scrolls beneath a fixed bar). */
export const HEADER_BACKGROUND_VALUES = ["", "blur", "transparent"] as const;
export type HeaderBackground = (typeof HEADER_BACKGROUND_VALUES)[number];

/** Theme variant slots shared by section / card / header / footer "Colors":
 *  "" (page default) | inverted | primary | secondary | tertiary. Maps to the
 *  `.theme.-X` variable scopes `themeToCss` emits. */
export const THEME_VARIANT_VALUES = ["", "inverted", "primary", "secondary", "tertiary"] as const;
export type ThemeVariant = (typeof THEME_VARIANT_VALUES)[number];

/** Button actions — what a button does on click. Extensible (there'll be more):
 *  "url" opens a link; "page" goes to a specific deck page (`pageId`);
 *  "prevPage" / "nextPage" step the deck; "section" scrolls to a section by its
 *  `htmlId` (`sectionId`), navigating to its page first if needed. */
export const BUTTON_ACTION_VALUES = [
  "url",
  "page",
  "prevPage",
  "nextPage",
  "section",
  "check",
] as const;
export type ButtonAction = (typeof BUTTON_ACTION_VALUES)[number];

/**
 * Default size for each heading level — pagy's
 * `defaultSizeForBlockType` (heading-1 → large … heading-4 →
 * extra-small) translated onto our t-shirt scale. Choosing a heading
 * level chooses this size; the Size control can then override it.
 *
 * A heading whose `size` attr is null renders at this default via the
 * per-level fallback rules in page-builder.css — keep the two in sync.
 */
export function defaultHeadingSize(level: number): Size {
  if (level <= 1) return "xl"; // 64px — pagy h1 (4rem)
  if (level === 2) return "l"; // 48px — pagy h2 (2.625rem)
  if (level === 3) return "s"; // 28px — pagy h3 (1.75rem)
  return "xs"; // 22px — pagy h4 (1.125rem)
}

// ────────────────────────────────────────────────────────────────
// Node specs
// ────────────────────────────────────────────────────────────────

/**
 * Section — the top-level white-card wrapper. Contains other blocks.
 *
 * Section is deliberately NOT in the "block" group. That keeps
 * shuffle out of it: no shuffle attrs, no drag/resize handles. The
 * "+ Add section" affordances are how users add/reorder sections
 * instead. `requireSectionRoot` then makes the doc require at least
 * one section, so blocks always live inside one.
 */
const sectionSpec: NodeSpec = {
  content: "block+",
  defining: true,
  isolating: true,
  attrs: {
    /** Symmetric vertical padding (top = bottom), in PX. Dragged via the
     *  hatched bands (`SectionSpacingBands`); serialized as a Tailwind-style
     *  `py-{unit}` class (4px/unit — 80px ↔ `py-20`), NOT a data attribute. */
    padding: { default: SECTION_PADDING_DEFAULT as number },
    /** Theme variant (pagy's section "Colors"): "" / null = page
     *  default, else inverted | primary | secondary | tertiary. Maps
     *  to the `.theme.-X` variable scopes `themeToCss` emits. */
    theme: { default: null as string | null },
    /** Minimum height: none | medium (66dvh) | large (100dvh). */
    minHeight: { default: "none" as "none" | "medium" | "large" },
    /** Vertical content alignment — only meaningful when minHeight
     *  leaves spare room: top | center | bottom. */
    contentAlign: { default: "top" as "top" | "center" | "bottom" },
    /** Background mode. Solid = just the theme color; image/video add
     *  a media layer (rendered by `SectionBackgroundWidget`). */
    background: { default: "solid" as "solid" | "image" | "video" },
    /** Background image URL (used when background = "image"). */
    image: { default: "" },
    /** Background video URL (used when background = "video"). */
    video: { default: "" },
    /** Scrim over background media: "" | light | medium | strong. */
    overlay: { default: "" as "" | "light" | "medium" | "strong" },
    /** Unique HTML id rendered onto the <section> (anchor links). */
    htmlId: { default: "" },
  },
  parseDOM: [
    {
      tag: 'section[data-node-type="section"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        return {
          // Padding lives in the `py-{unit}` class.
          padding: sectionPaddingFromClassName(el.className) ?? SECTION_PADDING_DEFAULT,
          theme: el.getAttribute("data-theme"),
          minHeight: el.getAttribute("data-min-height") || "none",
          contentAlign: el.getAttribute("data-content-align") || "top",
          background: el.getAttribute("data-background") || "solid",
          image: el.getAttribute("data-image") || "",
          video: el.getAttribute("data-video") || "",
          overlay: el.getAttribute("data-overlay") || "",
          htmlId: el.id || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const theme = a["theme"] as string | null;
    const attrs: Record<string, string> = {
      "data-node-type": "section",
      // Padding is the `py-{unit}` class (4px/unit) — the source of truth,
      // no data-padding. `theme -X` puts the section under the `.theme.-X`
      // variable scope from `themeToCss`, exactly like pagy's section renderer.
      class: `pp-section ${sectionPaddingClass(sectionPaddingPx(a))}${theme ? ` theme -${theme}` : ""}`,
    };
    if (theme) attrs["data-theme"] = theme;
    if (a["minHeight"] && a["minHeight"] !== "none")
      attrs["data-min-height"] = a["minHeight"] as string;
    if (a["contentAlign"] && a["contentAlign"] !== "top")
      attrs["data-content-align"] = a["contentAlign"] as string;
    if (a["background"] && a["background"] !== "solid")
      attrs["data-background"] = a["background"] as string;
    if (a["image"]) attrs["data-image"] = a["image"] as string;
    if (a["video"]) attrs["data-video"] = a["video"] as string;
    if (a["overlay"]) attrs["data-overlay"] = a["overlay"] as string;
    if (a["htmlId"]) attrs["id"] = a["htmlId"] as string;
    return ["section", attrs, 0];
  },
};

/**
 * Page — the top-level "slide" wrapper. The doc is `page+` and each page
 * is `section+`, so the whole deck lives in ONE ProseMirror document: one
 * save / undo / collab stream, and slides can't travel or persist
 * separately. `isolating` keeps content from crossing page boundaries.
 *
 * Only the *active* page's content is mounted in the canvas (see
 * `PageNodeView` + `activePagePlugin`) — a 40-slide deck doesn't render 40
 * slides' worth of (often interactive) DOM at once; inactive slides mount
 * no descendants at all.
 */
const pageSpec: NodeSpec = {
  // A page wraps an optional top `header`, its `section+` body, and an optional
  // `footer`. At page level these bars are PER-PAGE OVERRIDES (a "detached"
  // copy); the site-wide masters live one level up as the doc's own
  // `header? page+ footer?` children. A page with no header child inherits the
  // global header — unless `hideHeader` is set (a title/cover page). Same for
  // the footer. The resolver (`headerFooter.ts`) turns these three states
  // (override node present / hidden flag / neither) into what actually renders.
  content: "header? section+ footer?",
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id — drives active-page tracking and (later) slide links.
     *  Assigned on creation (demo doc / "add slide"); never auto-derived. */
    id: { default: "" },
    /** Shown in the slide rail. */
    title: { default: "Untitled" },
    /** Suppress the GLOBAL header on this page (the title/cover-page escape
     *  hatch). Ignored when the page carries its own header override. */
    hideHeader: { default: false },
    /** Suppress the GLOBAL footer on this page. */
    hideFooter: { default: false },
    /** Entry transition (PowerPoint/Slides "Transitions"). Plays when the deck
     *  navigates TO this page while viewing the site (`<SiteRenderer>`); the
     *  editor canvas always cuts instantly. See `transitions.ts`. */
    transition: { default: "none" as TransitionType },
    /** The transition's "Effect Option" (e.g. "from-left", "circle-out"). */
    transitionVariant: { default: "" },
    /** How fast that transition runs: fast | medium | slow. */
    transitionSpeed: { default: "medium" as TransitionSpeed },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="page"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        return {
          id: el.getAttribute("data-page-id") || "",
          title: el.getAttribute("data-title") || "Untitled",
          hideHeader: el.getAttribute("data-hide-header") === "true",
          hideFooter: el.getAttribute("data-hide-footer") === "true",
          transition: el.getAttribute("data-transition") || "none",
          transitionVariant: el.getAttribute("data-transition-variant") || "",
          transitionSpeed: el.getAttribute("data-transition-speed") || "medium",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const transition = (a["transition"] as string) || "none";
    const variant = (a["transitionVariant"] as string) || "";
    const speed = (a["transitionSpeed"] as string) || "medium";
    const attrs: Record<string, string> = {
      "data-node-type": "page",
      "data-page-id": (a["id"] as string) || "",
      "data-title": (a["title"] as string) || "",
      class: "pb-page",
    };
    // Per-page bar suppression — only stamped when set, like the transitions.
    if (a["hideHeader"]) attrs["data-hide-header"] = "true";
    if (a["hideFooter"]) attrs["data-hide-footer"] = "true";
    // Only stamp the transition attrs when they're non-default, mirroring how
    // section/card omit default attrs — keeps the serialized DOM clean.
    if (transition !== "none") attrs["data-transition"] = transition;
    if (transition !== "none" && variant) attrs["data-transition-variant"] = variant;
    if (transition !== "none" && speed !== "medium")
      attrs["data-transition-speed"] = speed;
    return ["div", attrs, 0];
  },
};

/** Button — atom CTA. All visual properties (variant, color, size,
 *  etc.) live as attrs so the BlockSettings popover can edit them. */
const buttonSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    label: { default: "Button" },
    /** Visual style: filled / outlined / ghost. */
    variant: { default: "primary" as "primary" | "secondary" | "ghost" },
    /** Theme palette slot used for the fill: neutral / primary /
     *  secondary / tertiary. CSS maps these to `var(--color-*)`. */
    color: {
      default: "primary" as "neutral" | "primary" | "secondary" | "tertiary",
    },
    /** T-shirt size scale (matches paragraph/heading). */
    size: { default: "s" as Size },
    /** Whether the button shrinks to its label (`fit`) or stretches
     *  to its column (`fill`). */
    width: { default: "fit" as "fit" | "fill" },
    /** Alignment within its column (when width is `fit`). */
    align: { default: "left" as Align },
    /** What the button does on click — see `ButtonAction`. Supersedes the old
     *  `linkType`; parseDOM migrates the `data-link-type` attribute. */
    action: { default: "url" as ButtonAction },
    /** Target page id when action is "page". */
    pageId: { default: "" },
    /** Target section's `htmlId` when action is "section". */
    sectionId: { default: "" },
    href: { default: "#" },
    /** Adds `target="_blank"` when true (URL action only). */
    openInNewTab: { default: false },
    /** "check" action: the grading scope (prompt | section | page | activity)
     *  and its target — a specific prompt/section/page id, or "current" (the
     *  in-view section / active page). Unused for other actions. */
    checkScope: { default: "" },
    checkTargetId: { default: "" },
    /** Behavior when the action dead-ends (a prevPage/nextPage button at a deck
     *  edge): "dim" greys it out (default), "hide" removes it from the page.
     *  Only consulted by the runtime for prev/next — other actions never
     *  disable. */
    whenDisabled: { default: "dim" as "dim" | "hide" },
  },
  parseDOM: [
    {
      tag: 'a[data-node-type="button"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        const cls = el.className || "";
        const after = (prefix: string) =>
          cls.match(new RegExp(`(?:^|\\s)${prefix}([^\\s]+)`))?.[1];
        return {
          label: el.textContent || "Button",
          variant: after("pp-button--") || "primary",
          color: after("pp-color-") || "primary",
          size: after("pp-size-") || "s",
          width: after("pp-width-") || "fit",
          align: after("pp-align-") || "left",
          // Migrate the old `data-link-type` ("page"/"url") to the action attr.
          action:
            el.getAttribute("data-action") ||
            (el.getAttribute("data-link-type") === "page" ? "page" : "url"),
          pageId: el.getAttribute("data-page-id") || "",
          sectionId: el.getAttribute("data-section-id") || "",
          href: el.getAttribute("href") || "#",
          openInNewTab: el.getAttribute("target") === "_blank",
          checkScope: el.getAttribute("data-check-scope") || "",
          checkTargetId: el.getAttribute("data-check-target") || "",
          whenDisabled:
            el.getAttribute("data-when-disabled") === "hide" ? "hide" : "dim",
        };
      },
    },
  ],
  toDOM(node) {
    const variant = (node.attrs["variant"] as string) || "primary";
    const openInNewTab = !!node.attrs["openInNewTab"];
    const action = (node.attrs["action"] as string) || "url";
    const isUrl = action === "url";
    const pageId = (node.attrs["pageId"] as string) || "";
    const sectionId = (node.attrs["sectionId"] as string) || "";
    const checkScope = (node.attrs["checkScope"] as string) || "";
    const checkTargetId = (node.attrs["checkTargetId"] as string) || "";
    // Navigation actions carry their target id for the renderer to resolve;
    // there's no live site routing, so their href stays "#". Only the BEM
    // variant class is emitted here; the rest of the visual classes
    // (pp-color-*, pp-size-*, pp-width-*, pp-align-*) are added by
    // `attrClassesPlugin` at render time, so new attrs don't need toDOM updates.
    return [
      "a",
      {
        "data-node-type": "button",
        href: isUrl ? (node.attrs["href"] as string) || "#" : "#",
        ...(action !== "url" ? { "data-action": action } : {}),
        ...(action === "page" ? { "data-page-id": pageId } : {}),
        ...(action === "section" ? { "data-section-id": sectionId } : {}),
        ...(action === "check"
          ? { "data-check-scope": checkScope, "data-check-target": checkTargetId }
          : {}),
        ...(node.attrs["whenDisabled"] === "hide"
          ? { "data-when-disabled": "hide" }
          : {}),
        ...(openInNewTab && isUrl
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
        class: `pp-button pp-button--${variant}`,
        contenteditable: "false",
      },
      node.attrs["label"] as string,
    ];
  },
};

/** Block-level image. Replaces basic schema's inline image. */
const imageSpec: NodeSpec = {
  group: "block",
  // The image carries a rich caption as a child `image_caption` node (a real
  // figure/figcaption), so the caption can be styled + hold marks (italic
  // credit, a link) and is edited inline. The `<img>` itself is rendered from
  // the `src` attr by the NodeView / runtime (not doc content). Required — every
  // image has exactly one caption node (empty renders nothing), so there's one
  // way to model a caption; factories build it in.
  content: "image_caption",
  selectable: true,
  draggable: false,
  attrs: {
    src: { default: "" },
    alt: { default: "" },
    /** "original" | "16/9" | "3/2" | "4/3" — ignored when `shape` is set. */
    aspect: { default: "16/9" as string },
    /** "" (rectangle) | "square" | "circle". Square/circle force 1:1. */
    shape: { default: "" as "" | "square" | "circle" },
    /** Corner radius: "none" | "medium" | "large". */
    radius: { default: "medium" as "none" | "medium" | "large" },
    /** "" (plain) | "inset" | "shadow". */
    frame: { default: "" as "" | "inset" | "shadow" },
    /** Internal image width as a % of the block footprint (the shuffle grid
     *  span). `null` = full (100%). Set by the inset image-resize handles
     *  (rendered inside the figure by `ImageNodeView`); cleared back to `null` the moment a drag reaches
     *  full, exactly as pagy clears its px `width` at `>= maxWidth`
     *  (image-resize.tsx). We store a % rather than pagy's px because our
     *  footprint is an independent shuffle grid span — a % stays correct across
     *  footprint + breakpoint changes, where a fixed px would orphan. */
    width: { default: null as number | null },
    /** Horizontal placement within the footprint when `width` < 100 — pagy's
     *  conditional `align`. Maps to `justify-self` on the figure (the grid
     *  item) via `.pb-image.pp-align-*`. No visible effect at full width. */
    align: { default: "center" as "left" | "center" | "right" },
    /** Click action — the SAME vocabulary as buttons / text links (see
     *  `ButtonAction`), plus "none" (the default: the image isn't a link). When
     *  set, the runtime wraps the image in an `<a>` resolved by `useNavAction`,
     *  so an image can open a URL or jump to a page / section. */
    action: { default: "none" as "none" | ButtonAction },
    /** Target page id when action is "page". */
    pageId: { default: "" },
    /** Target section's `htmlId` when action is "section". */
    sectionId: { default: "" },
    /** Link URL when action is "url". */
    href: { default: "" },
    /** Adds `target="_blank"` when true (URL action only). */
    openInNewTab: { default: false },
    /** Layout mode: "flow" (default — placed in the shuffle grid) or "pinned"
     *  (lifted out of the grid and absolutely positioned within its section, for
     *  decorative overlap / free placement). */
    position: { default: "flow" as "flow" | "pinned" },
    /** Pinned only — position + size as a % of the SECTION box. `pinX`/`pinY` are
     *  the top-left corner (may be <0 or >100 to bleed past an edge); `pinW` is
     *  the width. */
    pinX: { default: 50 },
    pinY: { default: 50 },
    pinW: { default: 40 },
    /** Editor-only, transient: set true on a placeholder dropped from the
     *  "Unsplash" catalog block, so the NodeView knows to auto-open the photo
     *  picker (and show the empty-state) for THIS image, then clears it once the
     *  picker is opened. Deliberately has NO toDOM/parseDOM — like the layers
     *  `name` attr, it's authoring state that must never reach the published
     *  site or a copy/paste round-trip. */
    unsplashPending: { default: false },
  },
  parseDOM: [
    {
      tag: 'figure[data-node-type="image"] img',
      getAttrs(node) {
        const el = node as HTMLImageElement;
        const fig = el.closest("figure");
        const w = fig?.getAttribute("data-width");
        const num = (name: string, fallback: number) => {
          const v = fig?.getAttribute(name);
          return v == null ? fallback : Number(v);
        };
        return {
          src: el.getAttribute("src") || "",
          alt: el.getAttribute("alt") || "",
          aspect: fig?.getAttribute("data-aspect") || "16/9",
          shape: fig?.getAttribute("data-shape") || "",
          radius: fig?.getAttribute("data-radius") || "medium",
          frame: fig?.getAttribute("data-frame") || "",
          width: w ? Number(w) : null,
          align: fig?.getAttribute("data-align") || "center",
          position:
            fig?.getAttribute("data-position") === "pinned" ? "pinned" : "flow",
          pinX: num("data-pin-x", 50),
          pinY: num("data-pin-y", 50),
          pinW: num("data-pin-w", 40),
          // Link attrs round-trip on the figure (the runtime emits an <a>; for
          // copy/paste the figure's data-* are the source of truth).
          action: fig?.getAttribute("data-action") || "none",
          pageId: fig?.getAttribute("data-page-id") || "",
          sectionId: fig?.getAttribute("data-section-id") || "",
          href: fig?.getAttribute("data-href") || "",
          openInNewTab: fig?.getAttribute("data-new-tab") === "true",
        };
      },
    },
  ],
  toDOM(node) {
    const width = node.attrs["width"] as number | null;
    const action = (node.attrs["action"] as string) || "none";
    const href = (node.attrs["href"] as string) || "";
    return [
      "figure",
      {
        "data-node-type": "image",
        "data-aspect": (node.attrs["aspect"] as string) || "16/9",
        "data-shape": (node.attrs["shape"] as string) || "",
        "data-radius": (node.attrs["radius"] as string) || "medium",
        "data-frame": (node.attrs["frame"] as string) || "",
        "data-align": (node.attrs["align"] as string) || "center",
        // `pb-image`, not `pp-image`: the form-builder editor's global
        // stylesheet targets `.ProseMirror figure.pp-image` at higher
        // specificity and would otherwise clobber our radius/aspect.
        class: "pb-image",
        // Internal width rides as the same CSS var the NodeView + runtime
        // walker set, so a copy/paste round-trip keeps the figure's size.
        ...(width != null
          ? { "data-width": String(width), style: `--pb-image-width:${width}%` }
          : {}),
        // Link target, carried so the renderer (and a paste) can resolve it.
        ...(action !== "none" ? { "data-action": action } : {}),
        ...(action === "page"
          ? { "data-page-id": (node.attrs["pageId"] as string) || "" }
          : {}),
        ...(action === "section"
          ? { "data-section-id": (node.attrs["sectionId"] as string) || "" }
          : {}),
        ...(action === "url" && href ? { "data-href": href } : {}),
        ...(action === "url" && node.attrs["openInNewTab"]
          ? { "data-new-tab": "true" }
          : {}),
        ...(node.attrs["position"] === "pinned"
          ? {
              "data-position": "pinned",
              "data-pin-x": String(node.attrs["pinX"]),
              "data-pin-y": String(node.attrs["pinY"]),
              "data-pin-w": String(node.attrs["pinW"]),
            }
          : {}),
      },
      [
        "img",
        {
          src: (node.attrs["src"] as string) || "",
          alt: (node.attrs["alt"] as string) || "",
        },
      ],
      // Content hole — the `image_caption` child renders here (as a figcaption).
      0,
    ];
  },
};

/** The image's caption — a rich-text `<figcaption>` (its own node so it can hold
 *  marks: an italic credit, a link to the photographer, theme color). Edited
 *  inline; carries no group, so the block pipeline (shuffle / margin / …) skips
 *  it — it's only ever the image's child. */
const imageCaptionSpec: NodeSpec = {
  content: "inline*",
  attrs: {
    /** Text alignment, same vocabulary + `pp-align-*` class as paragraph/
     *  heading — driven by `attrClassesPlugin` (editor) and `attrClasses`
     *  (runtime), not toDOM, exactly like those nodes' `align`. */
    align: { default: "center" as "left" | "center" | "right" },
  },
  parseDOM: [{ tag: "figcaption" }],
  toDOM: () => ["figcaption", { class: "pb-image-caption" }, 0],
};

/** Block-level video — pagy's video block, minus the embed providers:
 *  a hosted/uploaded file rendered by a native `<video>`, same as the
 *  section background video. Corners/Style reuse the image vocabulary
 *  (`pp-radius-*` / `pp-frame-*` via `attrClassesPlugin`); the aspect
 *  comes from the file's own metadata (16/9 placeholder while empty). */
const videoSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    src: { default: "" },
    /** Optional preview image shown before playback starts. */
    poster: { default: "" },
    /** Corner radius: "none" | "medium" | "large". */
    radius: { default: "medium" as "none" | "medium" | "large" },
    /** "" (plain) | "inset" | "shadow". */
    frame: { default: "" as "" | "inset" | "shadow" },
    controls: { default: true },
    autoplay: { default: false },
    muted: { default: false },
    loop: { default: false },
  },
  parseDOM: [
    {
      tag: 'figure[data-node-type="video"] video',
      getAttrs(node) {
        const el = node as HTMLVideoElement;
        const fig = el.closest("figure");
        return {
          src: el.getAttribute("src") || "",
          poster: el.getAttribute("poster") || "",
          radius: fig?.getAttribute("data-radius") || "medium",
          frame: fig?.getAttribute("data-frame") || "",
          controls: el.hasAttribute("controls"),
          autoplay: el.hasAttribute("autoplay"),
          muted: el.hasAttribute("muted"),
          loop: el.hasAttribute("loop"),
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    return [
      "figure",
      {
        "data-node-type": "video",
        "data-radius": (a["radius"] as string) || "medium",
        "data-frame": (a["frame"] as string) || "",
        class: "pb-video",
      },
      [
        "video",
        {
          src: (a["src"] as string) || "",
          ...(a["poster"] ? { poster: a["poster"] as string } : {}),
          ...(a["controls"] ? { controls: "" } : {}),
          ...(a["autoplay"] ? { autoplay: "" } : {}),
          ...(a["muted"] ? { muted: "" } : {}),
          ...(a["loop"] ? { loop: "" } : {}),
          playsinline: "",
          preload: "metadata",
        },
      ],
    ];
  },
};

/** Block-level audio. No pagy equivalent — designed in the video
 *  block's image: a hosted/uploaded file rendered by a native
 *  `<audio>`. Always shows controls (a control-less audio element is
 *  invisible), so the only attr is the source. */
const audioSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    src: { default: "" },
  },
  parseDOM: [
    {
      tag: 'figure[data-node-type="audio"] audio',
      getAttrs(node) {
        const el = node as HTMLAudioElement;
        return { src: el.getAttribute("src") || "" };
      },
    },
  ],
  toDOM(node) {
    return [
      "figure",
      { "data-node-type": "audio", class: "pb-audio" },
      [
        "audio",
        {
          src: (node.attrs["src"] as string) || "",
          controls: "",
          preload: "metadata",
        },
      ],
    ];
  },
};

/** Block-level embed — an `<iframe>` for external content (YouTube, Vimeo,
 *  Loom, Google Maps, CodePen, …): pagy's video embed-providers lifted into
 *  their own block, since our `video` block is upload-only. The user pastes a
 *  normal share/watch URL into `src`; both the NodeView and the runtime render
 *  it through `toEmbedUrl` (see `embed.ts`), which rewrites the known providers
 *  to their embeddable form. Corners/Style reuse the image/video vocabulary
 *  (`pp-radius-*` / `pp-frame-*` via `attrClassesPlugin`); `aspect` rides as a
 *  `data-aspect` attribute exactly like the image block. */
const embedSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    /** Raw URL the user pastes (NOT the rewritten embed URL — that's derived at
     *  render time so the field shows what they typed). */
    src: { default: "" },
    /** Accessible iframe title. */
    title: { default: "" },
    /** "16/9" | "4/3" | "1/1" — an iframe needs a defined box, so unlike the
     *  image block there's no "original". */
    aspect: { default: "16/9" as string },
    /** Corner radius: "none" | "medium" | "large". */
    radius: { default: "medium" as "none" | "medium" | "large" },
    /** "" (plain) | "inset" | "shadow". */
    frame: { default: "" as "" | "inset" | "shadow" },
  },
  parseDOM: [
    {
      tag: 'figure[data-node-type="embed"] iframe',
      getAttrs(node) {
        const el = node as HTMLIFrameElement;
        const fig = el.closest("figure");
        return {
          // Round-trip the raw URL from the figure (the iframe's `src` is the
          // rewritten embed URL); fall back to the iframe src for foreign paste.
          src: fig?.getAttribute("data-src") || el.getAttribute("src") || "",
          title: el.getAttribute("title") || "",
          aspect: fig?.getAttribute("data-aspect") || "16/9",
          radius: fig?.getAttribute("data-radius") || "medium",
          frame: fig?.getAttribute("data-frame") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const src = (a["src"] as string) || "";
    const attrs: Record<string, string> = {
      "data-node-type": "embed",
      // The raw URL rides on the figure so a copy/paste keeps what the user
      // typed; the iframe carries the rewritten embeddable URL.
      ...(src ? { "data-src": src } : {}),
      "data-aspect": (a["aspect"] as string) || "16/9",
      "data-radius": (a["radius"] as string) || "medium",
      "data-frame": (a["frame"] as string) || "",
      class: "pb-embed",
    };
    return [
      "figure",
      attrs,
      src
        ? [
            "iframe",
            {
              src: toEmbedUrl(src),
              title: (a["title"] as string) || "Embedded content",
              loading: "lazy",
              referrerpolicy: "strict-origin-when-cross-origin",
              allow: EMBED_ALLOW,
              allowfullscreen: "true",
              frameborder: "0",
            },
          ]
        : ["div", { class: "pb-media-placeholder" }],
    ];
  },
};

/** Block-level vector — author-pasted INLINE SVG (an icon, logo, illustration).
 *  Unlike the `image` block (which loads any URL incl. *.svg through an `<img>`),
 *  the vector's markup is rendered inline so it scales crisply and can be themed
 *  via `currentColor` (the "Recolor" control). The author pastes raw `<svg>…`
 *  into `markup`; a `src` URL is the alternative source (rendered through `<img>`)
 *  for SVGs the author has hosted rather than pasted. `width` is a % of the block
 *  footprint (like the image block); `align` places it when < 100%. `color` is a
 *  theme slot that, when set, recolors a monochrome SVG via `currentColor`. The
 *  markup rides on `data-markup` so a clipboard round-trip keeps it; the NodeView
 *  + runtime walker do the inline render (and the `sanitizeSvg` scrub). */
const vectorSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    /** Raw inline SVG markup (the primary source). */
    markup: { default: "" },
    /** URL of a hosted SVG — used (via `<img>`) when `markup` is empty. */
    src: { default: "" },
    /** Accessible label. */
    alt: { default: "" },
    /** Width as a % of the block footprint (the shuffle grid span). */
    width: { default: 100 as number },
    /** Horizontal placement within the footprint when `width` < 100. */
    align: { default: "center" as "left" | "center" | "right" },
    /** Recolor slot — "" keeps the SVG's own colors; a theme slot drives
     *  `currentColor` (via the `pp-text -X` class) so a monochrome icon adopts
     *  the palette. Named `tint`, not `color`, to stay out of `attrClasses`'
     *  generic `color → pp-color-X` accent mapping (a different system). */
    tint: { default: "" as "" | TextColor },
  },
  parseDOM: [
    {
      tag: 'figure[data-node-type="vector"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        const w = el.getAttribute("data-width");
        return {
          markup: el.getAttribute("data-markup") || "",
          src: el.getAttribute("data-src") || "",
          alt: el.getAttribute("data-alt") || "",
          width: w ? Number(w) : 100,
          align: el.getAttribute("data-align") || "center",
          tint: el.getAttribute("data-tint") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const width = (a["width"] as number) ?? 100;
    const tint = (a["tint"] as string) || "";
    const attrs: Record<string, string> = {
      "data-node-type": "vector",
      class: `pb-vector${tint ? ` pp-text -${tint}` : ""}`,
      "data-align": (a["align"] as string) || "center",
      "data-width": String(width),
    };
    // The markup/URL ride as data-* so a copy/paste keeps the source; the inline
    // render happens in the NodeView + runtime walker (not toDOM).
    if (a["markup"]) attrs["data-markup"] = a["markup"] as string;
    if (a["src"]) attrs["data-src"] = a["src"] as string;
    if (a["alt"]) attrs["data-alt"] = a["alt"] as string;
    if (tint) {
      attrs["data-tint"] = tint;
      attrs["data-recolor"] = "true";
    }
    return ["figure", attrs];
  },
};

/** Divider — a horizontal rule (atom block). `variant` picks the line style. A
 *  structural primitive, so it carries no content; spacing around it is the
 *  normal per-block top margin. */
const dividerSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    /** Line style: "solid" (default) | "dashed" | "dotted". */
    variant: { default: "solid" as "solid" | "dashed" | "dotted" },
  },
  parseDOM: [
    {
      tag: 'hr[data-node-type="divider"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        return { variant: el.getAttribute("data-variant") || "solid" };
      },
    },
  ],
  toDOM(node) {
    return [
      "hr",
      {
        "data-node-type": "divider",
        class: "pb-divider",
        "data-variant": (node.attrs["variant"] as string) || "solid",
      },
    ];
  },
};

/** Progress — an indicator (atom block) whose value is an EXPRESSION over the
 *  variable scope (e.g. `score.percent`, `page.number / page.count * 100`). Two
 *  forms via `display`: a line bar or a circular ring. A display primitive, so
 *  it carries no content; the NodeView + runtime render it from these attrs. */
const progressSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    /** Expression for the current value (evaluated against the variable scope). */
    value: { default: "score.percent" },
    /** Expression/number for the 100% point. */
    max: { default: "100" },
    /** Visual form: "bar" (line) | "ring" (circle). */
    display: { default: "bar" as "bar" | "ring" },
    /** Optional caption. */
    label: { default: "" },
    /** Show the numeric percent readout. */
    showValue: { default: true },
    /** Theme color slot for the fill. */
    color: { default: "primary" },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="progress"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        return {
          value: el.getAttribute("data-value") || "score.percent",
          max: el.getAttribute("data-max") || "100",
          display: el.getAttribute("data-display") === "ring" ? "ring" : "bar",
          label: el.getAttribute("data-label") || "",
          showValue: el.getAttribute("data-show-value") !== "false",
          color: el.getAttribute("data-color") || "primary",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "progress",
      class: "pb-progress",
      "data-value": String(a["value"] ?? "score.percent"),
      "data-max": String(a["max"] ?? "100"),
      "data-display": (a["display"] as string) || "bar",
      "data-color": (a["color"] as string) || "primary",
    };
    if (a["label"]) attrs["data-label"] = a["label"] as string;
    if (a["showValue"] === false) attrs["data-show-value"] = "false";
    return ["div", attrs];
  },
};

/** Table — `prosemirror-tables` provides the table/row/cell/header node specs,
 *  the cell editing plugin, and the column-resize plugin (wired in `Editor.tsx`).
 *  `tableGroup: "block"` makes the outer `table` a section block (shuffle grid /
 *  margin / containment for free); cells hold any block content. Same config as
 *  the base editor's Table extension, so behavior matches. */
const tableNodeSpecs = tableNodes({
  tableGroup: "block",
  cellContent: "block+",
  cellAttributes: {},
});

/** Augment the generated `table` spec with style attrs (borders / stripes /
 *  density). Spreads the base spec so prosemirror-tables' required bits
 *  (`tableRole`, content, group) survive. The styles surface as `pp-table--*`
 *  classes: in the runtime walker directly, and in the builder via an
 *  `attrClassesPlugin` node decoration (the builder table DOM is owned by
 *  columnResizing's TableView, so `toDOM` here only round-trips the clipboard). */
const baseTableSpec = tableNodeSpecs["table"]!;
const tableSpec: NodeSpec = {
  ...baseTableSpec,
  attrs: {
    ...(baseTableSpec.attrs ?? {}),
    /** Cell borders: "all" (grid) | "rows" (horizontal only) | "none". */
    borders: { default: "all" as "all" | "rows" | "none" },
    /** Zebra-stripe alternating body rows. */
    striped: { default: false },
    /** Cell padding: "comfortable" (default) | "compact". */
    density: { default: "comfortable" as "comfortable" | "compact" },
  },
  parseDOM: [
    {
      tag: "table",
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return {
          borders: el.getAttribute("data-borders") || "all",
          striped: el.getAttribute("data-striped") === "true",
          density: el.getAttribute("data-density") || "comfortable",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {};
    if (a["borders"] && a["borders"] !== "all")
      attrs["data-borders"] = a["borders"] as string;
    if (a["striped"]) attrs["data-striped"] = "true";
    if (a["density"] && a["density"] !== "comfortable")
      attrs["data-density"] = a["density"] as string;
    return ["table", attrs, ["tbody", 0]];
  },
};

// ────────────────────────────────────────────────────────────────
// Pipeline steps
/**
 * Card — a styled block container (Pagy's `card`). Same content model
 * as shuffle's `container` (holds blocks, stacks them), but with a
 * background (theme colour or image), padding, corner radius, and an
 * optional image overlay. Being in the `block` group means
 * `addShuffleNodes` later stamps it with shuffle attrs, so it drags /
 * resizes / is section-contained exactly like a container — which is
 * also what makes Container ↔ Card a clean `setNodeMarkup` swap.
 */
const cardSpec: NodeSpec = {
  group: "block",
  content: "block+",
  attrs: {
    /** Inner padding: xs | s | m | l | xl. */
    padding: { default: "m" as Size },
    /** Corner radius: none | medium | large. */
    radius: { default: "large" as "none" | "medium" | "large" },
    /** Theme variant (pagy's card "Colors"), self-rescoping exactly like a
     *  section's: "" (default) | inverted | primary | secondary | tertiary.
     *  Maps to the `.theme.-X` variable scopes `themeToCss` emits, so the
     *  card re-establishes its OWN palette and its look depends only on this
     *  choice — never on the section it's nested in. */
    theme: { default: "" as "" | "inverted" | "primary" | "secondary" | "tertiary" },
    /** Optional background image URL. */
    image: { default: "" },
    /** Scrim over the background image: "" | light | medium | strong. */
    overlay: { default: "" as "" | "light" | "medium" | "strong" },
    /** Frame treatment, same vocabulary as image/video: "" (plain) | inset
     *  (hairline) | shadow (drop shadow). Surfaces as `pp-frame-*` via
     *  attrClassesPlugin. */
    frame: { default: "" as "" | "inset" | "shadow" },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="card"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        return {
          padding: el.getAttribute("data-padding") || "m",
          radius: el.getAttribute("data-radius") || "large",
          // Migrate the old color-slot attr: the "neutral" slot was a
          // neutral-background card, i.e. the new "-inverted" variant; the
          // other slots map 1:1.
          theme:
            el.getAttribute("data-theme") ||
            (el.getAttribute("data-color") === "neutral"
              ? "inverted"
              : el.getAttribute("data-color") || ""),
          image: el.getAttribute("data-image") || "",
          overlay: el.getAttribute("data-overlay") || "",
          frame: el.getAttribute("data-frame") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const theme = (a["theme"] as string) || "";
    const attrs: Record<string, string> = {
      "data-node-type": "card",
      // Always carry a `theme -X` (default included) so the card re-asserts its
      // own palette via themeToCss's `.theme.-X` scope, independent of the
      // section it sits in — the same mechanism `.pp-section` uses.
      class: `pp-card theme -${theme || "default"}`,
      "data-padding": (a["padding"] as string) || "m",
      "data-radius": (a["radius"] as string) || "large",
    };
    if (theme) attrs["data-theme"] = theme;
    if (a["overlay"]) attrs["data-overlay"] = a["overlay"] as string;
    if (a["frame"]) attrs["data-frame"] = a["frame"] as string;
    if (a["image"]) {
      attrs["data-image"] = a["image"] as string;
      attrs["style"] = `background-image:url("${a["image"]}")`;
    }
    return ["div", attrs, 0];
  },
};

/**
 * Header — the site's top bar (pagy's `header` node). A full-width structural
 * wrapper like `section` (NOT in the "block" group, so shuffle never drags or
 * resizes the bar itself), holding blocks — typically one `row` with a wordmark
 * + nav. The page is `header? section+ footer?`, so it's the optional first
 * child of a page.
 *
 * Visual attrs mirror pagy's header settings panel (`Position`, `Colors`,
 * `Background`) plus the section/footer symmetric vertical-padding model (the
 * bar's height); they surface as classes the NodeView / toDOM / `renderNode`
 * apply, exactly like the section's.
 */
const headerSpec: NodeSpec = {
  content: "block+",
  defining: true,
  isolating: true,
  attrs: {
    /** Symmetric vertical padding in PX (same model + `py-{unit}` class as a
     *  section / footer); this is what gives the bar its height. */
    padding: { default: HEADER_PADDING_DEFAULT as number },
    /** Position: false = Normal (flows above the first section), true = Fixed
     *  (sticks to the top of the scroll viewport). */
    fixed: { default: false },
    /** Theme variant ("Colors"), self-rescoping like a section/card. */
    theme: { default: "" as ThemeVariant },
    /** Background: "" solid | "blur" | "transparent". */
    background: { default: "" as HeaderBackground },
  },
  parseDOM: [
    {
      tag: 'header[data-node-type="header"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        return {
          padding:
            sectionPaddingFromClassName(el.className) ?? HEADER_PADDING_DEFAULT,
          fixed: el.getAttribute("data-fixed") === "true",
          theme: el.getAttribute("data-theme") || "",
          background: el.getAttribute("data-background") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const theme = (a["theme"] as string) || "";
    const attrs: Record<string, string> = {
      "data-node-type": "header",
      // Padding lives in the `py-{unit}` class (via `headerClass`), the source
      // of truth — no data-height.
      class: headerClass(a),
    };
    if (a["fixed"]) attrs["data-fixed"] = "true";
    if (theme) attrs["data-theme"] = theme;
    if (a["background"]) attrs["data-background"] = a["background"] as string;
    return ["header", attrs, 0];
  },
};

/**
 * Footer — the site's bottom bar (pagy renders footers as ordinary sections;
 * we give them a dedicated node so they're addressable + the page can require
 * `footer?` as its last child). Same content model + symmetric vertical-padding
 * model as a section (the `py-{unit}` class), but a leaner settings surface
 * (Colors + Spacing).
 */
const footerSpec: NodeSpec = {
  content: "block+",
  defining: true,
  isolating: true,
  attrs: {
    /** Symmetric vertical padding in PX (same model + `py-{unit}` class as a
     *  section); starts tighter than a section (pagy's "small" footer). */
    padding: { default: FOOTER_PADDING_DEFAULT as number },
    /** Position: false = Normal (flows after the last section), true = Fixed
     *  (glued to the bottom of the scroll viewport while sections scroll above
     *  it) — mirrors the header's `fixed`. */
    fixed: { default: false },
    /** Theme variant ("Colors"), self-rescoping like a section/card. */
    theme: { default: "" as ThemeVariant },
  },
  parseDOM: [
    {
      tag: 'footer[data-node-type="footer"]',
      getAttrs(node) {
        const el = node as HTMLElement;
        return {
          padding:
            sectionPaddingFromClassName(el.className) ?? FOOTER_PADDING_DEFAULT,
          fixed: el.getAttribute("data-fixed") === "true",
          theme: el.getAttribute("data-theme") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const theme = (a["theme"] as string) || "";
    const attrs: Record<string, string> = {
      "data-node-type": "footer",
      class: footerClass(a),
    };
    if (a["fixed"]) attrs["data-fixed"] = "true";
    if (theme) attrs["data-theme"] = theme;
    return ["footer", attrs, 0];
  },
};

// ────────────────────────────────────────────────────────────────

/** Step 1 — adds page + section + header + footer + button + card + video +
 *  audio + embed + vector + divider + accordion + tabs + table, replaces image
 *  with block-level. */
function addPageBuilderNodes(schema: Schema): Schema {
  const nodes = schema.spec.nodes
    .addToEnd("page", pageSpec)
    .addToEnd("section", sectionSpec)
    .addToEnd("header", headerSpec)
    .addToEnd("footer", footerSpec)
    .addToEnd("button", buttonSpec)
    .addToEnd("card", cardSpec)
    .addToEnd("video", videoSpec)
    .addToEnd("audio", audioSpec)
    .addToEnd("embed", embedSpec)
    .addToEnd("vector", vectorSpec)
    .addToEnd("image_caption", imageCaptionSpec)
    .addToEnd("divider", dividerSpec)
    .addToEnd("progress", progressSpec)
    // Accordion + Tabs (outer block + their children). Children carry no group,
    // so the shuffle/margin/name steps skip them; the outer block is picked up.
    .addToEnd("accordion", accordionSpec)
    .addToEnd("accordion_item", accordionItemSpec)
    .addToEnd("accordion_header", accordionHeaderSpec)
    .addToEnd("accordion_panel", accordionPanelSpec)
    .addToEnd("tabs", tabsSpec)
    .addToEnd("tab", tabSpec)
    .addToEnd("tab_label", tabLabelSpec)
    .addToEnd("tab_panel", tabPanelSpec)
    // Table (prosemirror-tables): outer `table` is group "block"; row/cell/header
    // carry their own groups.
    .addToEnd("table", tableSpec)
    .addToEnd("table_row", tableNodeSpecs["table_row"]!)
    .addToEnd("table_cell", tableNodeSpecs["table_cell"]!)
    .addToEnd("table_header", tableNodeSpecs["table_header"]!)
    .update("image", imageSpec);
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Step 1b — adds every registered learning-item node (and any item marks) to
 *  the schema: the outer block (`mc`, …) plus its children (`mc_prompt`,
 *  `mc_option`, …). Run right after the page-builder nodes and BEFORE shuffle /
 *  containment / margin / name, so each item's `group: "block"` outer node is
 *  picked up by those steps for free (grid attrs, section containment, top
 *  margin, layer name) — exactly like `card`. Child nodes carry no group, so
 *  those steps skip them. New item types register in `items/registry.ts`; this
 *  step needs no edits. */
function addItemNodes(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  let marks = schema.spec.marks;
  // The shared `item_explanation` node, referenced by every gradable item's
  // content expression — registered once here, not per type.
  if (!nodes.get(ITEM_EXPLANATION_NODE)) {
    nodes = nodes.addToEnd(ITEM_EXPLANATION_NODE, itemExplanationSpec);
  }
  for (const def of ITEM_DEFINITIONS) {
    for (const [name, spec] of Object.entries(def.nodes)) {
      if (!nodes.get(name)) nodes = nodes.addToEnd(name, spec);
    }
    if (def.marks) {
      for (const [name, spec] of Object.entries(def.marks)) {
        if (!marks.get(name)) marks = marks.addToEnd(name, spec);
      }
    }
  }
  return new Schema({ nodes, marks });
}

/** Step 2 — adds `align` + `size` attrs to paragraph + heading so
 *  the BlockSettings popover has something to edit. The class names
 *  (`pp-align-center`, `pp-size-m`, etc.) are added at render time
 *  by `attrClassesPlugin`, so the schema toDOM stays minimal. */
function augmentTextBlockAttrs(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  for (const name of ["paragraph", "heading"] as const) {
    const spec = nodes.get(name);
    if (!spec) continue;
    nodes = nodes.update(name, {
      ...spec,
      attrs: {
        ...spec.attrs,
        align: { default: "left" as Align },
        // Headings default to null = "use the level's default size"
        // (`defaultHeadingSize` + the per-level CSS fallback), so a
        // heading created by any path — markdown `#` shortcut, enter
        // split — sizes by its level, not a flat default. The picker /
        // type-switcher stamp the default explicitly, pagy-style.
        size: {
          default:
            name === "heading" ? null : (PARAGRAPH_DEFAULT_SIZE as Size),
        },
        // Drop cap — a paragraph-only text effect (an enlarged first letter).
        ...(name === "paragraph" ? { dropCap: { default: false } } : {}),
      },
    });
  }
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Step 3 — `doc.content` becomes `header? page+ footer?`. The deck of slides
 *  (`page+`) is bookended by the SITE-WIDE header / footer: one master bar each,
 *  rendered around every page (unless a page overrides or hides it). They reuse
 *  the same `header`/`footer` node types pages use for overrides — a node type
 *  is allowed in more than one content context — so a "detach" is just a
 *  content copy from doc level into the page, and "make global" the reverse.
 *  Run after page + header + footer are in the schema. */
function requirePageRoot(schema: Schema): Schema {
  const docSpec = schema.spec.nodes.get("doc");
  if (!docSpec) return schema;
  const nodes = schema.spec.nodes.update("doc", {
    ...docSpec,
    content: "header? page+ footer?",
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Step 4 — stamps every "block"-group node with
 *  `pitterPatter.shuffle.containedBy = "section"`.
 *
 *  Why: when shuffle's `reorder` transform computes a drop position
 *  and that position is outside the dragged block's enclosing
 *  section, it would otherwise let PM normalise the resulting
 *  invalid doc by wrapping the paragraph in a brand-new section.
 *  `containedBy` makes shuffle short-circuit instead, so the original
 *  block snaps back into place. */
function constrainBlocksToSection(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  // OrderedMap.forEach iterates a snapshot, so it's safe to reassign
  // `nodes` inside the loop — we're building the next map from the
  // original entries.
  schema.spec.nodes.forEach((name, spec) => {
    const groups = (spec.group ?? "").split(/\s+/);
    if (!groups.includes("block")) return;
    nodes = nodes.update(name, {
      ...spec,
      pitterPatter: {
        ...spec.pitterPatter,
        shuffle: {
          ...spec.pitterPatter?.shuffle,
          containedBy: "section",
        },
      },
    });
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Step 5 — adds a `margin` attr (top-margin px, 0 = none) to every
 *  "block"-group node, so any block can carry the drag-set top margin
 *  (`BlockMarginHandle` / pagy's `margin-handle`). Run AFTER shuffle so
 *  `container`/`row` get it too. The value is applied purely as a
 *  `margin-top` style — by `attrClassesPlugin` in the editor and by
 *  `renderNode` on the site — so node `toDOM`/`parseDOM` need no changes;
 *  it's vertical spacing, orthogonal to shuffle's grid attrs. */
function addBlockMarginAttr(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  schema.spec.nodes.forEach((name, spec) => {
    const groups = (spec.group ?? "").split(/\s+/);
    if (!groups.includes("block")) return;
    // null = Auto (no explicit margin); a number (incl 0) is explicit.
    nodes = nodes.update(name, {
      ...spec,
      attrs: { ...spec.attrs, margin: { default: null } },
    });
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Adds optional px width clamps — `minW` / `maxW` (0 = no clamp) — to EVERY
 *  block-group node (every question item included), so any block's rendered
 *  width can be bounded for readability / mobile-overlap. Like `margin`, they
 *  never touch `toDOM`: applied as inline `min-width` / `max-width` by
 *  `attrClassesPlugin` in the editor and by `renderNode` on the site, and a
 *  pinned image folds them into its absolute style. */
function addWidthLimitAttrs(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  schema.spec.nodes.forEach((name, spec) => {
    const groups = (spec.group ?? "").split(/\s+/);
    if (!groups.includes("block")) return;
    nodes = nodes.update(name, {
      ...spec,
      attrs: { ...spec.attrs, minW: { default: 0 }, maxW: { default: 0 } },
    });
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** The visual blocks that expose an opacity control — anything with a
 *  background, fill, or media (plus the container/button wrappers). Plain text,
 *  rows, audio, and interactive question items are intentionally excluded. */
const OPACITY_NODE_TYPES = new Set([
  "image",
  "video",
  "card",
  "section",
  "container",
  "button",
]);

/** Step 5c — adds an `opacity` attr (null = unset/fully opaque; else a 0–1
 *  number) to the visual blocks in `OPACITY_NODE_TYPES`. Run AFTER shuffle so
 *  `container` exists. Like `margin`, it never touches `toDOM`: it's applied as
 *  an inline `opacity` style — continuous, so NOT a utility class — by
 *  `attrClassesPlugin` in the editor and by `renderNode` on the site. */
function addOpacityAttr(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  schema.spec.nodes.forEach((name, spec) => {
    if (!OPACITY_NODE_TYPES.has(name)) return;
    nodes = nodes.update(name, {
      ...spec,
      attrs: { ...spec.attrs, opacity: { default: null } },
    });
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Step 5b — turns shuffle's `container` into a full flex *stack* by adding the
 *  layout attrs that drive its flexbox: `axis` (vertical | horizontal — the
 *  main axis), `stackAlign` (cross-axis align-items), `stackJustify` (main-axis
 *  justify-content), and `wrap` (flex-wrap). Container-only — `row` keeps its
 *  own shuffle grid layout.
 *
 *  Like `margin`, none of these touch `toDOM`: they surface as utility classes
 *  (`stackClasses`) on the same `.container` element — applied by
 *  `attrClassesPlugin` in the editor and by `renderNode` on the site — so the
 *  flex CSS can target `.container.-horizontal`, `.container.-align-center`,
 *  etc. Inter-child spacing is NOT an attr here: it reuses every block's
 *  per-child `margin` (top-margin when vertical, left-margin when horizontal),
 *  so a stack's rhythm stays individually adjustable, axis-relative. */
function addStackAttrs(schema: Schema): Schema {
  const spec = schema.spec.nodes.get("container");
  if (!spec) return schema;
  const nodes = schema.spec.nodes.update("container", {
    ...spec,
    attrs: {
      ...spec.attrs,
      axis: { default: "vertical" },
      stackAlign: { default: "stretch" },
      stackJustify: { default: "start" },
      wrap: { default: true },
    },
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Block types that carry NO `lang` attr — pure media with no text content, so
 *  a language is meaningless (mirrors the user-facing rule "images don't need a
 *  language"). Every OTHER block-group node (paragraph, heading, button, card,
 *  container, row, and the learning-item outer nodes) gets it. */
const NO_LANGUAGE_NODE_TYPES = new Set(["image", "video", "audio", "embed"]);

/** Structural (non-"block"-group) nodes that ALSO carry `lang` — a whole
 *  section can be tagged as e.g. Spanish (its Attributes group lives in the
 *  Section settings panel). Header/footer are left out for now; add them here
 *  if they ever need per-bar language. */
const LANGUAGE_STRUCTURAL_NODE_TYPES = new Set(["section"]);

/** Step 5d — adds a `lang` attr (BCP-47 code; "" = untagged) to every
 *  text-bearing block-group node PLUS the section, so a whole block/section
 *  (and its descendants, via HTML `lang` inheritance) can be tagged as e.g.
 *  Spanish. The Attributes section in the block / section settings panels edits
 *  it. Like `margin`/`opacity`, it never touches `toDOM`: the editor applies it
 *  as a `lang` node-decoration attribute (`attrClassesPlugin`) and the site as a
 *  `lang` attribute on the element (`renderNode`). Media (image/video/audio) is
 *  skipped. */
function addLanguageAttr(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  schema.spec.nodes.forEach((name, spec) => {
    const groups = (spec.group ?? "").split(/\s+/);
    const textBearingBlock =
      groups.includes("block") && !NO_LANGUAGE_NODE_TYPES.has(name);
    if (!textBearingBlock && !LANGUAGE_STRUCTURAL_NODE_TYPES.has(name)) return;
    nodes = nodes.update(name, {
      ...spec,
      attrs: { ...spec.attrs, lang: { default: "" } },
    });
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Step 5c — adds an editor-only `name` attr (a Figma-style layer name) to
 *  every block-group node plus the structural section / header / footer, so any
 *  layer can be renamed in the Layers panel. Empty = use the derived label.
 *  Like `margin`, it never renders (no toDOM / parseDOM) — it's metadata that
 *  lives in the doc JSON and survives internal copy/paste. Pages keep `title`. */
function addLayerNameAttr(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  const structural = new Set(["section", "header", "footer"]);
  schema.spec.nodes.forEach((name, spec) => {
    const groups = (spec.group ?? "").split(/\s+/);
    if (!groups.includes("block") && !structural.has(name)) return;
    nodes = nodes.update(name, {
      ...spec,
      attrs: { ...spec.attrs, name: { default: "" } },
    });
  });
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Text color mark — pagy's `color` leaf (`<span class="text -muted">`),
 *  pp-prefixed. The slot → color mapping lives in page-builder.css. */
const textColorSpec: MarkSpec = {
  attrs: { color: {} },
  parseDOM: [
    {
      tag: "span[data-text-color]",
      getAttrs: (el) => {
        const color = (el as HTMLElement).getAttribute("data-text-color");
        return color ? { color } : false;
      },
    },
  ],
  toDOM(mark) {
    const color = mark.attrs["color"] as TextColor;
    return [
      "span",
      { "data-text-color": color, class: `pp-text -${color}` },
      0,
    ];
  },
};

/** Highlight mark — a marker-style background behind a run of text (the
 *  inverse of `textColor`: it paints the slot as the BACKGROUND with contrasting
 *  text). The slot → color mapping lives in page-builder.css (`.pp-highlight`). */
const highlightSpec: MarkSpec = {
  attrs: { color: { default: "primary" } },
  parseDOM: [
    {
      tag: "mark[data-highlight]",
      getAttrs: (el) => {
        const color = (el as HTMLElement).getAttribute("data-highlight");
        return color ? { color } : false;
      },
    },
  ],
  toDOM(mark) {
    const color = mark.attrs["color"] as string;
    return ["mark", { "data-highlight": color, class: `pp-highlight -${color}` }, 0];
  },
};

/** Link mark — replaces the basic schema's `link` (href/title) with
 *  pagy's link shape: a URL, an "open in new tab" flag, and a style
 *  variant (underlined vs minimal). `inclusive: false` like the basic
 *  spec, so typing at a link's edge doesn't extend it.
 *
 *  Pagy also links to site *pages* (`link.type: "page"` + pageId); the
 *  page builder has no pages model yet, so this is URL-only. When pages
 *  land, add `kind` + `pageId` attrs here and a Page/URL segmented
 *  control in `LinkPopover`. */
const linkSpec: MarkSpec = {
  attrs: {
    href: { default: "" },
    newTab: { default: false },
    variant: { default: "" as LinkVariant },
    // Same action vocabulary as buttons (`ButtonAction`): a text link can open a
    // URL or navigate the deck / scroll to a section. parseDOM migrates plain
    // `<a href>` (no data-action) to the "url" action.
    action: { default: "url" as ButtonAction },
    pageId: { default: "" },
    sectionId: { default: "" },
    /** Behavior when a prev/next link dead-ends at a deck edge: "dim" greys it
     *  out (default), "hide" omits the linked text run. Mirrors the button. */
    whenDisabled: { default: "dim" as "dim" | "hide" },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: "a[href]",
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return {
          href: e.getAttribute("href"),
          newTab: e.getAttribute("target") === "_blank",
          variant: e.classList.contains("-minimal") ? "minimal" : "",
          action: e.getAttribute("data-action") || "url",
          pageId: e.getAttribute("data-page-id") || "",
          sectionId: e.getAttribute("data-section-id") || "",
          whenDisabled:
            e.getAttribute("data-when-disabled") === "hide" ? "hide" : "dim",
        };
      },
    },
  ],
  toDOM(mark) {
    const { href, newTab, variant, action, pageId, sectionId, whenDisabled } =
      mark.attrs as {
        href: string;
        newTab: boolean;
        variant: LinkVariant;
        action: ButtonAction;
        pageId: string;
        sectionId: string;
        whenDisabled: "dim" | "hide";
      };
    const isUrl = action === "url";
    return [
      "a",
      {
        href: isUrl ? href : "#",
        class: `pp-link${variant === "minimal" ? " -minimal" : ""}`,
        ...(action !== "url" ? { "data-action": action } : {}),
        ...(action === "page" ? { "data-page-id": pageId } : {}),
        ...(action === "section" ? { "data-section-id": sectionId } : {}),
        ...(whenDisabled === "hide" ? { "data-when-disabled": "hide" } : {}),
        ...(newTab && isUrl
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      },
      0,
    ];
  },
};

/** Tooltip mark — no pagy equivalent. Wraps a run of text as a "term": the
 *  editor shows a dotted underline; the published site (`renderMarks`) wraps
 *  it in the Radix tooltip so hovering/focusing the term reveals `content`.
 *  Built for glossing words a student might not know. `inclusive: false`
 *  (like link) so typing past the term's edge doesn't extend the gloss. The
 *  gloss lives in `content`; toDOM serializes it to `data-tooltip` so an
 *  internal copy/paste round-trips it. */
const tooltipSpec: MarkSpec = {
  attrs: { content: { default: "" } },
  inclusive: false,
  parseDOM: [
    {
      tag: "span[data-tooltip]",
      getAttrs: (el) => {
        const content = (el as HTMLElement).getAttribute("data-tooltip");
        return content ? { content } : false;
      },
    },
  ],
  toDOM(mark) {
    const content = mark.attrs["content"] as string;
    return ["span", { "data-tooltip": content, class: "pp-tooltip-term" }, 0];
  },
};

/** Language mark — tags a run of text with a BCP-47 language so the rendered
 *  span carries `lang="<code>"` (the semantic payload: screen readers,
 *  hyphenation, spellcheck, `:lang()` styling). `data-lang` mirrors it for
 *  parseDOM round-trips; `pp-lang` is the styling hook (an author-only
 *  indicator in the editor, neutral on the site). `inclusive: false` like
 *  link. See `LANGUAGE_OPTIONS`. */
const languageSpec: MarkSpec = {
  attrs: { lang: { default: "" } },
  inclusive: false,
  parseDOM: [
    {
      tag: "span[data-lang]",
      getAttrs: (el) => {
        const lang = (el as HTMLElement).getAttribute("data-lang");
        return lang ? { lang } : false;
      },
    },
  ],
  toDOM(mark) {
    const lang = mark.attrs["lang"] as string;
    return ["span", { lang, "data-lang": lang, class: "pp-lang" }, 0];
  },
};

/** Step 2b — text-level marks the selection toolbar edits: replaces the
 *  basic `link` with pagy's richer shape and adds the theme-slot text color,
 *  the student-gloss `tooltip`, and the `language` tag. Node-only step
 *  ordering doesn't apply; this just needs to run once anywhere in the
 *  pipeline. */
function addTextMarks(schema: Schema): Schema {
  let marks = schema.spec.marks.update("link", linkSpec);
  if (!marks.get("textColor")) {
    marks = marks.addToEnd("textColor", textColorSpec);
  }
  if (!marks.get("highlight")) {
    marks = marks.addToEnd("highlight", highlightSpec);
  }
  if (!marks.get("tooltip")) {
    marks = marks.addToEnd("tooltip", tooltipSpec);
  }
  if (!marks.get("language")) {
    marks = marks.addToEnd("language", languageSpec);
  }
  return new Schema({ nodes: schema.spec.nodes, marks });
}

// ────────────────────────────────────────────────────────────────
// Public pipeline
// ────────────────────────────────────────────────────────────────

/**
 * Builds the final page-builder schema. The caller passes in a base
 * schema that already has whatever marks they want (Bold/Italic/etc),
 * and we run the page-builder + shuffle pipeline on top.
 */
export function buildPageBuilderSchema(base: Schema): Schema {
  const withPageBuilder = addPageBuilderNodes(base);
  // Learning-item nodes go in BEFORE shuffle/containment so their block-group
  // outer nodes get the same grid/margin/name/containment treatment as `card`.
  const withItems = addItemNodes(withPageBuilder);
  const withTextAttrs = augmentTextBlockAttrs(withItems);
  const withTextMarks = addTextMarks(withTextAttrs);
  const withPageRoot = requirePageRoot(withTextMarks);
  // Shuffle adds the `container` + `row` block-group nodes here. Containment
  // MUST run after it: otherwise `container`/`row` never get
  // `containedBy: "section"`, so dragging one isn't constrained to its
  // section — the drop escapes and PM wraps it in a brand-new section. Running
  // containment last stamps every block-group node (the originals AND
  // shuffle's container/row).
  //
  // Row/container vertical alignment is NOT augmented here: shuffle already
  // owns it via its `alignment` attr (written as an inline `align-items`
  // style), and the Row settings control drives that attr directly. An
  // earlier `alignContent` attr/class duplicated it but was inert — no class
  // can beat the inline style — so it's gone.
  const withShuffle = addShuffleNodes(withPageRoot, "block+", "block");
  const withMargin = addBlockMarginAttr(withShuffle);
  const withWidthLimits = addWidthLimitAttrs(withMargin);
  const withOpacity = addOpacityAttr(withWidthLimits);
  const withStack = addStackAttrs(withOpacity);
  const withLang = addLanguageAttr(withStack);
  const withNames = addLayerNameAttr(withLang);
  return constrainBlocksToSection(withNames);
}

/** Signature for the function that builds the initial doc from the
 *  finished schema. Used by `PageBuilderEditor`. */
export type InitialDocBuilder = (schema: Schema) => PmNode;
