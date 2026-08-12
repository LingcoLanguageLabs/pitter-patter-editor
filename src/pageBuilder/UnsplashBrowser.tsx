/**
 * UnsplashBrowser — search + filter + results grid for Unsplash photos. Pure
 * presentational: fetches from the dev backend proxy (`scripts/server/
 * unsplash.ts`) and hands the chosen photo to `onPick`. No ProseMirror or
 * store dependency, so it drops into anywhere a photo needs picking:
 *
 *   • The left-panel Photos sheet (`panels/PhotosPanel`) — click-to-place /
 *     drag-to-canvas from the "Unsplash" catalog block.
 *   • `ImagePicker`'s "Unsplash" source tab (`blockSettings/forms.tsx`) — any
 *     background/media field: Section background, Card background, the
 *     Image block, a Video's poster.
 *
 * Lives outside `blockSettings/forms.tsx` (rather than reusing its `Field`/
 * `Segmented`) because `ImagePicker` embeds this component — importing back
 * from there would cycle. The two local stand-ins below share the same class
 * names, so the same CSS applies either way.
 */

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { pickAlt, pickSrc, type UnsplashPhoto } from "./unsplashPicker";

// The dev backend proxy (see `scripts/server/unsplash.ts`). Same default as the
// legacy editor extension; point elsewhere by editing this constant.
const BASE_URL = "http://localhost:3001/api/unsplash";

type Orientation = "" | "landscape" | "portrait" | "squarish";
type Order = "relevant" | "latest";

const ORIENTATION_OPTIONS: readonly { value: Orientation; label: string }[] = [
  { value: "", label: "All" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
  { value: "squarish", label: "Square" },
];

const ORDER_OPTIONS: readonly { value: Order; label: string }[] = [
  { value: "relevant", label: "Relevant" },
  { value: "latest", label: "Newest" },
];

/** Unsplash's `color` filter values + a swatch to render each. "" = Any. */
const COLORS: readonly { value: string; label: string; swatch: string }[] = [
  { value: "", label: "Any color", swatch: "" },
  { value: "black_and_white", label: "Black & white", swatch: "linear-gradient(135deg,#111 50%,#fff 50%)" },
  { value: "black", label: "Black", swatch: "#111" },
  { value: "white", label: "White", swatch: "#fff" },
  { value: "yellow", label: "Yellow", swatch: "#f6c945" },
  { value: "orange", label: "Orange", swatch: "#f08a24" },
  { value: "red", label: "Red", swatch: "#e0483d" },
  { value: "purple", label: "Purple", swatch: "#8a5cf6" },
  { value: "magenta", label: "Magenta", swatch: "#d6489b" },
  { value: "green", label: "Green", swatch: "#3fa45b" },
  { value: "teal", label: "Teal", swatch: "#2bb3b3" },
  { value: "blue", label: "Blue", swatch: "#3f7ddb" },
];

/** Serialized `image` node JSON for shuffle's drag-to-create (browse mode). */
function filledImageJSON(photo: UnsplashPhoto): string {
  return JSON.stringify({
    type: "image",
    attrs: { src: pickSrc(photo), alt: pickAlt(photo), aspect: "16/9" },
    content: [{ type: "image_caption" }],
  });
}

/** Ping Unsplash's download endpoint when a photo is actually used — required
 *  by their API guidelines. Best-effort; never blocks the pick. */
export function trackDownload(photo: UnsplashPhoto): void {
  const loc = photo.links.download_location;
  if (!loc) return;
  void fetch(`${BASE_URL}/track-download`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ download_location: loc }),
  }).catch(() => {});
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="pb-field-block">
      <span className="pb-field-label">{label}</span>
      {children}
    </label>
  );
}

function FilterSegmented<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="pb-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="pb-segmented-option"
          data-active={opt.value === value || undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function UnsplashBrowser({
  onPick,
  draggable = false,
  hint,
}: {
  /** Clicking a thumbnail calls this with the chosen photo. */
  onPick?: (photo: UnsplashPhoto) => void;
  /** Thumbnails also carry `data-shuffle-inflatable` for drag-to-canvas. */
  draggable?: boolean;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("");
  const [color, setColor] = useState("");
  const [order, setOrder] = useState<Order>("relevant");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search box on mount.
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Fetch results, debounced, whenever the query or any filter changes. No
  // query → a random spread (orientation still applies); a query → full search.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const q = query.trim();
      const url = new URL(`${BASE_URL}/${q ? "search" : "random"}`);
      if (q) {
        url.searchParams.set("q", q);
        url.searchParams.set("per_page", "24");
        if (color) url.searchParams.set("color", color);
        if (order) url.searchParams.set("order_by", order);
      } else {
        url.searchParams.set("count", "24");
      }
      if (orientation) url.searchParams.set("orientation", orientation);

      setLoading(true);
      fetch(url)
        .then(async (res) => {
          const data = (await res.json()) as {
            results?: UnsplashPhoto[];
            error?: string;
          };
          if (!res.ok || data.error) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          setPhotos(data.results ?? []);
          setError(null);
        })
        .catch((e: unknown) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query, orientation, color, order]);

  return (
    <>
      <div className="pb-unsplash-search">
        <MagnifyingGlass size={14} weight="regular" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search Unsplash…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <FilterField label="Orientation">
        <FilterSegmented
          ariaLabel="Orientation"
          value={orientation}
          options={ORIENTATION_OPTIONS}
          onChange={setOrientation}
        />
      </FilterField>

      <FilterField label="Color">
        <div className="pb-unsplash-colors" role="group" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c.value || "any"}
              type="button"
              className="pb-unsplash-color"
              data-any={c.value === "" || undefined}
              data-active={c.value === color || undefined}
              title={c.label}
              aria-label={c.label}
              style={c.swatch ? { background: c.swatch } : undefined}
              onClick={() => setColor(c.value)}
            />
          ))}
        </div>
      </FilterField>

      {query.trim() && (
        <FilterField label="Sort by">
          <FilterSegmented
            ariaLabel="Sort by"
            value={order}
            options={ORDER_OPTIONS}
            onChange={setOrder}
          />
        </FilterField>
      )}

      {hint && <p className="pb-unsplash-hint">{hint}</p>}

      <div className="pb-unsplash-grid">
        {error && <div className="pb-unsplash-status">{error}</div>}
        {!error && loading && photos.length === 0 && (
          <div className="pb-unsplash-status">Loading…</div>
        )}
        {!error && !loading && photos.length === 0 && (
          <div className="pb-unsplash-status">No photos found.</div>
        )}
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className="pb-unsplash-thumb"
            data-shuffle-inflatable={draggable ? filledImageJSON(photo) : undefined}
            onClick={onPick ? () => onPick(photo) : undefined}
            title={pickAlt(photo) || `Photo by ${photo.user.name}`}
          >
            <img
              src={photo.urls.thumb ?? photo.urls.small ?? ""}
              alt={pickAlt(photo)}
              loading="lazy"
              draggable={false}
            />
            <span className="pb-unsplash-credit">
              <a
                href={`${photo.user.links.html}?utm_source=pitter-patter&utm_medium=referral`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {photo.user.name}
              </a>
            </span>
          </button>
        ))}
      </div>

      <p className="pb-unsplash-footer">
        Photos via{" "}
        <a
          href="https://unsplash.com/?utm_source=pitter-patter&utm_medium=referral"
          target="_blank"
          rel="noopener noreferrer"
        >
          Unsplash
        </a>
      </p>
    </>
  );
}
