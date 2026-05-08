/**
 * Pages — Word/Docs-style pagination as decoration.
 *
 * The editor doc remains a single continuous flow. Pagination is
 * implemented as a widget decoration at pos 0 that renders N "page
 * break" stripes using the float-and-clear trick: each stripe is
 * `float: left; clear: both;` with a `marginTop` equal to one page's
 * content area height. Stripes accumulate vertically at fixed offsets,
 * carving the editor's continuous content into visual page boundaries.
 * Headers and footers are rendered in the stripes as overlay bands.
 *
 * Phases implemented:
 *   1. Page boundaries + manual page break (see PageBreak.tsx)
 *   2. Static header/footer with page-number / total-pages tokens
 *   3. Click-to-edit nested editor with first/odd/even variants
 */

import { Selection as PMSelection } from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { keymap as pmKeymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo as historyRedo, undo as historyUndo } from "prosemirror-history";
import { DOMParser as PMDOMParser, DOMSerializer, Schema, type MarkSpec, type Node, type NodeSpec } from "prosemirror-model";
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Extension } from "../types";

// ───────────────────────────────────────────── Page formats

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageFormat {
  width: number;
  height: number;
  margins: PageMargins;
}

/**
 * Page sizes in CSS pixels at 96dpi (the rendering DPI of a browser).
 *  • A4   = 210 × 297 mm  ≈ 794 × 1123 px
 *  • Letter = 8.5 × 11 in = 816 × 1056 px
 *  • Legal  = 8.5 × 14 in = 816 × 1344 px
 *  • A3   = 297 × 420 mm  ≈ 1123 × 1587 px
 *  • A5   = 148 × 210 mm  ≈ 559 × 794 px
 */
const DEFAULT_MARGINS: PageMargins = { top: 96, right: 96, bottom: 96, left: 96 };

export const PAGE_FORMATS: Record<string, PageFormat> = {
  A4: { width: 794, height: 1123, margins: DEFAULT_MARGINS },
  Letter: { width: 816, height: 1056, margins: DEFAULT_MARGINS },
  Legal: { width: 816, height: 1344, margins: DEFAULT_MARGINS },
  A3: { width: 1123, height: 1587, margins: DEFAULT_MARGINS },
  A5: {
    width: 559,
    height: 794,
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
  },
};

export type PageFormatName = keyof typeof PAGE_FORMATS;

// ───────────────────────────────────────────── Header/footer schema

/**
 * Tiny ProseMirror schema used by the nested header/footer editors.
 * Deliberately minimal — paragraphs with text alignment, basic marks,
 * and two atom tokens that get substituted per-page at render time.
 */
const HEADER_FOOTER_SCHEMA = new Schema({
  nodes: {
    doc: { content: "paragraph+" } as NodeSpec,
    paragraph: {
      content: "inline*",
      group: "block",
      attrs: { align: { default: null } },
      parseDOM: [
        {
          tag: "p",
          getAttrs(dom) {
            if (!(dom instanceof HTMLElement)) return null;
            const align = dom.style.textAlign || null;
            return { align: align || null };
          },
        },
      ],
      toDOM(node) {
        const align = node.attrs["align"] as string | null;
        return ["p", align ? { style: `text-align: ${align}` } : {}, 0];
      },
    } as NodeSpec,
    page_number_token: {
      inline: true,
      group: "inline",
      atom: true,
      selectable: true,
      parseDOM: [{ tag: "span[data-pp-token=pageNumber]" }],
      toDOM: () => [
        "span",
        {
          class: "pp-token pp-token-page-number",
          "data-pp-token": "pageNumber",
        },
        "{{PAGE_NUMBER}}",
      ],
    } as NodeSpec,
    total_pages_token: {
      inline: true,
      group: "inline",
      atom: true,
      selectable: true,
      parseDOM: [{ tag: "span[data-pp-token=totalPages]" }],
      toDOM: () => [
        "span",
        {
          class: "pp-token pp-token-total-pages",
          "data-pp-token": "totalPages",
        },
        "{{TOTAL_PAGES}}",
      ],
    } as NodeSpec,
    text: { group: "inline" } as NodeSpec,
  },
  marks: {
    bold: {
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
      toDOM: () => ["strong", 0],
    } as MarkSpec,
    italic: {
      parseDOM: [{ tag: "em" }, { tag: "i" }],
      toDOM: () => ["em", 0],
    } as MarkSpec,
    underline: {
      parseDOM: [{ tag: "u" }],
      toDOM: () => ["u", 0],
    } as MarkSpec,
  },
});

const HEADER_FOOTER_SERIALIZER = DOMSerializer.fromSchema(HEADER_FOOTER_SCHEMA);

function emptyHeaderDoc(): unknown {
  return HEADER_FOOTER_SCHEMA.node("doc", null, [
    HEADER_FOOTER_SCHEMA.node("paragraph", null, []),
  ]).toJSON();
}

function jsonOrEmpty(json: unknown): unknown {
  if (json && typeof json === "object") return json;
  return emptyHeaderDoc();
}

function nodeFromJSON(json: unknown): Node {
  try {
    return HEADER_FOOTER_SCHEMA.nodeFromJSON(jsonOrEmpty(json));
  } catch {
    return HEADER_FOOTER_SCHEMA.nodeFromJSON(emptyHeaderDoc());
  }
}

function jsonToHTML(json: unknown): string {
  if (!json) return "";
  const node = nodeFromJSON(json);
  if (!node || node.content.size === 0) return "";
  const fragment = HEADER_FOOTER_SERIALIZER.serializeFragment(node.content);
  const wrap = document.createElement("div");
  wrap.appendChild(fragment);
  return wrap.innerHTML;
}

function substituteTokens(html: string, pageNumber: number, totalPages: number): string {
  return html
    .replace(/{{PAGE_NUMBER}}/g, String(pageNumber))
    .replace(/{{TOTAL_PAGES}}/g, String(totalPages));
}

// ───────────────────────────────────────────── Plugin state

export type HeaderVariant = "default" | "first" | "odd" | "even";
export type BandSide = "header" | "footer";

interface VariantContent {
  json: unknown;
  html: string;
}

interface VariantSet {
  default: VariantContent;
  first: VariantContent;
  odd: VariantContent;
  even: VariantContent;
}

export interface PagesState {
  format: PageFormat;
  formatName: string;
  zoom: number;
  pageGap: number;
  headerTopMargin: number;
  footerBottomMargin: number;
  differentFirstPage: boolean;
  differentOddEven: boolean;
  headers: VariantSet;
  footers: VariantSet;
  pageCount: number;
  /** When set, the React overlay opens an editor over this band. */
  editing: { side: BandSide; variant: HeaderVariant; pageNumber: number } | null;
}

export interface PagesOptions {
  format?: PageFormatName;
  zoom?: number;
  pageGap?: number;
  headerTopMargin?: number;
  footerBottomMargin?: number;
  differentFirstPage?: boolean;
  differentOddEven?: boolean;
  /** Initial header content (default variant). HTML or PM JSON. */
  header?: string | unknown;
  footer?: string | unknown;
  headerFirstPage?: string | unknown;
  headerOdd?: string | unknown;
  headerEven?: string | unknown;
  footerFirstPage?: string | unknown;
  footerOdd?: string | unknown;
  footerEven?: string | unknown;
}

interface ResolvedOptions {
  format: PageFormat;
  formatName: string;
  zoom: number;
  pageGap: number;
  headerTopMargin: number;
  footerBottomMargin: number;
  differentFirstPage: boolean;
  differentOddEven: boolean;
  headers: VariantSet;
  footers: VariantSet;
}

function htmlOrJsonToVariant(input: string | unknown): VariantContent {
  if (input == null) return { json: emptyHeaderDoc(), html: "" };
  if (typeof input === "string") {
    if (!input.trim()) return { json: emptyHeaderDoc(), html: "" };
    const wrap = document.createElement("div");
    wrap.innerHTML = input;
    try {
      const node = PMDOMParser.fromSchema(HEADER_FOOTER_SCHEMA).parse(wrap);
      return { json: node.toJSON(), html: jsonToHTML(node.toJSON()) };
    } catch {
      return { json: emptyHeaderDoc(), html: "" };
    }
  }
  return { json: input, html: jsonToHTML(input) };
}

function emptyVariantSet(seed?: VariantContent): VariantSet {
  const blank: VariantContent = { json: emptyHeaderDoc(), html: "" };
  const def = seed ?? blank;
  return { default: def, first: blank, odd: blank, even: blank };
}

function resolveOptions(options: PagesOptions): ResolvedOptions {
  const formatName = options.format ?? "A4";
  const format = PAGE_FORMATS[formatName] ?? PAGE_FORMATS["A4"]!;
  return {
    format,
    formatName,
    zoom: clamp(options.zoom ?? 1, 0.25, 4),
    pageGap: options.pageGap ?? 24,
    headerTopMargin: options.headerTopMargin ?? 24,
    footerBottomMargin: options.footerBottomMargin ?? 24,
    differentFirstPage: options.differentFirstPage ?? false,
    differentOddEven: options.differentOddEven ?? false,
    headers: {
      ...emptyVariantSet(htmlOrJsonToVariant(options.header)),
      first: htmlOrJsonToVariant(options.headerFirstPage),
      odd: htmlOrJsonToVariant(options.headerOdd),
      even: htmlOrJsonToVariant(options.headerEven),
    },
    footers: {
      ...emptyVariantSet(htmlOrJsonToVariant(options.footer)),
      first: htmlOrJsonToVariant(options.footerFirstPage),
      odd: htmlOrJsonToVariant(options.footerOdd),
      even: htmlOrJsonToVariant(options.footerEven),
    },
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// ───────────────────────────────────────────── Plugin keys + meta

export const pagesPluginKey = new PluginKey<PagesState>("pp-pages");

type PagesMeta =
  | { kind: "set"; partial: Partial<PagesState> }
  | { kind: "page-count"; pageCount: number }
  | {
      kind: "edit-band";
      side: BandSide;
      variant: HeaderVariant;
      pageNumber: number;
    }
  | { kind: "stop-editing" }
  | {
      kind: "set-variant";
      side: BandSide;
      variant: HeaderVariant;
      content: VariantContent;
    };

// ───────────────────────────────────────────── Variant helpers

export function variantForPage(state: PagesState, pageNumber: number): HeaderVariant {
  if (state.differentFirstPage && pageNumber === 1) return "first";
  if (state.differentOddEven) return pageNumber % 2 === 1 ? "odd" : "even";
  return "default";
}

function readVariant(set: VariantSet, variant: HeaderVariant): VariantContent {
  return set[variant];
}

// ───────────────────────────────────────────── Page-break NodeView coordination

interface PageBreakRegistry {
  callbacks: Map<HTMLElement, () => void>;
  observer: MutationObserver | null;
}

const pageBreakRegistries = new WeakMap<EditorView, PageBreakRegistry>();

export function registerPageBreakNodeView(
  view: EditorView,
  dom: HTMLElement,
  recalc: () => void,
): () => void {
  let entry = pageBreakRegistries.get(view);
  if (!entry) {
    entry = { callbacks: new Map(), observer: null };
    pageBreakRegistries.set(view, entry);
  }
  entry.callbacks.set(dom, recalc);
  // Schedule the first measure on the next frame.
  requestAnimationFrame(() => recalc());
  return () => {
    const e = pageBreakRegistries.get(view);
    if (!e) return;
    e.callbacks.delete(dom);
  };
}

export function notifyPageBreakNodeViews(view: EditorView) {
  const entry = pageBreakRegistries.get(view);
  if (!entry) return;
  // Iterate up to 5 times — fill heights can change other fill heights
  // when multiple page-breaks live in the same flow.
  for (let i = 0; i < 5; i++) {
    let changed = false;
    entry.callbacks.forEach((cb, dom) => {
      const before = dom.style.height;
      cb();
      if (before !== dom.style.height) changed = true;
    });
    if (!changed) break;
  }
}

/**
 * Compute the pixel height a page-break NodeView should claim to push
 * subsequent content down to the next page boundary. Returns null if
 * pagination isn't measurable yet.
 */
export function measurePageBreakFillHeight(
  pageBreakDom: HTMLElement,
  editorDom: HTMLElement,
): number | null {
  const pagination = editorDom.querySelector("[data-pp-pagination]");
  if (!pagination) return null;
  const footers = pagination.querySelectorAll(".pp-page-footer");
  if (footers.length === 0) return null;
  const pbRect = pageBreakDom.getBoundingClientRect();
  // Find the next footer below this page-break — that's where the
  // current page ends. Fill the gap so content lands on the next page.
  let nextFooter: DOMRect | null = null;
  for (const f of footers) {
    const rect = f.getBoundingClientRect();
    if (rect.top > pbRect.top) {
      nextFooter = rect;
      break;
    }
  }
  if (!nextFooter) return 0;
  return Math.max(0, nextFooter.top - pbRect.top);
}

// ───────────────────────────────────────────── Decoration rendering

function renderBandHTML(
  side: BandSide,
  variant: HeaderVariant,
  pageNumber: number,
  totalPages: number,
  state: PagesState,
): string {
  const variantContent = readVariant(side === "header" ? state.headers : state.footers, variant);
  const html = variantContent.html;
  if (!html) return "";
  return substituteTokens(html, pageNumber, totalPages);
}

function buildPaginationDOM(state: PagesState): HTMLElement {
  const root = document.createElement("div");
  root.dataset["ppPagination"] = "";
  root.classList.add("pp-pagination");

  const { format, pageCount, pageGap } = state;
  const contentHeight =
    format.height - format.margins.top - format.margins.bottom;

  for (let i = 0; i < pageCount; i++) {
    // Match Tiptap's structure exactly: each page-break is a wrapper
    // containing TWO floats — a 0×0 spacer that holds the marginTop
    // (creating the content gap), and a full-width breaker that holds
    // the visible header/footer chrome. Splitting them this way is what
    // lets text wrap into the gaps between breakers; combining them
    // into a single tall full-width float (our previous attempt) caused
    // text to clear all floats instead of interleaving.
    const wrapper = document.createElement("div");
    wrapper.classList.add("pp-page-break");
    wrapper.dataset["pageNumber"] = String(i);

    // Spacer — invisible 0×0 float whose marginTop carves out the
    // content area for this page. Subsequent floats clear past it.
    const spacer = document.createElement("div");
    spacer.classList.add("pp-page-spacer");
    spacer.style.float = "left";
    spacer.style.clear = "both";
    spacer.style.width = "0";
    spacer.style.height = "0";
    spacer.style.marginTop = i === 0 ? "0px" : `${contentHeight}px`;
    wrapper.appendChild(spacer);

    // Breaker — the visible chrome. Full page width, contains header/footer.
    const breaker = document.createElement("div");
    breaker.classList.add("pp-page-breaker");
    breaker.style.float = "left";
    breaker.style.clear = "both";
    breaker.style.position = "relative";
    breaker.style.width = `${format.width}px`;
    breaker.style.marginLeft = `-${format.margins.left}px`;
    breaker.style.zIndex = "2";

    if (i > 0) {
      const pageNumber = i;
      const variant = variantForPage(state, pageNumber);
      const footerHTML = renderBandHTML("footer", variant, pageNumber, pageCount, state);
      const footer = document.createElement("div");
      footer.classList.add("pp-page-footer");
      footer.dataset["pageNumber"] = String(pageNumber);
      footer.dataset["variant"] = variant;
      footer.style.height = `${format.margins.bottom}px`;
      footer.style.padding = `0 ${format.margins.right}px ${state.footerBottomMargin}px ${format.margins.left}px`;
      footer.innerHTML = footerHTML;
      breaker.appendChild(footer);

      const gap = document.createElement("div");
      gap.classList.add("pp-page-gap");
      gap.style.height = `${pageGap}px`;
      breaker.appendChild(gap);
    }

    const headerPage = i + 1;
    const headerVariant = variantForPage(state, headerPage);
    const headerHTML = renderBandHTML("header", headerVariant, headerPage, pageCount, state);
    const header = document.createElement("div");
    header.classList.add("pp-page-header");
    header.dataset["pageNumber"] = String(headerPage);
    header.dataset["variant"] = headerVariant;
    header.style.height = `${format.margins.top}px`;
    header.style.padding = `${state.headerTopMargin}px ${format.margins.right}px 0 ${format.margins.left}px`;
    header.innerHTML = headerHTML;
    breaker.appendChild(header);

    wrapper.appendChild(breaker);
    root.appendChild(wrapper);
  }

  return root;
}

function paginationKey(state: PagesState): string {
  // Keying the widget so PM doesn't rebuild the DOM unless something
  // visible has changed. We hash the bits that affect visual layout.
  const headers = state.headers;
  const footers = state.footers;
  return [
    state.formatName,
    state.pageCount,
    state.pageGap,
    state.headerTopMargin,
    state.footerBottomMargin,
    state.differentFirstPage ? 1 : 0,
    state.differentOddEven ? 1 : 0,
    headers.default.html.length,
    headers.first.html.length,
    headers.odd.html.length,
    headers.even.html.length,
    footers.default.html.length,
    footers.first.html.length,
    footers.odd.html.length,
    footers.even.html.length,
    // Editing state changes the highlight ring; include it.
    state.editing
      ? `${state.editing.side}:${state.editing.variant}:${state.editing.pageNumber}`
      : "none",
    // Bust the cache when the actual content changes (cheap proxy).
    headers.default.html,
    footers.default.html,
    headers.first.html,
    footers.first.html,
    headers.odd.html,
    footers.odd.html,
    headers.even.html,
    footers.even.html,
  ].join("|");
}

// ───────────────────────────────────────────── Page count measurement

/** Hard ceiling — guards against runaway feedback loops if measurement
 *  somehow disagrees with itself. 200 is far past any realistic doc; if
 *  we hit it, we stop adding rather than blow up the layout engine. */
const MAX_PAGE_COUNT = 200;

/**
 * Compute the next page count using the same algorithm as Tiptap Pro's
 * pages extension: measure how far the last block of editor content
 * sits below the last footer band. Positive overflow → add pages;
 * sufficiently negative → remove a page. This is self-stabilizing
 * because the float-and-clear pagination layout naturally pushes
 * content text down to clear the float stripes — the difference between
 * lastChild.bottom and lastFooter.bottom is the *unaccommodated*
 * overflow, which converges to ≤ 0 once we have enough pages.
 *
 * The 1-page bootstrap case has no footer to measure against. There we
 * fall back to scrollHeight to bump the count to 2; the lastFooter
 * algorithm takes over from there.
 */
function computePageCount(view: EditorView, state: PagesState): number {
  const dom = view.dom;
  const { format, pageCount: current } = state;
  const pageHeight = format.height;
  const contentHeight = pageHeight - format.margins.top - format.margins.bottom;
  if (contentHeight <= 0) return 1;

  const pagination = dom.querySelector<HTMLElement>("[data-pp-pagination]");
  const footers = pagination?.querySelectorAll<HTMLElement>(".pp-page-footer");
  const lastFooter = footers && footers.length > 0 ? footers[footers.length - 1] : null;

  if (!pagination || !lastFooter) {
    // Bootstrap: only the first-page header is rendered, no footer
    // exists. Use the rendered scrollHeight (which is uncontaminated
    // since there's only one short header float so far) to estimate.
    const scrollHeight = dom.scrollHeight;
    const target = Math.ceil(scrollHeight / contentHeight);
    return Math.min(MAX_PAGE_COUNT, Math.max(1, target));
  }

  // Find the editor's last content block (excluding pagination overlay).
  let lastBlock: HTMLElement | null = null;
  for (let i = dom.children.length - 1; i >= 0; i--) {
    const child = dom.children[i] as HTMLElement;
    if (child.dataset["ppPagination"] !== undefined) continue;
    if (child.getBoundingClientRect().height === 0) continue;
    lastBlock = child;
    break;
  }
  if (!lastBlock) return current;

  const lastChildBottom = lastBlock.getBoundingClientRect().bottom;
  const lastFooterBottom = lastFooter.getBoundingClientRect().bottom;
  const overflow = lastChildBottom - lastFooterBottom;

  if (overflow > 0) {
    // Need more pages. Add at most 5 in one step — keeps the loop from
    // visibly thrashing if the measurement shifts mid-render.
    const additional = Math.min(5, Math.ceil(overflow / pageHeight));
    return Math.min(MAX_PAGE_COUNT, current + additional);
  }
  // Need fewer? Only shrink if we have a full page of slack at the end.
  if (overflow < -pageHeight) {
    return Math.max(1, current - 1);
  }
  return current;
}

// ───────────────────────────────────────────── Plugin

function buildPagesPlugin(resolved: ResolvedOptions): Plugin<PagesState> {
  let recountFrame: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let dblclickHandler: ((event: MouseEvent) => void) | null = null;

  return new Plugin<PagesState>({
    key: pagesPluginKey,
    state: {
      init(_, instance): PagesState {
        return {
          format: resolved.format,
          formatName: resolved.formatName,
          zoom: resolved.zoom,
          pageGap: resolved.pageGap,
          headerTopMargin: resolved.headerTopMargin,
          footerBottomMargin: resolved.footerBottomMargin,
          differentFirstPage: resolved.differentFirstPage,
          differentOddEven: resolved.differentOddEven,
          headers: resolved.headers,
          footers: resolved.footers,
          pageCount: estimateInitialPageCount(instance.doc, resolved.format),
          editing: null,
        };
      },
      apply(tr, prev): PagesState {
        const meta = tr.getMeta(pagesPluginKey) as PagesMeta | undefined;
        if (!meta) return prev;
        switch (meta.kind) {
          case "set":
            return { ...prev, ...meta.partial };
          case "page-count":
            if (meta.pageCount === prev.pageCount) return prev;
            return { ...prev, pageCount: meta.pageCount };
          case "edit-band":
            return {
              ...prev,
              editing: {
                side: meta.side,
                variant: meta.variant,
                pageNumber: meta.pageNumber,
              },
            };
          case "stop-editing":
            if (!prev.editing) return prev;
            return { ...prev, editing: null };
          case "set-variant": {
            const target = meta.side === "header" ? prev.headers : prev.footers;
            const next: VariantSet = { ...target, [meta.variant]: meta.content };
            return meta.side === "header"
              ? { ...prev, headers: next }
              : { ...prev, footers: next };
          }
          default:
            return prev;
        }
      },
    },
    props: {
      attributes(state): Record<string, string> {
        const s = pagesPluginKey.getState(state);
        if (!s) return {};
        const cssVars: Record<string, string> = {
          "--pp-page-width": `${s.format.width}px`,
          "--pp-page-height": `${s.format.height}px`,
          "--pp-page-margin-top": `${s.format.margins.top}px`,
          "--pp-page-margin-right": `${s.format.margins.right}px`,
          "--pp-page-margin-bottom": `${s.format.margins.bottom}px`,
          "--pp-page-margin-left": `${s.format.margins.left}px`,
          "--pp-page-gap": `${s.pageGap}px`,
        };
        const styleString = Object.entries(cssVars)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ");
        return { class: "ProseMirror--pages", style: styleString };
      },
    },
    view(view) {
      // Direct DOM injection — Decoration.widget at pos 0 ends up wrapped
      // in an inline <span> by ProseMirror, which kills the float trick
      // (floats only carve out content space when they're block-level
      // siblings of the editor's block content). Owning the DOM element
      // ourselves and inserting it as a direct child of view.dom keeps
      // the float layout intact. PM's mutation observer leaves it alone
      // because it doesn't recognize it as part of the doc.
      const paginationRoot = document.createElement("div");
      paginationRoot.dataset["ppPagination"] = "";
      paginationRoot.classList.add("pp-pagination");
      view.dom.insertBefore(paginationRoot, view.dom.firstChild);
      let lastKey = "";

      const renderPagination = () => {
        const s = pagesPluginKey.getState(view.state);
        if (!s) return;
        const key = paginationKey(s);
        if (key === lastKey) return;
        lastKey = key;
        // Replace the children in place so we don't re-create the root
        // (PM's mutation observer might react to a removal).
        while (paginationRoot.firstChild) paginationRoot.removeChild(paginationRoot.firstChild);
        const fresh = buildPaginationDOM(s);
        // fresh is itself a wrapping div — copy its children over.
        while (fresh.firstChild) paginationRoot.appendChild(fresh.firstChild);
      };

      // Re-insert if PM ever removes us during DOM diffing.
      const reattach = () => {
        if (paginationRoot.parentElement !== view.dom) {
          view.dom.insertBefore(paginationRoot, view.dom.firstChild);
        } else if (view.dom.firstChild !== paginationRoot) {
          view.dom.insertBefore(paginationRoot, view.dom.firstChild);
        }
      };

      renderPagination();

      const scheduleRecount = () => {
        if (recountFrame !== null) return;
        recountFrame = requestAnimationFrame(() => {
          recountFrame = null;
          if (view.isDestroyed) return;
          const s = pagesPluginKey.getState(view.state);
          if (!s) return;
          const next = computePageCount(view, s);
          if (next !== s.pageCount) {
            view.dispatch(
              view.state.tr.setMeta(pagesPluginKey, {
                kind: "page-count",
                pageCount: next,
              } satisfies PagesMeta),
            );
          }
          notifyPageBreakNodeViews(view);
        });
      };

      resizeObserver = new ResizeObserver(scheduleRecount);
      resizeObserver.observe(view.dom);

      // Click any header/footer band to start editing the matching variant.
      dblclickHandler = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const band = target.closest<HTMLElement>(".pp-page-header, .pp-page-footer");
        if (!band) return;
        if (!view.dom.contains(band)) return;
        event.preventDefault();
        const side: BandSide = band.classList.contains("pp-page-header")
          ? "header"
          : "footer";
        const pageNumber = Number(band.dataset["pageNumber"] ?? "1");
        const variant = (band.dataset["variant"] as HeaderVariant | undefined) ?? "default";
        view.dispatch(
          view.state.tr.setMeta(pagesPluginKey, {
            kind: "edit-band",
            side,
            variant,
            pageNumber,
          } satisfies PagesMeta),
        );
      };
      view.dom.addEventListener("dblclick", dblclickHandler);

      // Initial measurement after first paint.
      scheduleRecount();

      return {
        update: () => {
          // Re-render the pagination overlay if state changed and
          // ensure the element is still attached to view.dom.
          reattach();
          renderPagination();
          scheduleRecount();
        },
        destroy() {
          if (recountFrame !== null) cancelAnimationFrame(recountFrame);
          resizeObserver?.disconnect();
          if (dblclickHandler) {
            view.dom.removeEventListener("dblclick", dblclickHandler);
          }
          paginationRoot.remove();
        },
      };
    },
  });
}

function estimateInitialPageCount(doc: Node, _format: PageFormat): number {
  // We can't measure layout until after mount — start with 1 and let
  // the view's first scheduleRecount() correct it.
  void doc;
  void _format;
  return 1;
}

// ───────────────────────────────────────────── Commands

export const setPageFormat =
  (formatName: PageFormatName) =>
  (state: EditorState, dispatch?: (tr: import("prosemirror-state").Transaction) => void) => {
    const s = pagesPluginKey.getState(state);
    if (!s) return false;
    const format = PAGE_FORMATS[formatName];
    if (!format) return false;
    if (dispatch) {
      dispatch(
        state.tr.setMeta(pagesPluginKey, {
          kind: "set",
          partial: { format, formatName },
        } satisfies PagesMeta),
      );
    }
    return true;
  };

export const setHeaderVariant =
  (variant: HeaderVariant, content: string | unknown) =>
  (state: EditorState, dispatch?: (tr: import("prosemirror-state").Transaction) => void) => {
    if (dispatch) {
      dispatch(
        state.tr.setMeta(pagesPluginKey, {
          kind: "set-variant",
          side: "header",
          variant,
          content: htmlOrJsonToVariant(content),
        } satisfies PagesMeta),
      );
    }
    return true;
  };

export const setFooterVariant =
  (variant: HeaderVariant, content: string | unknown) =>
  (state: EditorState, dispatch?: (tr: import("prosemirror-state").Transaction) => void) => {
    if (dispatch) {
      dispatch(
        state.tr.setMeta(pagesPluginKey, {
          kind: "set-variant",
          side: "footer",
          variant,
          content: htmlOrJsonToVariant(content),
        } satisfies PagesMeta),
      );
    }
    return true;
  };

// ───────────────────────────────────────────── Hook + popover

export function usePages():
  | (PagesState & { active: true })
  | { active: false } {
  const editorState = useEditorState();
  const s = editorState ? pagesPluginKey.getState(editorState) : null;
  if (!s) return { active: false };
  return { ...s, active: true };
}

// ───────────────────────────────────────────── Header/footer overlay editor

interface OverlayContentEditorProps {
  initialJSON: unknown;
  onCommit: (json: unknown) => void;
  onClose: () => void;
}

/**
 * A standalone ProseMirror instance bound to a div. Uses a minimal
 * schema — paragraph + bold/italic/underline + page-number/total-pages
 * tokens. Saves on Escape or click-out.
 */
function OverlayContentEditor({ initialJSON, onCommit, onClose }: OverlayContentEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const startDoc = nodeFromJSON(initialJSON);
    const startState = EditorState.create({
      schema: HEADER_FOOTER_SCHEMA,
      doc: startDoc,
      plugins: [
        history(),
        pmKeymap({
          "Mod-z": historyUndo,
          "Mod-y": historyRedo,
          "Shift-Mod-z": historyRedo,
          "Mod-b": toggleMark(HEADER_FOOTER_SCHEMA.marks["bold"]!),
          "Mod-i": toggleMark(HEADER_FOOTER_SCHEMA.marks["italic"]!),
          "Mod-u": toggleMark(HEADER_FOOTER_SCHEMA.marks["underline"]!),
          Escape: () => {
            commit();
            return true;
          },
        }),
        pmKeymap(baseKeymap),
      ],
    });
    const view = new EditorView(containerRef.current, {
      state: startState,
      dispatchTransaction(tr) {
        const next = view.state.apply(tr);
        view.updateState(next);
      },
    });
    viewRef.current = view;
    // Focus the editor at the document end.
    const end = TextSelection.atEnd(view.state.doc);
    view.dispatch(view.state.tr.setSelection(end));
    view.focus();

    function commit() {
      const json = view.state.doc.toJSON();
      onCommit(json);
      onClose();
    }

    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as globalThis.Node)) return;
      // Ignore clicks on the toolbar (it lives in the overlay's portal).
      const inToolbar = (event.target as HTMLElement | null)?.closest(
        ".pp-pages-overlay-toolbar",
      );
      if (inToolbar) return;
      commit();
    };
    // Defer attaching the click-outside listener so the click that
    // opened the overlay (a dblclick) doesn't immediately close it.
    const t = setTimeout(() => {
      window.addEventListener("mousedown", onClickOutside);
    }, 50);

    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onClickOutside);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertToken = (tokenType: "page_number_token" | "total_pages_token") => {
    const view = viewRef.current;
    if (!view) return;
    const type = HEADER_FOOTER_SCHEMA.nodes[tokenType];
    if (!type) return;
    view.dispatch(view.state.tr.replaceSelectionWith(type.create()).scrollIntoView());
    view.focus();
  };

  const toggleMarkByName = (name: "bold" | "italic" | "underline") => {
    const view = viewRef.current;
    if (!view) return;
    const mark = HEADER_FOOTER_SCHEMA.marks[name];
    if (!mark) return;
    toggleMark(mark)(view.state, view.dispatch);
    view.focus();
  };

  const setAlign = (align: "left" | "center" | "right" | null) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection;
    const tr = view.state.tr;
    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === HEADER_FOOTER_SCHEMA.nodes["paragraph"]) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
      }
      return undefined;
    });
    view.dispatch(tr);
    view.focus();
  };

  return (
    <>
      <div className="pp-pages-overlay-toolbar" onMouseDown={(e) => e.preventDefault()}>
        <button type="button" onClick={() => toggleMarkByName("bold")}>B</button>
        <button type="button" onClick={() => toggleMarkByName("italic")}><i>I</i></button>
        <button type="button" onClick={() => toggleMarkByName("underline")}><u>U</u></button>
        <span className="pp-pages-overlay-divider" />
        <button type="button" onClick={() => setAlign("left")}>⯇</button>
        <button type="button" onClick={() => setAlign("center")}>≡</button>
        <button type="button" onClick={() => setAlign("right")}>⯈</button>
        <span className="pp-pages-overlay-divider" />
        <button type="button" onClick={() => insertToken("page_number_token")}>#Page</button>
        <button type="button" onClick={() => insertToken("total_pages_token")}>#Total</button>
        <span className="pp-pages-overlay-divider" />
        <button type="button" className="pp-pages-overlay-done" onClick={() => {
          const view = viewRef.current;
          if (!view) {
            onClose();
            return;
          }
          onCommit(view.state.doc.toJSON());
          onClose();
        }}>Done</button>
      </div>
      <div ref={containerRef} className="pp-pages-overlay-content" />
    </>
  );
}

/**
 * Renders an editor over the active header/footer band. Mount as a
 * companion to <editor.Editor>.
 */
export function PageHeaderFooterEditor() {
  const editorState = useEditorState();
  const pages = editorState ? pagesPluginKey.getState(editorState) : null;
  const editing = pages?.editing ?? null;
  const [bandRect, setBandRect] = useState<DOMRect | null>(null);

  useEditorEffect(
    (view) => {
      if (!editing) {
        setBandRect(null);
        return;
      }
      const bandSelector = `.pp-page-${editing.side}[data-page-number="${editing.pageNumber}"][data-variant="${editing.variant}"]`;
      const band = view.dom.querySelector<HTMLElement>(bandSelector);
      if (!band) {
        setBandRect(null);
        return;
      }
      const update = () => setBandRect(band.getBoundingClientRect());
      update();
      const ro = new ResizeObserver(update);
      ro.observe(band);
      window.addEventListener("scroll", update, true);
      window.addEventListener("resize", update);
      return () => {
        ro.disconnect();
        window.removeEventListener("scroll", update, true);
        window.removeEventListener("resize", update);
      };
    },
    [editing?.side, editing?.variant, editing?.pageNumber],
  );

  const stopEditing = useEditorEventCallback((view) => {
    if (!view) return;
    view.dispatch(
      view.state.tr.setMeta(pagesPluginKey, { kind: "stop-editing" } satisfies PagesMeta),
    );
  });

  const commit = useEditorEventCallback((view, json: unknown) => {
    if (!view || !editing) return;
    view.dispatch(
      view.state.tr.setMeta(pagesPluginKey, {
        kind: "set-variant",
        side: editing.side,
        variant: editing.variant,
        content: { json, html: jsonToHTML(json) },
      } satisfies PagesMeta),
    );
  });

  if (!editing || !pages || !bandRect) return null;

  const variantSet = editing.side === "header" ? pages.headers : pages.footers;
  const initialJSON = variantSet[editing.variant].json;

  return createPortal(
    <div
      className="pp-pages-overlay"
      style={{
        position: "fixed",
        left: bandRect.left,
        top: bandRect.top,
        width: bandRect.width,
        height: bandRect.height,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <OverlayContentEditor
        initialJSON={initialJSON}
        onCommit={commit}
        onClose={stopEditing}
      />
    </div>,
    document.body,
  );
}

// ───────────────────────────────────────────── Toolbar (popover)

const FORMAT_OPTIONS: PageFormatName[] = ["A4", "Letter", "Legal", "A3", "A5"];

function PagesToolbarItem() {
  const editorState = useEditorState();
  const pages = editorState ? pagesPluginKey.getState(editorState) : null;
  const [open, setOpen] = useState(false);

  const setFormat = useEditorEventCallback((view, formatName: PageFormatName) => {
    if (!view) return;
    setPageFormat(formatName)(view.state, view.dispatch);
  });

  const toggleDifferentFirstPage = useEditorEventCallback((view) => {
    if (!view) return;
    const s = pagesPluginKey.getState(view.state);
    if (!s) return;
    view.dispatch(
      view.state.tr.setMeta(pagesPluginKey, {
        kind: "set",
        partial: { differentFirstPage: !s.differentFirstPage },
      } satisfies PagesMeta),
    );
  });

  const toggleDifferentOddEven = useEditorEventCallback((view) => {
    if (!view) return;
    const s = pagesPluginKey.getState(view.state);
    if (!s) return;
    view.dispatch(
      view.state.tr.setMeta(pagesPluginKey, {
        kind: "set",
        partial: { differentOddEven: !s.differentOddEven },
      } satisfies PagesMeta),
    );
  });

  if (!pages) return null;

  return (
    <span className="pp-pages-toolbar">
      <button
        type="button"
        className="pp-pages-toolbar-button"
        onClick={() => setOpen((v) => !v)}
        title="Pages"
      >
        <PMSelection size={16} weight="bold" />
        <span className="pp-pages-toolbar-label">
          {pages.formatName} · {pages.pageCount}p
        </span>
      </button>
      {open && (
        <div className="pp-pages-toolbar-popover">
          <div className="pp-pages-toolbar-section">
            <div className="pp-pages-toolbar-section-title">Page format</div>
            {FORMAT_OPTIONS.map((name) => (
              <button
                key={name}
                type="button"
                className={`pp-pages-toolbar-option${name === pages.formatName ? " is-active" : ""}`}
                onClick={() => {
                  setFormat(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="pp-pages-toolbar-section">
            <div className="pp-pages-toolbar-section-title">Variants</div>
            <label className="pp-pages-toolbar-checkbox">
              <input
                type="checkbox"
                checked={pages.differentFirstPage}
                onChange={() => toggleDifferentFirstPage()}
              />
              Different first page
            </label>
            <label className="pp-pages-toolbar-checkbox">
              <input
                type="checkbox"
                checked={pages.differentOddEven}
                onChange={() => toggleDifferentOddEven()}
              />
              Different odd/even pages
            </label>
          </div>
        </div>
      )}
    </span>
  );
}

// ───────────────────────────────────────────── Extension factory

export function createPages(options: PagesOptions = {}) {
  const resolved = resolveOptions(options);
  return Extension.create({
    name: "pages",
    plugins: () => [buildPagesPlugin(resolved)],
    toolbar: PagesToolbarItem,
    meta: {
      label: "Pages",
      group: "block",
      Icon: PMSelection,
    },
  });
}

export const Pages = createPages();
