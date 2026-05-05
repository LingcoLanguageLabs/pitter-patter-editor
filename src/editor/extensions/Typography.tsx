import { InputRule } from "prosemirror-inputrules";

import { Extension } from "../types";

export interface TypographyOptions {
  /** `--` → en dash, `---` → em dash. Default: true. */
  dashes?: boolean;
  /** `->` → →, `<-` → ←, `<->` → ↔, `=>` → ⇒, `<<` → «, `>>` → ». Default: true. */
  arrows?: boolean;
  /** `...` → …. Default: true. */
  ellipsis?: boolean;
  /** `(c)`/`(r)`/`(tm)`/`+-` → ©/®/™/±. Default: true. */
  symbols?: boolean;
  /** Straight quotes → curly, context-aware. Default: true. */
  smartQuotes?: boolean;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function smartQuoteRule(char: string, open: string, close: string): InputRule {
  return new InputRule(new RegExp(`${escapeRegex(char)}$`), (state, _match, start, end) => {
    const before = state.doc.textBetween(Math.max(0, start - 1), start);
    const useOpen = !before || /[\s([{]/.test(before);
    return state.tr.insertText(useOpen ? open : close, start, end);
  });
}

function buildRules(options: TypographyOptions): InputRule[] {
  const {
    dashes = true,
    arrows = true,
    ellipsis = true,
    symbols = true,
    smartQuotes = true,
  } = options;
  const rules: InputRule[] = [];

  if (dashes) {
    rules.push(new InputRule(/---\s$/, "— "));
    rules.push(new InputRule(/(?<!-)--\s$/, "– "));
  }

  if (arrows) {
    rules.push(new InputRule(/<->\s$/, "↔ "));
    rules.push(new InputRule(/(?<!<)->\s$/, "→ "));
    rules.push(new InputRule(/<-(?!>)\s$/, "← "));
    rules.push(new InputRule(/=>\s$/, "⇒ "));
    rules.push(new InputRule(/<<\s$/, "« "));
    rules.push(new InputRule(/>>\s$/, "» "));
  }

  if (ellipsis) {
    rules.push(new InputRule(/\.\.\.$/, "…"));
  }

  if (symbols) {
    rules.push(new InputRule(/\(c\)$/i, "©"));
    rules.push(new InputRule(/\(r\)$/i, "®"));
    rules.push(new InputRule(/\(tm\)$/i, "™"));
    rules.push(new InputRule(/\+-$/, "±"));
  }

  if (smartQuotes) {
    rules.push(smartQuoteRule('"', "“", "”"));
    rules.push(smartQuoteRule("'", "‘", "’"));
  }

  return rules;
}

export function createTypography(options: TypographyOptions = {}) {
  return Extension.create({
    name: "typography",
    inputRules: () => buildRules(options),
    meta: { label: "Typography", group: "behavior" },
  });
}

export const Typography = Object.assign(createTypography(), {
  configure: (options: TypographyOptions) => createTypography(options),
});
