/**
 * Page-builder canvas — the framed white card that holds the
 * ProseMirror doc. Mirrors Pagy's `.frame`: a white card with rounded
 * corners + shadow (.pb-canvas-wrap).
 *
 * The "+ Add block" / "+ Add section" affordances and the per-section
 * toolbar are NOT rendered here — they're added per-section via
 * `sectionChromePlugin` (a PM widget decoration), so they stay scoped to
 * each section's chrome.
 */

import type { ReactNode } from "react";

import { usePageBuilderStore } from "./store";

export function Canvas({ children }: { children: ReactNode }) {
  const mobile = usePageBuilderStore((s) => s.mobile);

  return (
    <div className={`pb-canvas-wrap${mobile ? " -mobile" : ""}`}>
      <div className="pb-canvas site">
        <div className="pb-canvas-scroll">{children}</div>
      </div>
    </div>
  );
}
