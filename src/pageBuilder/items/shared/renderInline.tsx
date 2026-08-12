/**
 * Render an array of inline doc JSON (text nodes + hard breaks) to React for
 * the completer, reusing the runtime's `RenderText` so marks (bold, links,
 * text color, …) AND `{{ }}` variable interpolation look identical to the
 * editor and published site. Item completers use this for any rich text they
 * carry (prompts, options, …).
 */

import { type ReactNode } from "react";

import { RenderText } from "../../runtime/renderMarks";
import type { JsonNode } from "../../runtime/shuffleLayout";

export function renderInline(content: readonly JsonNode[] | undefined): ReactNode[] {
  return (content ?? []).map((n, i) =>
    n.type === "hard_break" ? (
      <br key={i} />
    ) : (
      <RenderText key={i} node={n} />
    ),
  );
}
