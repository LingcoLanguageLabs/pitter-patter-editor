/**
 * Section padding + block top-margin — the px scales, snap, and
 * token→px resolvers shared by the schema, the renderers, and the
 * drag-handle overlays. Ported 1:1 from pagy.co's spacing controls
 * (`overlays/section-chrome.tsx` + `overlays/margin-handle.tsx`):
 *
 *   • Section padding — a single symmetric vertical value (top = bottom),
 *     dragged via the two hatched bands. Stored on `section.padding`,
 *     which accepts a px NUMBER (what a drag writes) or a legacy token
 *     ("small" | "medium" | "large"); both resolve to px here.
 *   • Block top-margin — a per-block px value on every block-group node's
 *     `margin` attr (0 = none). Dragged via the band above the block.
 *
 * Neither touches shuffle: padding/margin are vertical, shuffle owns the
 * horizontal grid. Both serialize as Tailwind-style classes (`py-{unit}` on
 * the section, `mt-{unit}` on the block; 4px/unit) — defined in
 * page-builder.css — identically in the editor and the published
 * `SiteRenderer`.
 */

/** Pagy's section-padding snap scale (`PADDING_SCALE`). */
export const SECTION_PADDING_SNAP = [
  0, 16, 32, 48, 64, 80, 96, 120, 160, 200, 240,
] as const;

/** Pagy's block-margin snap scale (`MARGIN_SNAP`). */
export const BLOCK_MARGIN_SNAP = [
  0, 1, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 120, 160, 200, 240,
] as const;

export const SECTION_PADDING_MAX =
  SECTION_PADDING_SNAP[SECTION_PADDING_SNAP.length - 1];
export const BLOCK_MARGIN_MAX =
  BLOCK_MARGIN_SNAP[BLOCK_MARGIN_SNAP.length - 1];

/** Default section padding in px — pagy's "medium". */
export const SECTION_PADDING_DEFAULT = 80;

/** Default footer vertical padding in px — pagy footers are tighter than a
 *  content section ("small"), so the footer node starts here, not at 80. */
export const FOOTER_PADDING_DEFAULT = 48;

/** Default header vertical padding in px. A header is a compact bar, so it
 *  starts tighter than a section — the same symmetric `py-{unit}` model (top =
 *  bottom) as the footer, dragged via the same hatched bands. */
export const HEADER_PADDING_DEFAULT = 32;

/** Nearest value on `scale` to `v` (pagy's `snapPadding`/`snapMargin`). */
export function snapToScale(scale: readonly number[], v: number): number {
  return scale.reduce(
    (best, cur) => (Math.abs(cur - v) < Math.abs(best - v) ? cur : best),
    scale[0]!,
  );
}

/** A section's vertical padding in px (the `padding` attr is always a number). */
export function sectionPaddingPx(attrs: Record<string, unknown> | undefined): number {
  const p = attrs?.["padding"];
  return typeof p === "number" && Number.isFinite(p) ? p : SECTION_PADDING_DEFAULT;
}

// ── Auto vs explicit ────────────────────────────────────────────────
// Block top-margin distinguishes Auto (unset → use the per-context default
// rhythm) from an explicit value (a number, INCLUDING 0). pagy does the same:
// `undefined` = Auto, a number = explicit. So `0` means "collapse it", NOT
// "auto" — for a container child they render differently (Auto = the default
// 16px rhythm that fills the gap, 0 = no gap). The default itself lives in CSS
// (`.container > .shuffle-block`), so a block with no explicit margin still
// gets spacing — there's no separate flex gap.

/** What an Auto (unset) margin resolves to for a container child — pagy fills
 *  the gap with this. Keep in sync with the `.container > .shuffle-block` CSS. */
export const CONTAINER_DEFAULT_MARGIN = 16;

/** A block's top-margin attr: null = Auto (no explicit margin), else px (incl 0). */
export function blockMarginValue(attrs: Record<string, unknown> | undefined): number | null {
  const m = attrs?.["margin"];
  return typeof m === "number" && Number.isFinite(m) ? m : null;
}
/** Resolved top-margin px (Auto → 0; positioning reads computed style instead). */
export function blockMarginPx(attrs: Record<string, unknown> | undefined): number {
  return blockMarginValue(attrs) ?? 0;
}

// ── Tailwind-style spacing classes ──────────────────────────────────
// Spacing serializes as a class on the 4px-per-unit Tailwind convention
// (1 unit = 0.25rem = 4px) instead of a data attribute, so px ↔ class is
// the source of truth in the DOM: 80px ↔ `py-20`, 128px ↔ `mt-32`. The
// classes are defined in page-builder.css. Sub-4px steps use Tailwind's
// own tokens — `px` (1px) and `0.5` (2px) — the only two off the 4px grid
// in our snap scales.

export const PX_PER_TW_UNIT = 4;

/** px → Tailwind spacing suffix: 80 → "20", 2 → "0.5", 1 → "px". */
export function pxToTwSuffix(px: number): string {
  if (px === 1) return "px";
  return String(px / PX_PER_TW_UNIT);
}

/** Tailwind spacing suffix → px (inverse of `pxToTwSuffix`). */
export function twSuffixToPx(suffix: string): number {
  if (suffix === "px") return 1;
  const n = parseFloat(suffix);
  return Number.isFinite(n) ? n * PX_PER_TW_UNIT : 0;
}

/** Vertical section padding class — `py-{unit}` (top + bottom). */
export function sectionPaddingClass(px: number): string {
  return `py-${pxToTwSuffix(px)}`;
}

/** Block top-margin class — `mt-{unit}`. */
export function blockMarginClass(px: number): string {
  return `mt-${pxToTwSuffix(px)}`;
}

/** Read a `py-{unit}` padding class off a className, or null if absent. */
export function sectionPaddingFromClassName(className: string): number | null {
  const m = /(?:^|\s)py-(px|[\d.]+)(?=\s|$)/.exec(className);
  return m ? twSuffixToPx(m[1]!) : null;
}

// ── Header / footer class chains ────────────────────────────────────
// Live here (not schema.ts) so the runtime walker + NodeViews can share them
// without pulling the heavy schema builder into the published-site bundle —
// the same role `sectionPaddingClass` plays for sections.

/** Class string for a `header` element — shared by the schema `toDOM`,
 *  `HeaderNodeView`, and the runtime walker so all three emit identical markup.
 *  Vertical size is the section `py-{unit}` padding model; `background`
 *  ("blur"/"transparent") and `fixed` become `.pp-header.-*` modifiers; a
 *  non-default `theme` adds the `.theme.-X` scope. */
export function headerClass(attrs: Record<string, unknown> | undefined): string {
  const a = attrs ?? {};
  const bg = (a["background"] as string) || "";
  const theme = (a["theme"] as string) || "";
  return [
    "pp-header",
    // Symmetric vertical padding (top = bottom) — identical to a section /
    // footer, so the bar's height is padding-driven, not a height token.
    sectionPaddingClass(sectionPaddingPx(a)),
    bg ? `-${bg}` : "",
    a["fixed"] ? "-fixed" : "",
    theme ? `theme -${theme}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Class string for a `footer` element — vertical padding `py-{unit}` (the same
 *  px model + class as a section) plus an optional `theme -X` scope. */
export function footerClass(attrs: Record<string, unknown> | undefined): string {
  const theme = (attrs?.["theme"] as string) || "";
  return [
    "pp-footer",
    sectionPaddingClass(sectionPaddingPx(attrs)),
    theme ? `theme -${theme}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
