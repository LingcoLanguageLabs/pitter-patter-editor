import { Plugin } from "prosemirror-state";

import { Extension } from "../types";

export interface SmartPasteOptions {
  /** Strip MS Word/Office artifacts: conditional comments, namespaced tags. Default: true. */
  cleanWord?: boolean;
  /** Strip Google Docs wrappers: docs-internal-guid spans, normalize <b style="font-weight: normal">. Default: true. */
  cleanGoogleDocs?: boolean;
  /** Strip Notion block-id markers and notion-* class names. Default: true. */
  cleanNotion?: boolean;
  /** Strip <p>/<div> nodes that contain only whitespace or <br>. Default: true. */
  stripEmptyParagraphs?: boolean;
  /**
   * Inline style properties to preserve. Anything else on a `style="…"`
   * attribute is removed. Defaults to a small list — extend it if you
   * have schema marks that read inline styles directly.
   */
  allowedInlineStyles?: string[];
  /**
   * If null (default), all class attributes are stripped on paste —
   * pasted content shouldn't carry source-app class names. Pass a regex
   * to keep matching classes, e.g. `/^pp-/` to preserve in-house styling.
   */
  preserveClasses?: RegExp | null;
  /** Custom transformer applied after the built-in cleanup. */
  transformHTML?: (html: string) => string;
}

const DEFAULTS: Required<SmartPasteOptions> = {
  cleanWord: true,
  cleanGoogleDocs: true,
  cleanNotion: true,
  stripEmptyParagraphs: true,
  allowedInlineStyles: ["text-align", "color", "background-color"],
  preserveClasses: null,
  transformHTML: (s) => s,
};

const MSO_CONDITIONAL = /<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi;
// Office namespaces: <o:p>, <w:WordDocument>, <x:Excel...>. Skip <m:> (MathML).
const MSO_NAMESPACED = /<\/?(?:o|w|x|st1):[^>]*>/gi;
const META_TAG = /<meta\b[^>]*>/gi;
const STYLE_TAG = /<style\b[\s\S]*?<\/style>/gi;
const SCRIPT_TAG = /<script\b[\s\S]*?<\/script>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function clean(html: string, opts: Required<SmartPasteOptions>): string {
  if (!html) return html;
  let cleaned = html;

  if (opts.cleanWord) {
    cleaned = cleaned.replace(MSO_CONDITIONAL, "");
    cleaned = cleaned.replace(MSO_NAMESPACED, "");
  }

  // Always strip <meta>, <style>, <script>, raw HTML comments — they're never
  // meaningful inside pasted content and frequently carry the source app's
  // CSS rules that target ProseMirror DOM by class.
  cleaned = cleaned
    .replace(META_TAG, "")
    .replace(STYLE_TAG, "")
    .replace(SCRIPT_TAG, "")
    .replace(HTML_COMMENT, "");

  if (!cleaned.trim()) return cleaned;

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${cleaned}</body></html>`,
    "text/html",
  );
  const body = doc.body;

  if (opts.cleanGoogleDocs) {
    // The wrapping <span id="docs-internal-guid-…"> contains the entire paste.
    body.querySelectorAll<HTMLElement>('[id^="docs-internal-guid"]').forEach(unwrap);
    // <b style="font-weight: normal"> is Google's default wrapper — semantically
    // wrong. Unwrap so its children render as plain text, not bold.
    body.querySelectorAll<HTMLElement>("b").forEach((b) => {
      if (b.style.fontWeight === "normal" || b.style.fontWeight === "400") {
        unwrap(b);
      }
    });
    // Same trick with <span style="font-weight: normal"> on a single child.
    body.querySelectorAll<HTMLElement>("span").forEach((s) => {
      const fw = s.style.fontWeight;
      if (fw === "normal" || fw === "400") {
        s.style.removeProperty("font-weight");
      }
    });
  }

  if (opts.cleanNotion) {
    body.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
      el.removeAttribute("data-block-id");
    });
    body.querySelectorAll<HTMLElement>("[class*='notion-']").forEach((el) => {
      el.removeAttribute("class");
    });
  }

  const allowedStyles = new Set(
    opts.allowedInlineStyles.map((s) => s.toLowerCase()),
  );

  function walk(node: Node) {
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;

    // Filter inline styles
    if (el.hasAttribute("style")) {
      const keep: Array<[string, string]> = [];
      for (let i = 0; i < el.style.length; i++) {
        const prop = el.style[i]!.toLowerCase();
        if (allowedStyles.has(prop)) {
          keep.push([prop, el.style.getPropertyValue(prop)]);
        }
      }
      el.removeAttribute("style");
      for (const [prop, v] of keep) {
        el.style.setProperty(prop, v);
      }
    }

    // Filter classes
    if (el.hasAttribute("class")) {
      if (opts.preserveClasses) {
        const className = el.getAttribute("class") ?? "";
        const kept = className.split(/\s+/).filter((c) =>
          opts.preserveClasses!.test(c),
        );
        if (kept.length === 0) el.removeAttribute("class");
        else el.setAttribute("class", kept.join(" "));
      } else {
        el.removeAttribute("class");
      }
    }

    // Strip a few noise attributes that no schema reads from
    for (const attr of [
      "align",
      "valign",
      "border",
      "cellpadding",
      "cellspacing",
      "bgcolor",
      "face",
      "size",
      "color",
      "data-pm-slice",
      "data-en-clipboard",
    ]) {
      el.removeAttribute(attr);
    }

    // Recurse — copy children list first since we may mutate during walk.
    Array.from(el.children).forEach(walk);
  }
  walk(body);

  if (opts.stripEmptyParagraphs) {
    body.querySelectorAll("p, div").forEach((el) => {
      const hasText = (el.textContent ?? "").replace(/ |\s/g, "").length > 0;
      const hasMedia = el.querySelector("img, video, audio, iframe, svg, br");
      if (!hasText && !hasMedia) el.remove();
    });
  }

  let result = body.innerHTML;
  if (opts.transformHTML) result = opts.transformHTML(result);
  return result;
}

export function createSmartPaste(options: SmartPasteOptions = {}) {
  const opts: Required<SmartPasteOptions> = { ...DEFAULTS, ...options };
  return Extension.create({
    name: "smart-paste",
    plugins: () => [
      new Plugin({
        props: {
          transformPastedHTML(html) {
            return clean(html, opts);
          },
        },
      }),
    ],
    meta: { label: "Smart paste", group: "system" },
  });
}

export const SmartPaste = createSmartPaste();

// Exported for tests and consumer composition.
export const __internals = { clean };
