import { InputRule } from "prosemirror-inputrules";

import { Extension } from "../types";

// Match a URL ending in whitespace — input rule fires when the user types
// the trailing space after the URL.
const URL_BOUNDARY = /(?:^|\s)((?:https?:\/\/|www\.)[^\s<>"]+)\s$/;

/**
 * As-you-type URL → Link mark. When the user types a URL followed by a
 * space, the URL run gets a `link` mark applied. Pasted URLs are not
 * touched (the consumer's paste pipeline can decide).
 */
export const Linkify = Extension.create({
  name: "linkify",
  inputRules: (schema) => {
    const linkType = schema.marks["link"];
    if (!linkType) return [];
    return [
      new InputRule(URL_BOUNDARY, (state, match, start, end) => {
        const url = match[1];
        if (!url) return null;
        const href = url.startsWith("www.") ? `https://${url}` : url;
        const fullMatch = match[0];
        const urlOffset = fullMatch.indexOf(url);
        const urlStart = start + urlOffset;
        const urlEnd = urlStart + url.length;
        // Avoid double-linking — if the range already has a link mark, skip.
        const $start = state.doc.resolve(urlStart);
        const existing = state.doc.rangeHasMark(urlStart, urlEnd, linkType);
        if (existing) return null;
        const tr = state.tr.addMark(urlStart, urlEnd, linkType.create({ href }));
        return tr;
      }),
    ];
  },
  meta: { label: "Auto-linkify URLs", group: "system" },
});
