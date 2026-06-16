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
    /** Link target kind: a deck page (`pageId`) or an explicit `href`. */
    linkType: { default: "url" as "page" | "url" },
    /** Target page id when `linkType` is "page" (else ""). */
    pageId: { default: "" },
    href: { default: "#" },
    /** Adds `target="_blank"` when true. */
    openInNewTab: { default: false },
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
          linkType: el.getAttribute("data-link-type") === "page" ? "page" : "url",
          pageId: el.getAttribute("data-page-id") || "",
          href: el.getAttribute("href") || "#",
          openInNewTab: el.getAttribute("target") === "_blank",
        };
      },
    },
  ],
  toDOM(node) {
    const variant = (node.attrs["variant"] as string) || "primary";
    const openInNewTab = !!node.attrs["openInNewTab"];
    const linkType = node.attrs["linkType"] === "page" ? "page" : "url";
    const pageId = (node.attrs["pageId"] as string) || "";
    // Page links carry the target id for the renderer/publish step to
    // resolve; there's no live site routing yet, so the href stays "#".
    // Only the BEM variant class is emitted here; the rest of the
    // visual classes (pp-color-*, pp-size-*, pp-width-*, pp-align-*)
    // are added by `attrClassesPlugin` at render time. That way new
    // attrs don't need toDOM updates.
    return [
      "a",
      {
        "data-node-type": "button",
        href: linkType === "page" ? "#" : (node.attrs["href"] as string) || "#",
        ...(linkType === "page"
          ? { "data-link-type": "page", "data-page-id": pageId }
          : {}),
        ...(openInNewTab
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
  atom: true,
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
  },
  parseDOM: [
    {
      tag: 'figure[data-node-type="image"] img',
      getAttrs(node) {
        const el = node as HTMLImageElement;
        const fig = el.closest("figure");
        const w = fig?.getAttribute("data-width");
        return {
          src: el.getAttribute("src") || "",
          alt: el.getAttribute("alt") || "",
          aspect: fig?.getAttribute("data-aspect") || "16/9",
          shape: fig?.getAttribute("data-shape") || "",
          radius: fig?.getAttribute("data-radius") || "medium",
          frame: fig?.getAttribute("data-frame") || "",
          width: w ? Number(w) : null,
          align: fig?.getAttribute("data-align") || "center",
        };
      },
    },
  ],
  toDOM(node) {
    const width = node.attrs["width"] as number | null;
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
      },
      [
        "img",
        {
          src: (node.attrs["src"] as string) || "",
          alt: (node.attrs["alt"] as string) || "",
        },
      ],
    ];
  },
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
    if (theme) attrs["data-theme"] = theme;
    return ["footer", attrs, 0];
  },
};

// ────────────────────────────────────────────────────────────────

/** Step 1 — adds page + section + header + footer + button + card + video +
 *  audio, replaces image with block-level. */
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
    .update("image", imageSpec);
  return new Schema({ nodes, marks: schema.spec.marks });
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
  },
  inclusive: false,
  parseDOM: [
    {
      tag: "a[href]",
      getAttrs: (el) => ({
        href: (el as HTMLElement).getAttribute("href"),
        newTab: (el as HTMLElement).getAttribute("target") === "_blank",
        variant: (el as HTMLElement).classList.contains("-minimal")
          ? "minimal"
          : "",
      }),
    },
  ],
  toDOM(mark) {
    const { href, newTab, variant } = mark.attrs as {
      href: string;
      newTab: boolean;
      variant: LinkVariant;
    };
    return [
      "a",
      {
        href,
        class: `pp-link${variant === "minimal" ? " -minimal" : ""}`,
        ...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {}),
      },
      0,
    ];
  },
};

/** Step 2b — text-level marks the selection toolbar edits: replaces the
 *  basic `link` with pagy's richer shape and adds the theme-slot text
 *  color. Node-only step ordering doesn't apply; this just needs to run
 *  once anywhere in the pipeline. */
function addTextMarks(schema: Schema): Schema {
  let marks = schema.spec.marks.update("link", linkSpec);
  if (!marks.get("textColor")) {
    marks = marks.addToEnd("textColor", textColorSpec);
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
  const withTextAttrs = augmentTextBlockAttrs(withPageBuilder);
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
  const withStack = addStackAttrs(withMargin);
  const withNames = addLayerNameAttr(withStack);
  return constrainBlocksToSection(withNames);
}

/** Signature for the function that builds the initial doc from the
 *  finished schema. Used by `PageBuilderEditor`. */
export type InitialDocBuilder = (schema: Schema) => PmNode;
