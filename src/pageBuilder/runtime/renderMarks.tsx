/**
 * Renders a text node's marks → React, matching each mark's schema `toDOM`
 * so site text is styled identically to the editor. Marks wrap from the
 * innermost out, in document order.
 *
 * Mark set (page-builder schema): `strong`, `em`, `underline` (<u>),
 * `strike` (<s>), `code`, `link` (pagy's pp-link), `textColor` (pp-text -X).
 * See `schema.ts` (link/textColor) and `editor/extensions/*` (the rest).
 */

import type { ReactNode } from "react";

import type { JsonNode } from "./shuffleLayout";

type MarkJson = NonNullable<JsonNode["marks"]>[number];

function wrap(mark: MarkJson, child: ReactNode, key: number): ReactNode {
  const a = mark.attrs ?? {};
  switch (mark.type) {
    case "strong":
      return <strong key={key}>{child}</strong>;
    case "em":
      return <em key={key}>{child}</em>;
    case "underline":
      return <u key={key}>{child}</u>;
    case "strike":
      return <s key={key}>{child}</s>;
    case "code":
      return <code key={key}>{child}</code>;
    case "link": {
      const variant = a["variant"] as string;
      const newTab = !!a["newTab"];
      return (
        <a
          key={key}
          href={(a["href"] as string) || ""}
          className={`pp-link${variant === "minimal" ? " -minimal" : ""}`}
          {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {child}
        </a>
      );
    }
    case "textColor":
      return (
        <span key={key} className={`pp-text -${a["color"] as string}`} data-text-color={a["color"] as string}>
          {child}
        </span>
      );
    default:
      return child;
  }
}

/** Wrap raw text in its marks (innermost first → outermost last). */
export function renderText(node: JsonNode): ReactNode {
  let el: ReactNode = node.text ?? "";
  const marks = node.marks ?? [];
  for (let i = 0; i < marks.length; i++) {
    el = wrap(marks[i], el, i);
  }
  return el;
}
