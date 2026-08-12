/**
 * Photos panel — the Unsplash photo picker, living in the left rail.
 *
 * Opened two ways (both from the "Unsplash" catalog block, via the
 * `unsplashPickerPlugin` state mirrored into the store):
 *   • TARGETED — a target is set (insert at a spot / fill a dropped
 *     placeholder). Clicking a thumbnail applies it there through the stashed
 *     `pagesView` and pings Unsplash's download endpoint (API requirement).
 *   • BROWSE — opened straight from the nav, no target. Thumbnails carry
 *     `data-shuffle-inflatable` so you drag one onto the canvas to drop a
 *     filled image at that exact grid spot (shuffle inflate), same mechanism
 *     as the block catalog.
 *
 * Lives OUTSIDE the ProseMirror context (like Pages/Layers), so it reads picker
 * state from the store and dispatches back through `pagesView`. The actual
 * search/filter/grid UI is the shared `UnsplashBrowser` — also used by
 * `ImagePicker`'s "Unsplash" tab for background/media fields.
 */

import { navigateTo, usePageBuilderStore } from "../store";
import { trackDownload, UnsplashBrowser } from "../UnsplashBrowser";
import { unsplashApply, type UnsplashPhoto } from "../unsplashPicker";

export function PhotosPanel() {
  const target = usePageBuilderStore((s) => s.unsplash.target);
  const targeted = target != null;

  const pick = (photo: UnsplashPhoto) => {
    const view = usePageBuilderStore.getState().pagesView;
    if (!view) return;
    unsplashApply(photo)(view.state, view.dispatch);
    view.focus();
    trackDownload(photo);
  };

  return (
    <>
      <button
        type="button"
        className="pb-panel-back"
        onClick={() => navigateTo("menu")}
        aria-label="Back"
      >
        ←
      </button>
      <h1 className="pb-panel-title">Photos</h1>
      <UnsplashBrowser
        onPick={targeted ? pick : undefined}
        draggable={!targeted}
        hint={targeted ? "Click a photo to place it." : "Drag a photo onto the page."}
      />
    </>
  );
}
