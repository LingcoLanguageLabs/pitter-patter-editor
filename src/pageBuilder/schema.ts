/**
 * Page-builder schema.
 *
 * The schema is built in a small pipeline (`buildPageBuilderSchema`)
 * that runs five named steps:
 *
 *   1. addPageBuilderNodes  — adds `section`, `button`, swaps `image`
 *                              to a block-level node.
 *   2. requireSectionRoot   — tightens `doc.content` from `block+` to
 *                              `section+` so paragraphs can't live at
 *                              the root.
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
  type NodeSpec,
  type Node as PmNode,
} from "prosemirror-model";
import { addShuffleNodes } from "@pitter-patter/shuffle";

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

/** Default paragraph size — stamped when converting a heading back to
 *  a paragraph (pagy: `defaultSizeForBlockType("paragraph")`). */
export const PARAGRAPH_DEFAULT_SIZE: Size = "m";

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
    padding: { default: "medium" },
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
          padding: el.getAttribute("data-padding") || "medium",
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
      "data-padding": (a["padding"] as string) || "medium",
      // `theme -X` puts the section under the `.theme.-X` variable
      // scope from `themeToCss`, exactly like pagy's section renderer.
      class: `pp-section${theme ? ` theme -${theme}` : ""}`,
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
          href: el.getAttribute("href") || "#",
          openInNewTab: el.getAttribute("target") === "_blank",
        };
      },
    },
  ],
  toDOM(node) {
    const variant = (node.attrs["variant"] as string) || "primary";
    const openInNewTab = !!node.attrs["openInNewTab"];
    // Only the BEM variant class is emitted here; the rest of the
    // visual classes (pp-color-*, pp-size-*, pp-width-*, pp-align-*)
    // are added by `attrClassesPlugin` at render time. That way new
    // attrs don't need toDOM updates.
    return [
      "a",
      {
        "data-node-type": "button",
        href: (node.attrs["href"] as string) || "#",
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
  },
  parseDOM: [
    {
      tag: 'figure[data-node-type="image"] img',
      getAttrs(node) {
        const el = node as HTMLImageElement;
        const fig = el.closest("figure");
        return {
          src: el.getAttribute("src") || "",
          alt: el.getAttribute("alt") || "",
          aspect: fig?.getAttribute("data-aspect") || "16/9",
          shape: fig?.getAttribute("data-shape") || "",
          radius: fig?.getAttribute("data-radius") || "medium",
          frame: fig?.getAttribute("data-frame") || "",
        };
      },
    },
  ],
  toDOM(node) {
    return [
      "figure",
      {
        "data-node-type": "image",
        "data-aspect": (node.attrs["aspect"] as string) || "16/9",
        "data-shape": (node.attrs["shape"] as string) || "",
        "data-radius": (node.attrs["radius"] as string) || "medium",
        "data-frame": (node.attrs["frame"] as string) || "",
        // `pb-image`, not `pp-image`: the form-builder editor's global
        // stylesheet targets `.ProseMirror figure.pp-image` at higher
        // specificity and would otherwise clobber our radius/aspect.
        class: "pb-image",
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
    /** Theme background slot: "" (page background) | neutral | primary |
     *  secondary | tertiary. */
    color: { default: "" as "" | "neutral" | "primary" | "secondary" | "tertiary" },
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
          color: el.getAttribute("data-color") || "",
          image: el.getAttribute("data-image") || "",
          overlay: el.getAttribute("data-overlay") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "card",
      class: "pp-card",
      "data-padding": (a["padding"] as string) || "m",
      "data-radius": (a["radius"] as string) || "large",
    };
    if (a["color"]) attrs["data-color"] = a["color"] as string;
    if (a["overlay"]) attrs["data-overlay"] = a["overlay"] as string;
    if (a["image"]) {
      attrs["data-image"] = a["image"] as string;
      attrs["style"] = `background-image:url("${a["image"]}")`;
    }
    return ["div", attrs, 0];
  },
};

// ────────────────────────────────────────────────────────────────

/** Step 1 — adds section + button + card, replaces image with block-level. */
function addPageBuilderNodes(schema: Schema): Schema {
  const nodes = schema.spec.nodes
    .addToEnd("section", sectionSpec)
    .addToEnd("button", buttonSpec)
    .addToEnd("card", cardSpec)
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

/** Step 3 — `doc.content` becomes `section+` so paragraphs can't be
 *  inserted at the root. Run after section is in the schema. */
function requireSectionRoot(schema: Schema): Schema {
  const docSpec = schema.spec.nodes.get("doc");
  if (!docSpec) return schema;
  const nodes = schema.spec.nodes.update("doc", {
    ...docSpec,
    content: "section+",
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
  const withSectionRoot = requireSectionRoot(withTextAttrs);
  // Shuffle adds the `container` + `row` block-group nodes here. Containment
  // MUST run after it: otherwise `container`/`row` never get
  // `containedBy: "section"`, so dragging one isn't constrained to its
  // section — the drop escapes and PM wraps it in a brand-new section. Running
  // containment last stamps every block-group node (the originals AND
  // shuffle's container/row). `augmentLayoutBlockAttrs` (alignContent on
  // row/container) then runs after, preserving the containment.
  const withShuffle = addShuffleNodes(withSectionRoot, "block+", "block");
  const withContainment = constrainBlocksToSection(withShuffle);
  return augmentLayoutBlockAttrs(withContainment);
}

/** Step 5 — adds `alignContent` attr to row + container so the
 *  BlockSettings popover can edit how children are aligned inside
 *  them. The visual class (`pp-align-content-*`) is added at render
 *  time by `attrClassesPlugin`. */
function augmentLayoutBlockAttrs(schema: Schema): Schema {
  let nodes = schema.spec.nodes;
  for (const name of ["row", "container"] as const) {
    const spec = nodes.get(name);
    if (!spec) continue;
    nodes = nodes.update(name, {
      ...spec,
      attrs: {
        ...spec.attrs,
        alignContent: { default: "middle" as AlignContent },
      },
    });
  }
  return new Schema({ nodes, marks: schema.spec.marks });
}

/** Signature for the function that builds the initial doc from the
 *  finished schema. Used by `PageBuilderEditor`. */
export type InitialDocBuilder = (schema: Schema) => PmNode;
