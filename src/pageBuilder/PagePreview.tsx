/**
 * Preview overlay — "experience the site."
 *
 * Renders the deck exactly as a visitor (or the published site) would see it:
 * full-size, read-only, interactive, no editor chrome. Mirrors pagy's
 * `.frame_preview` overlay that the Play button toggles.
 *
 * Philosophy: ProseMirror is the *authoring* runtime only. Previewing the site
 * uses the SAME pure-React walker as the published site — `<SiteRenderer>`
 * (`runtime/SiteRenderer.tsx`) — fed the doc as plain JSON. So preview ===
 * published, and no ProseMirror is mounted here. (This replaces the earlier
 * interim approach, a second read-only ProseMirror instance.)
 *
 * Source + semantics: the doc + active page are snapshotted from the live
 * editor view (`store.pagesView`) when the overlay mounts. The overlay is
 * mounted only while `store.preview` is true (see `<Shell>`), so edits made
 * after opening appear the next time you toggle preview on — same as pagy's
 * overlay.
 *
 * Navigation + transitions live entirely inside `<SiteRenderer>`: deck-page
 * links switch pages, `deckNav` adds arrow/space/page-key stepping, and each
 * switch plays the destination page's transition (`transitions.ts`).
 */

import { useEffect, useMemo } from "react";

import { getActivePageId } from "./activePagePlugin";
import { SiteRenderer } from "./runtime/SiteRenderer";
import type { JsonNode } from "./runtime/shuffleLayout";
import { usePageBuilderStore } from "./store";

export function PagePreview() {
  const pagesView = usePageBuilderStore((s) => s.pagesView);
  const theme = usePageBuilderStore((s) => s.theme);
  const setPreview = usePageBuilderStore((s) => s.setPreview);
  // Follow the editor's device toggle: in mobile view the preview renders inside
  // the same 430px phone frame the canvas uses, so its `.pb-canvas.site`
  // container narrows and the mobile `@container` rules (hamburger, stacks,
  // type ramp) fire — otherwise Play always showed the full-width desktop
  // layout regardless of the toggle.
  const mobile = usePageBuilderStore((s) => s.mobile);

  // Snapshot the live doc + active page once per open. `pagesView` is stable
  // for the editor's lifetime, and this component is mounted only while
  // previewing, so each open remounts and re-snapshots the current doc.
  const snapshot = useMemo(() => {
    if (!pagesView) return null;
    return {
      doc: pagesView.state.doc.toJSON() as JsonNode,
      activeId: getActivePageId(pagesView.state) ?? undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesView]);

  // Esc exits — owned here since the overlay is mounted only while previewing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPreview]);

  if (!snapshot) return null;

  return (
    <div
      className={`pb-preview${mobile ? " -mobile" : ""}`}
      role="region"
      aria-label="Site preview"
    >
      <SiteRenderer
        doc={snapshot.doc}
        theme={theme}
        initialPageId={snapshot.activeId}
        deckNav
      />
    </div>
  );
}
