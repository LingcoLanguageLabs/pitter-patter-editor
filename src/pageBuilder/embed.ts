/**
 * Embed-URL helpers.
 *
 * The `embed` block stores the RAW URL a user pastes (a normal share link) in
 * its `src` attr — that's what they edit. Both the editor NodeView and the
 * runtime walker render through `toEmbedUrl`, which rewrites the common video
 * providers' watch/share links to their iframe-embeddable form so a pasted
 * `youtube.com/watch?v=…` "just works". Anything we don't recognise (a Google
 * Map, a CodePen, an already-embeddable URL) is rendered verbatim.
 *
 * This mirrors pagy's video embed-provider handling, lifted out to its own
 * block: pitter-patter's `video` block is upload-only (see `videoSpec`), so
 * provider embeds live here instead.
 */

/** Rewrite a pasted share/watch URL to its iframe-embeddable form. Unknown
 *  hosts (and already-embeddable URLs) pass through unchanged. */
export function toEmbedUrl(raw: string): string {
  const url = (raw || "").trim();
  if (!url) return "";

  // YouTube — watch / youtu.be / shorts / live all carry the 11-char id.
  let m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (m) return `https://www.youtube.com/embed/${m[1]}`;

  // Vimeo — vimeo.com/123456789 (or already /video/123456789).
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;

  // Loom — loom.com/share/<id> (or already /embed/<id>).
  m = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (m) return `https://www.loom.com/embed/${m[1]}`;

  return url;
}

/** A short, human label for a pasted embed URL — drives the Layers-panel row
 *  name (like the media blocks' filename). Known providers get their name;
 *  everything else is just "Embed". */
export function embedLabel(raw: string): string {
  const url = (raw || "").toLowerCase();
  if (!url) return "Embed";
  if (/youtu\.?be/.test(url)) return "YouTube";
  if (/vimeo\.com/.test(url)) return "Vimeo";
  if (/loom\.com/.test(url)) return "Loom";
  if (/figma\.com/.test(url)) return "Figma";
  if (/codepen\.io/.test(url)) return "CodePen";
  if (/(google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl)/.test(url))
    return "Map";
  if (/(open\.)?spotify\.com/.test(url)) return "Spotify";
  return "Embed";
}

/** The iframe `allow` policy — the superset video providers want (fullscreen,
 *  autoplay, PiP, …). Harmless for non-video embeds, which simply ignore it. */
export const EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
