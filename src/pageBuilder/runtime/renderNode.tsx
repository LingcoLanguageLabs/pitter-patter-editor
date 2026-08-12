/**
 * The runtime walker: PM document JSON → React, WITHOUT ProseMirror.
 *
 * This is the analog of pagy.co's `renderSlate` — the single renderer the
 * published site (SSR), the preview, and thumbnails can all share, so what
 * a visitor sees is what the editor showed. Each node maps to the same
 * markup its schema `toDOM` produces, PLUS the two class sources the editor
 * applies as decorations: `attrClasses` (pp-* utility classes) and
 * `shuffleLayout` (the grid column/row classes + style). Interactive blocks
 * (button, video, audio) are real React elements, so they stay interactive
 * once hydrated — that's why this returns React, not an HTML string.
 *
 * Consumes plain JSON (`JsonNode`), not live PM nodes, so it has no schema
 * dependency at render time — feed it `doc.toJSON()` (or stored content).
 */

import {
  createElement,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { getItemDefinition, isInlineItemNode } from "../items/registry";
import { useGrading, type GradeScope } from "../items/shared/grading";
import { useNavAction } from "./siteNav";
import {
  BlockRendererProvider,
  type RenderBlocks,
} from "../items/shared/blockRenderer";
import { useInlineItemRenderer } from "../items/shared/inlineItems";
import { renderInline } from "../items/shared/renderInline";
import type { ItemDefinition } from "../items/types";
import {
  attrClasses,
  blockOpacity,
  stackClasses,
  tableClasses,
  widthLimits,
} from "../attrClassesPlugin";
import { EMBED_ALLOW, toEmbedUrl } from "../embed";
import { isSvgMarkup, sanitizeSvg } from "../svg";
import { ProgressIndicator } from "../ProgressIndicator";
import {
  blockMarginClass,
  blockMarginValue,
  footerClass,
  headerClass,
  sectionPaddingClass,
  sectionPaddingPx,
} from "../spacing";
import { RenderText } from "./renderMarks";
import { shuffleLayout, type JsonNode } from "./shuffleLayout";


// ── Helpers ──────────────────────────────────────────────────────────
function cx(...parts: (string | string[] | false | undefined)[]): string {
  return parts.flat().filter(Boolean).join(" ");
}

/** First heading's text within a JSON subtree (depth-first) — the default name
 *  for a section that carries no explicit layer `name`. */
function firstHeadingText(node: JsonNode): string {
  if (node.type === "heading") {
    return (node.content ?? []).map((c) => c.text ?? "").join("").trim();
  }
  for (const child of node.content ?? []) {
    const t = firstHeadingText(child);
    if (t) return t;
  }
  return "";
}

/** A section's display name for `{{section.name}}`: its explicit layer `name`,
 *  else its first heading, else "Section" (mirrors `listSections`). Stamped onto
 *  the rendered section as `data-section-name` so the in-view tracker in
 *  `SiteRenderer` can read it even for sections with no `htmlId` (which emit no
 *  `id`). */
function sectionDisplayName(node: JsonNode): string {
  const explicit = ((node.attrs?.["name"] as string) || "").trim();
  return explicit || firstHeadingText(node) || "Section";
}

/** Base class(es) + attr classes + shuffle layout, merged like the editor. */
function layoutProps(
  node: JsonNode,
  index: number,
  base: (string | false | undefined)[] = [],
): { className: string; style: CSSProperties } {
  const layout = shuffleLayout(node, index);
  // Top-margin rides along as a Tailwind-style `mt-{unit}` class, exactly as
  // `attrClassesPlugin` decorates it in the editor. Only an explicit value
  // (incl 0) emits a class; Auto (null) emits none (per-context CSS default).
  const margin = blockMarginValue(node.attrs);
  // Opacity (visual blocks only) rides as the `--pp-bg-opacity` custom property,
  // mirroring the editor's decoration. The block's CSS reads it to fade only the
  // background (fill / media) — never the content — so text stays readable.
  const opacity = blockOpacity(node.attrs ?? {});
  // Optional px width clamps (any block) ride as min/max-width.
  const { minW, maxW } = widthLimits(node.attrs ?? {});
  const style: CSSProperties = { ...layout.style };
  if (opacity != null)
    (style as Record<string, unknown>)["--pp-bg-opacity"] = opacity;
  if (minW > 0) style.minWidth = `${minW}px`;
  if (maxW > 0) style.maxWidth = `${maxW}px`;
  return {
    className: cx(
      base.filter(Boolean) as string[],
      attrClasses(node.attrs ?? {}),
      margin != null ? blockMarginClass(margin) : "",
      layout.className,
    ),
    style,
  };
}

/** Render a node's children, threading sibling index (drives `grid-row`). */
function renderChildren(node: JsonNode): ReactNode[] {
  return (node.content ?? []).map((child, i) => (
    <RenderNode key={i} node={child} index={i} />
  ));
}

const str = (v: unknown, fallback = ""): string =>
  v == null || v === "" ? fallback : String(v);

/** The `lang` attribute for a block, when its Language attr is set. Spread onto
 *  the rendered element so screen readers / hyphenation / spellcheck switch for
 *  the whole block; descendants inherit it. Empty/unset (and media blocks, which
 *  carry no `lang` attr) → no attribute. Mirrors the editor's `lang` decoration
 *  in `attrClassesPlugin`. */
function langProps(attrs: Record<string, unknown>): { lang?: string } {
  const lang = attrs["lang"];
  return typeof lang === "string" && lang ? { lang } : {};
}

// ── The walker ───────────────────────────────────────────────────────
export function RenderNode({
  node,
  index,
}: {
  node: JsonNode;
  index: number;
}): ReactNode {
  // Inline item nodes (e.g. a Fill Blanks `blank`) are delegated to the
  // enclosing completer's inline renderer so they get its response state; no
  // provider (static preview) → a plain gap. Hook stays before any early return.
  const renderInlineItem = useInlineItemRenderer();
  const a = node.attrs ?? {};

  // Learning items render via their own standalone completer (its own state +
  // dnd-kit), decoupled from this walker: serialize the node to a typed def and
  // hand it off. The item's child nodes never reach the walker.
  const itemDef = getItemDefinition(node.type);
  if (itemDef) {
    return <ItemCompleterHost def={itemDef} node={node} index={index} />;
  }

  if (isInlineItemNode(node.type)) {
    return renderInlineItem ? (
      <>{renderInlineItem(node)}</>
    ) : (
      <span className="pp-blank-static" />
    );
  }

  switch (node.type) {
    case "text":
      return <RenderText node={node} />;

    case "hard_break":
      return <br />;

    case "paragraph": {
      const { className, style } = layoutProps(node, index);
      return (
        <p className={className} style={style} {...langProps(a)}>
          {renderChildren(node)}
        </p>
      );
    }

    case "heading": {
      const level = (a["level"] as number) || 1;
      const { className, style } = layoutProps(node, index);
      return createElement(
        `h${level}`,
        { className, style, ...langProps(a) },
        renderChildren(node),
      );
    }

    case "button":
      return <SiteButton node={node} index={index} />;

    case "image":
      return <SiteImage node={node} index={index} />;

    case "video": {
      const { className, style } = layoutProps(node, index, ["pb-video"]);
      const src = str(a["src"]);
      return (
        <figure
          className={className}
          style={style}
          data-node-type="video"
          data-radius={str(a["radius"], "medium")}
          data-frame={str(a["frame"])}
        >
          {src ? (
            <video
              src={src}
              poster={str(a["poster"]) || undefined}
              controls={!!a["controls"]}
              autoPlay={!!a["autoplay"]}
              muted={!!a["muted"] || !!a["autoplay"]}
              loop={!!a["loop"]}
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="pb-media-placeholder" />
          )}
        </figure>
      );
    }

    case "audio": {
      const { className, style } = layoutProps(node, index, ["pb-audio"]);
      return (
        <figure className={className} style={style} data-node-type="audio">
          <audio src={str(a["src"]) || undefined} controls preload="metadata" />
        </figure>
      );
    }

    case "embed": {
      const { className, style } = layoutProps(node, index, ["pb-embed"]);
      const src = str(a["src"]);
      return (
        <figure
          className={className}
          style={style}
          data-node-type="embed"
          data-aspect={str(a["aspect"], "16/9")}
          data-radius={str(a["radius"], "medium")}
          data-frame={str(a["frame"])}
        >
          {src ? (
            <iframe
              src={toEmbedUrl(src)}
              title={str(a["title"]) || "Embedded content"}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow={EMBED_ALLOW}
              allowFullScreen
            />
          ) : (
            <div className="pb-media-placeholder" />
          )}
        </figure>
      );
    }

    case "vector":
      return <SiteVector node={node} index={index} />;

    case "divider": {
      const { className, style } = layoutProps(node, index, ["pb-divider"]);
      return (
        <hr
          className={className}
          style={style}
          data-node-type="divider"
          data-variant={str(a["variant"], "solid")}
        />
      );
    }

    case "progress": {
      const { className, style } = layoutProps(node, index, ["pb-progress"]);
      return (
        <figure
          className={className}
          style={style}
          data-node-type="progress"
          data-display={str(a["display"], "bar")}
          data-color={str(a["color"], "primary")}
        >
          <ProgressIndicator attrs={a} />
        </figure>
      );
    }

    case "accordion":
      return <SiteAccordion node={node} index={index} />;

    case "tabs":
      return <SiteTabs node={node} index={index} />;

    case "table": {
      // The grid item is a scroll wrapper (so a wide table scrolls instead of
      // breaking the layout — matches the mobile model); the table fills it.
      const { className, style } = layoutProps(node, index, [
        "pb-table",
        ...tableClasses(a),
      ]);
      return (
        <div className={className} style={style} data-node-type="table">
          <table>
            <tbody>{renderChildren(node)}</tbody>
          </table>
        </div>
      );
    }

    case "table_row":
      return <tr>{renderChildren(node)}</tr>;

    case "table_cell": {
      const p = tableCellProps(a);
      return <td {...p}>{renderChildren(node)}</td>;
    }

    case "table_header": {
      const p = tableCellProps(a);
      return <th {...p}>{renderChildren(node)}</th>;
    }

    case "card": {
      const image = str(a["image"]);
      // `theme -X` (default included) re-establishes the card's own palette,
      // self-contained regardless of the section it sits in — mirrors section.
      const cardTheme = str(a["theme"]);
      const { className, style } = layoutProps(node, index, [
        "pp-card",
        `theme -${cardTheme || "default"}`,
      ]);
      // The bg image rides as a custom property so it paints on the `::before`
      // background layer (a pseudo can't read the element's `background-image`),
      // letting `--pp-bg-opacity` fade color + image together without touching
      // the content.
      const mergedStyle: CSSProperties = image
        ? ({ ...style, "--pp-card-image": `url("${image}")` } as CSSProperties)
        : style;
      return (
        <div
          className={className}
          style={mergedStyle}
          data-node-type="card"
          data-padding={str(a["padding"], "m")}
          data-radius={str(a["radius"], "large")}
          {...(cardTheme ? { "data-theme": cardTheme } : {})}
          {...(a["overlay"] ? { "data-overlay": str(a["overlay"]) } : {})}
          {...langProps(a)}
        >
          {renderChildren(node)}
        </div>
      );
    }

    case "container": {
      const { className, style } = layoutProps(node, index, [
        "container",
        ...stackClasses(a),
      ]);
      return (
        <div
          className={className}
          style={style}
          data-node-type="shuffle-container"
          {...langProps(a)}
        >
          {renderChildren(node)}
        </div>
      );
    }

    case "row": {
      const { className, style } = layoutProps(node, index, [
        "shuffle-block",
        "row",
        "start-left",
        "end-right",
      ]);
      return (
        <div
          className={className}
          style={style}
          data-node-type="shuffle-row"
          {...langProps(a)}
        >
          {renderChildren(node)}
        </div>
      );
    }

    case "section": {
      const theme = a["theme"] as string | null;
      // Padding is the `py-{unit}` class, identical to the editor's NodeView.
      const { className, style } = layoutProps(node, index, [
        "pp-section",
        sectionPaddingClass(sectionPaddingPx(a)),
        theme ? `theme -${theme}` : "",
      ]);
      const minHeight = str(a["minHeight"], "none");
      const contentAlign = str(a["contentAlign"], "top");
      const background = str(a["background"], "solid");
      return (
        <section
          className={className}
          style={style}
          data-node-type="section"
          data-section-name={sectionDisplayName(node)}
          {...(theme ? { "data-theme": theme } : {})}
          {...(minHeight !== "none" ? { "data-min-height": minHeight } : {})}
          {...(contentAlign !== "top" ? { "data-content-align": contentAlign } : {})}
          {...(background !== "solid" ? { "data-background": background } : {})}
          {...(a["image"] ? { "data-image": str(a["image"]) } : {})}
          {...(a["video"] ? { "data-video": str(a["video"]) } : {})}
          {...(a["overlay"] ? { "data-overlay": str(a["overlay"]) } : {})}
          {...(a["htmlId"] ? { id: str(a["htmlId"]) } : {})}
          {...langProps(a)}
        >
          {renderChildren(node)}
        </section>
      );
    }

    case "header":
      return <SiteHeader node={node} index={index} />;

    case "footer": {
      const { className, style } = layoutProps(node, index, [footerClass(a)]);
      return (
        <footer
          className={className}
          style={style}
          data-node-type="footer"
          {...(a["fixed"] ? { "data-fixed": "true" } : {})}
          {...(a["theme"] ? { "data-theme": str(a["theme"]) } : {})}
        >
          {renderChildren(node)}
        </footer>
      );
    }

    case "page":
      // The active page; header (if any), sections, then footer (if any).
      return (
        <div className="pb-page" data-active data-node-type="page">
          {renderChildren(node)}
        </div>
      );

    default:
      // Unknown node: render its children so we degrade gracefully.
      return <>{renderChildren(node)}</>;
  }
}

/** Item block host — keeps the item in the shuffle grid (same layout classes as
 *  any block) while delegating the inside to the type's standalone `Completer`.
 *  The completer is pure React over the serialized def; this walker neither
 *  knows nor cares how it renders or grades. */
function ItemCompleterHost({
  def,
  node,
  index,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def: ItemDefinition<any>;
  node: JsonNode;
  index: number;
}) {
  const { className, style } = layoutProps(node, index, [
    "pp-item",
    `pp-item--${node.type}`,
  ]);
  const data = useMemo(() => def.serialize(node), [def, node]);
  const Completer = def.Completer;
  return (
    <div
      className={className}
      style={style}
      data-node-type={node.type}
      {...langProps(node.attrs ?? {})}
    >
      {/* Give the completer the shared block walker so an item's stem (images,
          audio, …) renders exactly like the rest of the site. */}
      <BlockRendererProvider value={renderItemBlocks}>
        <Completer def={data} />
      </BlockRendererProvider>
    </div>
  );
}

/** Renders an item stem's content blocks via the same walker the site uses. */
const renderItemBlocks: RenderBlocks = (blocks) =>
  blocks.map((b, i) => <RenderNode key={i} node={b} index={i} />);

/** Header — interactive in site mode. On phones the inline nav is hidden by the
 *  `.pb-site` phone container query and replaced by a brand + burger bar; the
 *  burger toggles `data-open`, revealing a dropdown that re-renders the same
 *  content stacked. All show/hide is CSS — this only owns the open state and the
 *  two extra elements (burger + dropdown). The editor's PM `HeaderNodeView`
 *  renders neither, so authoring stays inline + editable. */
function SiteHeader({ node, index }: { node: JsonNode; index: number }) {
  const a = node.attrs ?? {};
  const [open, setOpen] = useState(false);
  // Same class chain the editor NodeView + schema toDOM emit, so the published
  // bar matches the canvas exactly.
  const { className, style } = layoutProps(node, index, [headerClass(a)]);

  // Close on Escape while open. The dropdown is a light overlay (not full
  // screen), so there's no body-scroll lock to manage.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={className}
      style={style}
      data-node-type="header"
      {...(open ? { "data-open": "true" } : {})}
      {...(a["fixed"] ? { "data-fixed": "true" } : {})}
      {...(a["theme"] ? { "data-theme": str(a["theme"]) } : {})}
      {...(a["background"] ? { "data-background": str(a["background"]) } : {})}
    >
      {renderChildren(node)}
      <button
        type="button"
        className="pp-header-burger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pp-header-burger-line" />
        <span className="pp-header-burger-line" />
      </button>
      {/* The dropdown re-renders the same content stacked; clicking any link or
          button inside it (incl. a deck-page nav) closes the menu, like pagy. */}
      <div
        className="pp-header-mobile"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button")) setOpen(false);
        }}
      >
        {renderChildren(node)}
      </div>
    </header>
  );
}

/** Button — interactive in site mode. A URL action navigates natively (new tab
 *  when flagged); every other action is a deck/section move handed off to
 *  `SiteNavProvider`. */
function SiteButton({ node, index }: { node: JsonNode; index: number }) {
  const a = node.attrs ?? {};
  const variant = str(a["variant"], "primary");
  const openInNewTab = !!a["openInNewTab"];
  // Action (url / page / prev / next / section) → href + click + disabled,
  // shared with the runtime text link so both behave identically.
  const { action, href, disabled, onClick: navOnClick } = useNavAction(a);
  // The "check" action grades a scope of prompts via the grading store, instead
  // of navigating. (Hook runs unconditionally; only used when action="check".)
  const grading = useGrading();
  const onClick =
    action === "check"
      ? (e: { preventDefault: () => void }) => {
          e.preventDefault();
          grading?.gradeScope(
            str(a["checkScope"]) as GradeScope,
            str(a["checkTargetId"]),
          );
        }
      : navOnClick;
  // "Hide" disabled behavior: a prev/next button that dead-ends at the deck edge
  // is removed from the page entirely rather than dimmed (author's choice).
  // Checked after the hooks above so the hook order stays stable across renders.
  if (disabled && str(a["whenDisabled"]) === "hide") return null;
  const { className, style } = layoutProps(node, index, [
    "pp-button",
    `pp-button--${variant}`,
  ]);
  return (
    <a
      href={href}
      className={className}
      style={style}
      data-node-type="button"
      data-variant={variant}
      {...langProps(a)}
      {...(action !== "url" ? { "data-action": action } : {})}
      {...(disabled ? { "aria-disabled": true } : {})}
      {...(openInNewTab && action === "url"
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      onClick={onClick}
    >
      {str(a["label"], "Button")}
    </a>
  );
}

/** Vector block — inline author-pasted SVG (or an `<img>` when only a URL is
 *  set). Mirrors the editor's `VectorNodeView`: a `.pb-vector` figure carrying
 *  the shuffle layout + the `--pb-vector-width` % + the optional `pp-text -X`
 *  recolor class, wrapping a `.pb-vector-media` that holds the sanitized inline
 *  SVG (so it scales crisply and inherits `currentColor` when recolored). */
function SiteVector({ node, index }: { node: JsonNode; index: number }) {
  const a = node.attrs ?? {};
  const markup = str(a["markup"]);
  const src = str(a["src"]);
  const tint = str(a["tint"]);
  const width = typeof a["width"] === "number" ? (a["width"] as number) : 100;
  const { className, style } = layoutProps(node, index, [
    "pb-vector",
    tint ? `pp-text -${tint}` : "",
  ]);
  // Width % rides on the media element (mirrors the editor's VectorNodeView).
  const mediaStyle: CSSProperties = { width: `${width}%` };
  const svg = isSvgMarkup(markup) ? sanitizeSvg(markup) : "";
  return (
    <figure
      className={className}
      style={style}
      data-node-type="vector"
      data-align={str(a["align"], "center")}
      {...(tint ? { "data-recolor": "true" } : {})}
    >
      {svg ? (
        <div
          className="pb-vector-media"
          style={mediaStyle}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : src ? (
        <div className="pb-vector-media" style={mediaStyle}>
          <img src={str(a["src"])} alt={str(a["alt"])} />
        </div>
      ) : (
        <div className="pb-media-placeholder" />
      )}
    </figure>
  );
}

/** Cell colspan/rowspan/width → DOM props. `colwidth` (prosemirror-tables) is a
 *  per-column px array; the first entry sizes a single-span cell, preserving the
 *  author's column resize on the published site. */
function tableCellProps(a: Record<string, unknown>): {
  colSpan?: number;
  rowSpan?: number;
  style?: CSSProperties;
} {
  const colspan = typeof a["colspan"] === "number" ? (a["colspan"] as number) : 1;
  const rowspan = typeof a["rowspan"] === "number" ? (a["rowspan"] as number) : 1;
  const colwidth = a["colwidth"];
  const width =
    Array.isArray(colwidth) && typeof colwidth[0] === "number" ? colwidth[0] : null;
  return {
    colSpan: colspan > 1 ? colspan : undefined,
    rowSpan: rowspan > 1 ? rowspan : undefined,
    style: width ? { width: `${width}px` } : undefined,
  };
}

/** Accordion — interactive on the published site: each header toggles its panel.
 *  `allowMultiple` lets several stay open; otherwise opening one closes the rest.
 *  Initial open state comes from each row's `open` attr. The builder shows every
 *  panel open (editing); this is the runtime collapse. */
function SiteAccordion({ node, index }: { node: JsonNode; index: number }) {
  const a = node.attrs ?? {};
  const allowMultiple = !!a["allowMultiple"];
  const items = (node.content ?? []).filter((c) => c.type === "accordion_item");
  const [open, setOpen] = useState<Set<number>>(
    () => new Set(items.flatMap((it, i) => (it.attrs?.["open"] ? [i] : []))),
  );
  const { className, style } = layoutProps(node, index, ["pb-accordion"]);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const isOpen = prev.has(i);
      if (allowMultiple) {
        const next = new Set(prev);
        if (isOpen) next.delete(i);
        else next.add(i);
        return next;
      }
      return isOpen ? new Set() : new Set([i]);
    });
  return (
    <div className={className} style={style} data-node-type="accordion">
      {items.map((item, i) => {
        const header = (item.content ?? []).find(
          (c) => c.type === "accordion_header",
        );
        const panel = (item.content ?? []).find(
          (c) => c.type === "accordion_panel",
        );
        const isOpen = open.has(i);
        return (
          <div
            key={i}
            className="pb-accordion-item"
            {...(isOpen ? { "data-open": "true" } : {})}
          >
            <button
              type="button"
              className="pb-accordion-header"
              aria-expanded={isOpen}
              onClick={() => toggle(i)}
            >
              <span className="pb-accordion-caret" aria-hidden />
              <span className="pb-accordion-header-text">
                {header ? renderChildren(header) : null}
              </span>
            </button>
            <div className="pb-accordion-panel" hidden={!isOpen}>
              <div className="pb-accordion-panel-content">
                {panel ? renderChildren(panel) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Tabs — interactive on the published site: a label strip + the active panel.
 *  `active` seeds the initial tab. The builder shows panels stacked (editing). */
function SiteTabs({ node, index }: { node: JsonNode; index: number }) {
  const a = node.attrs ?? {};
  const tabs = (node.content ?? []).filter((c) => c.type === "tab");
  const initial =
    typeof a["active"] === "number" ? (a["active"] as number) : 0;
  const [active, setActive] = useState(() =>
    Math.min(Math.max(0, initial), Math.max(0, tabs.length - 1)),
  );
  const { className, style } = layoutProps(node, index, ["pb-tabs"]);
  return (
    <div className={className} style={style} data-node-type="tabs">
      <div className="pb-tabs-list" role="tablist">
        {tabs.map((tab, i) => {
          const label = (tab.content ?? []).find((c) => c.type === "tab_label");
          return (
            <button
              key={i}
              type="button"
              role="tab"
              className="pb-tab-label"
              {...(i === active ? { "data-active": "true" } : {})}
              aria-selected={i === active}
              onClick={() => setActive(i)}
            >
              {label ? renderChildren(label) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, i) => {
        const panel = (tab.content ?? []).find((c) => c.type === "tab_panel");
        return (
          <div
            key={i}
            role="tabpanel"
            className="pb-tab-panel"
            hidden={i !== active}
          >
            {panel ? renderChildren(panel) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Image block — interactive in site mode. Same structure as the editor's
 *  ImageNodeView (a full-footprint `figure` carrying the shuffle layout +
 *  `pp-align-*`, wrapping a `.pb-image-media` that sizes/frames the image). When
 *  the image carries a link action, the media is wrapped in an `<a>` resolved by
 *  `useNavAction` — the SAME resolver buttons + text links use — so a click
 *  opens a URL or moves the deck/section. A plain figure otherwise. */
function SiteImage({ node, index }: { node: JsonNode; index: number }) {
  const a = node.attrs ?? {};
  const width = a["width"];
  // Pinned images leave the shuffle grid and position absolutely within their
  // section (`.pp-section` is `position: relative`), layered above flow content
  // — the decorative-overlap / free-placement mode. x/y/w are % of the section.
  const pinned = a["position"] === "pinned";
  const { minW: pinMinW, maxW: pinMaxW } = widthLimits(a);
  const { className, style } = pinned
    ? {
        className: cx(["pb-image", "pb-image--pinned"], attrClasses(a)),
        style: {
          position: "absolute",
          left: `${Number(a["pinX"] ?? 50)}%`,
          top: `${Number(a["pinY"] ?? 50)}%`,
          width: `${Number(a["pinW"] ?? 40)}%`,
          ...(pinMinW > 0 ? { minWidth: `${pinMinW}px` } : {}),
          ...(pinMaxW > 0 ? { maxWidth: `${pinMaxW}px` } : {}),
          zIndex: 5,
        } as CSSProperties,
      }
    : layoutProps(node, index, ["pb-image"]);
  const mediaStyle: CSSProperties | undefined =
    !pinned && typeof width === "number"
      ? ({ "--pb-image-width": `${width}%` } as CSSProperties)
      : undefined;
  const action = str(a["action"], "none");
  const openInNewTab = !!a["openInNewTab"];
  // Hook must run unconditionally; only its result is used when linked.
  const { href, disabled, onClick } = useNavAction(a);
  // "Linked" only when there's a real target — an empty URL / unset page or
  // section stays a plain (non-clickable) image.
  const hasTarget =
    action === "url"
      ? !!str(a["href"])
      : action === "page"
        ? !!str(a["pageId"])
        : action === "section"
          ? !!str(a["sectionId"])
          : action === "prevPage" || action === "nextPage";
  const linked = action !== "none" && hasTarget;

  const media = (
    <div className="pb-image-media" style={mediaStyle}>
      <img src={str(a["src"])} alt={str(a["alt"])} />
    </div>
  );
  // Rich caption — the image_caption child's inline content (rendered with the
  // shared inline renderer, so marks + {{ }} work). Empty → no figcaption.
  // Alignment rides as the same `pp-align-*` class as paragraph/heading.
  const captionNode = (node.content ?? []).find((c) => c.type === "image_caption");
  const captionContent = captionNode?.content ?? [];
  const captionClass = cx(["pb-image-caption"], attrClasses(captionNode?.attrs ?? {}));

  return (
    <figure
      className={className}
      style={style}
      data-node-type="image"
      data-aspect={str(a["aspect"], "16/9")}
      data-shape={str(a["shape"])}
      data-radius={str(a["radius"], "medium")}
      data-frame={str(a["frame"])}
      data-align={str(a["align"], "center")}
      {...(linked ? { "data-linked": "true" } : {})}
    >
      {linked ? (
        <a
          className="pb-image-link"
          href={href}
          onClick={onClick}
          {...(action !== "url" ? { "data-action": action } : {})}
          {...(disabled ? { "aria-disabled": true } : {})}
          {...(openInNewTab && action === "url"
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {media}
        </a>
      ) : (
        media
      )}
      {captionContent.length > 0 && (
        <figcaption className={captionClass}>
          {renderInline(captionContent)}
        </figcaption>
      )}
    </figure>
  );
}
