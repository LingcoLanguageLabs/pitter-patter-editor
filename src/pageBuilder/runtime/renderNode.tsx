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
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { attrClasses, stackClasses } from "../attrClassesPlugin";
import {
  blockMarginClass,
  blockMarginValue,
  footerClass,
  headerClass,
  sectionPaddingClass,
  sectionPaddingPx,
} from "../spacing";
import { renderText } from "./renderMarks";
import { shuffleLayout, type JsonNode } from "./shuffleLayout";

// ── Navigation: deck-page links switch the rendered page ─────────────
interface SiteNav {
  navigate: (pageId: string) => void;
}
const SiteNavContext = createContext<SiteNav | null>(null);

export function SiteNavProvider({
  navigate,
  children,
}: {
  navigate: (pageId: string) => void;
  children: ReactNode;
}) {
  return (
    <SiteNavContext.Provider value={{ navigate }}>
      {children}
    </SiteNavContext.Provider>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function cx(...parts: (string | string[] | false | undefined)[]): string {
  return parts.flat().filter(Boolean).join(" ");
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
  return {
    className: cx(
      base.filter(Boolean) as string[],
      attrClasses(node.attrs ?? {}),
      margin != null ? blockMarginClass(margin) : "",
      layout.className,
    ),
    style: layout.style,
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

// ── The walker ───────────────────────────────────────────────────────
export function RenderNode({
  node,
  index,
}: {
  node: JsonNode;
  index: number;
}): ReactNode {
  const a = node.attrs ?? {};

  switch (node.type) {
    case "text":
      return renderText(node);

    case "hard_break":
      return <br />;

    case "paragraph": {
      const { className, style } = layoutProps(node, index);
      return (
        <p className={className} style={style}>
          {renderChildren(node)}
        </p>
      );
    }

    case "heading": {
      const level = (a["level"] as number) || 1;
      const { className, style } = layoutProps(node, index);
      return createElement(
        `h${level}`,
        { className, style },
        renderChildren(node),
      );
    }

    case "button":
      return <SiteButton node={node} index={index} />;

    case "image": {
      const { className, style } = layoutProps(node, index, ["pb-image"]);
      // Same structure as the editor's ImageNodeView: a full-footprint figure
      // (carries the shuffle layout + `pp-align-*` from `attrClasses`) wrapping
      // a `.pb-image-media` that sizes (the `--pb-image-width` var) and frames
      // the image. Full width (null) needs no var.
      const width = a["width"];
      const mediaStyle: CSSProperties | undefined =
        typeof width === "number"
          ? ({ "--pb-image-width": `${width}%` } as CSSProperties)
          : undefined;
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
        >
          <div className="pb-image-media" style={mediaStyle}>
            <img src={str(a["src"])} alt={str(a["alt"])} />
          </div>
        </figure>
      );
    }

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

    case "card": {
      const image = str(a["image"]);
      // `theme -X` (default included) re-establishes the card's own palette,
      // self-contained regardless of the section it sits in — mirrors section.
      const cardTheme = str(a["theme"]);
      const { className, style } = layoutProps(node, index, [
        "pp-card",
        `theme -${cardTheme || "default"}`,
      ]);
      const mergedStyle: CSSProperties = image
        ? { ...style, backgroundImage: `url("${image}")` }
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
        <div className={className} style={style} data-node-type="shuffle-row">
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
          {...(theme ? { "data-theme": theme } : {})}
          {...(minHeight !== "none" ? { "data-min-height": minHeight } : {})}
          {...(contentAlign !== "top" ? { "data-content-align": contentAlign } : {})}
          {...(background !== "solid" ? { "data-background": background } : {})}
          {...(a["image"] ? { "data-image": str(a["image"]) } : {})}
          {...(a["video"] ? { "data-video": str(a["video"]) } : {})}
          {...(a["overlay"] ? { "data-overlay": str(a["overlay"]) } : {})}
          {...(a["htmlId"] ? { id: str(a["htmlId"]) } : {})}
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

/** Button — interactive in site mode. URL links navigate natively (new tab
 *  when flagged); deck-page links hand off to `SiteNavProvider`. */
function SiteButton({ node, index }: { node: JsonNode; index: number }) {
  const a = node.attrs ?? {};
  const nav = useContext(SiteNavContext);
  const variant = str(a["variant"], "primary");
  const linkType = a["linkType"] === "page" ? "page" : "url";
  const pageId = str(a["pageId"]);
  const openInNewTab = !!a["openInNewTab"];
  const href = linkType === "page" ? "#" : str(a["href"], "#");
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
      {...(linkType === "page"
        ? { "data-link-type": "page", "data-page-id": pageId }
        : {})}
      {...(openInNewTab && linkType === "url"
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      onClick={
        linkType === "page"
          ? (e) => {
              e.preventDefault();
              if (pageId) nav?.navigate(pageId);
            }
          : undefined
      }
    >
      {str(a["label"], "Button")}
    </a>
  );
}
