/**
 * Snapshot a rendered page element into a fixed 16:9 thumbnail.
 *
 * Two stages:
 *   1. `html-to-image` (DOM → SVG `foreignObject` → canvas) renders the page
 *      faithfully (subgrid / gradients / fonts) at ≥ the target width, so the
 *      thumbnail downscales (never upscales) and stays crisp.
 *   2. We compose that capture into a 16:9 frame, scaled to the frame's WIDTH
 *      and pinned to the TOP — tall pages clip at the bottom, short pages get
 *      whitespace below — i.e. a presentation-style preview (à la Google
 *      Slides / PowerPoint), NOT a center-crop zoom of variable-height content.
 *
 * Returns null on failure — most commonly a tainted canvas from a cross-origin
 * image (the security model forbids exporting it). Callers fall back to a
 * title card.
 */

import { toCanvas } from "html-to-image";

/** Output thumbnail width in px. Large enough to stay sharp on retina at the
 *  rail's display size (~280px), small enough that caching a deck of pages
 *  stays cheap. Height follows the 16:9 frame. */
const TARGET_WIDTH = 640;
/** Preview aspect — a presentation frame. */
const ASPECT = 16 / 9;

export async function snapshotPage(el: HTMLElement): Promise<string | null> {
  const w = el.offsetWidth || TARGET_WIDTH;
  if (w <= 0) return null;
  // Capture at ~the thumbnail width: downscale wide canvases (the common case,
  // ~1.3k px → ~0.5×), only ever lightly upscaling very narrow ones (capped).
  // Rendering at the full canvas resolution made html-to-image choke on big
  // pages; this keeps the source crisp without that cost.
  const pixelRatio = Math.min(2, TARGET_WIDTH / w);
  // One try around the whole pipeline: a thrown step (tainted canvas, a 0-size
  // source on drawImage, an unsupported encode) must resolve to null, never
  // reject — the factory's queue advances on the returned value.
  try {
    const full = await toCanvas(el, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    if (!full.width || !full.height) return null;
    const outW = TARGET_WIDTH;
    const outH = Math.round(outW / ASPECT);
    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    // Scale the whole page to the frame width and pin it to the top. Anything
    // past the frame height is clipped by the canvas bounds (tall pages); a
    // shorter page leaves the white fill below it.
    const drawH = (full.height / full.width) * outW;
    ctx.drawImage(full, 0, 0, outW, drawH);
    return out.toDataURL("image/webp", 0.85);
  } catch {
    return null;
  }
}
