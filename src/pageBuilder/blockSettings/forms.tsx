/**
 * Per-block-type settings forms.
 *
 * Adding a new form is two things:
 *   1. Implement a `BlockForm` component for the node type.
 *   2. Add it to `BLOCK_FORMS` + a label to `BLOCK_TITLES`. The
 *      orchestrator in `BlockSettings.tsx` does the rest.
 *
 * Every form receives the `ActiveBlock` plus a `setAttr(name, value)`
 * helper that dispatches a `setNodeAttribute` transaction. That keeps
 * the forms purely presentational — no PM imports here.
 *
 * Forms map onto pagy's `panels/block-settings.tsx` per-type branches.
 * Stack is intentionally omitted (redundant with container) — every
 * other supported node type has a form.
 */

import {
  AlignBottom,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignTop,
  ArrowsHorizontal,
  ArrowsOutLineHorizontal,
  ArrowsOutLineVertical,
  ArrowsVertical,
  Rows,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  Trash,
  X,
} from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";
import { type ComponentType, useRef } from "react";

import { usePageBuilderStore } from "../store";
import {
  defaultHeadingSize,
  type Align,
  type AlignContent,
  type Size,
  type StackAlign,
  type StackAxis,
  type StackJustify,
} from "../schema";
import { TooltipButton, TooltipProvider } from "../../editor/menu";

export interface ActiveBlock {
  /** Doc position of the node. */
  pos: number;
  /** The node itself, so forms can read current attrs. */
  node: PmNode;
  /** Schema name of the node. */
  typeName: keyof typeof BLOCK_FORMS;
}

export interface BlockFormProps {
  active: ActiveBlock;
  setAttr: (name: string, value: unknown) => void;
}

type BlockForm = ComponentType<BlockFormProps>;

// ────────────────────────────────────────────────────────────────
// Reusable controls
// ────────────────────────────────────────────────────────────────

/** Segmented-button group — used for align, size, variant, width,
 *  align-content, and anywhere else with a small set of options.
 *  Exported for the section settings popover (`SectionSettings.tsx`). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: React.ReactNode; title?: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <div className="pb-segmented" role="group" aria-label={ariaLabel}>
        {options.map((opt) =>
          // Options with a `title` are icon-only (align, align-content) — give
          // them a Radix tooltip. Text-label options (XS/S/M…) are already
          // self-describing, so they stay as plain buttons.
          opt.title ? (
            <TooltipButton
              key={opt.value}
              label={opt.title}
              className="pb-segmented-option"
              data-active={opt.value === value || undefined}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </TooltipButton>
          ) : (
            <button
              key={opt.value}
              type="button"
              className="pb-segmented-option"
              data-active={opt.value === value || undefined}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          ),
        )}
      </div>
    </TooltipProvider>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="pb-field-block">
      <span className="pb-field-label">{label}</span>
      {children}
    </label>
  );
}

const ALIGN_OPTIONS: readonly {
  value: Align;
  label: React.ReactNode;
  title: string;
}[] = [
  { value: "left", label: <TextAlignLeft size={16} />, title: "Left" },
  { value: "center", label: <TextAlignCenter size={16} />, title: "Center" },
  { value: "right", label: <TextAlignRight size={16} />, title: "Right" },
];

const SIZE_OPTIONS: readonly { value: Size; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

const ALIGN_CONTENT_OPTIONS: readonly {
  value: AlignContent;
  label: React.ReactNode;
  title: string;
}[] = [
  { value: "top", label: <AlignTop size={16} />, title: "Top" },
  { value: "middle", label: <AlignCenterVertical size={16} />, title: "Center" },
  { value: "bottom", label: <AlignBottom size={16} />, title: "Bottom" },
  // `Rows` is two equal stacked bars (no centre line) — the same icon
  // the Row block uses in the catalog, and exactly the "stretch" glyph
  // we wanted, so reuse it instead of a hand-rolled SVG.
  { value: "stretch", label: <Rows size={16} />, title: "Stretch" },
];

// ────────────────────────────────────────────────────────────────
// Text-block forms (paragraph, heading)
// ────────────────────────────────────────────────────────────────

const ParagraphForm: BlockForm = ({ active, setAttr }) => {
  const align = (active.node.attrs["align"] as Align) ?? "left";
  const size = (active.node.attrs["size"] as Size) ?? "m";
  return (
    <>
      <Field label="Align">
        <Segmented
          ariaLabel="Align"
          value={align}
          options={ALIGN_OPTIONS}
          onChange={(v) => setAttr("align", v)}
        />
      </Field>
      <Field label="Size">
        <Segmented
          ariaLabel="Size"
          value={size}
          options={SIZE_OPTIONS}
          onChange={(v) => setAttr("size", v)}
        />
      </Field>
    </>
  );
};

const HeadingForm: BlockForm = ({ active, setAttr }) => {
  const level = (active.node.attrs["level"] as number) ?? 1;
  const align = (active.node.attrs["align"] as Align) ?? "left";
  // size: null = "use the level's default" — show that default as the
  // active segment so the control always reflects what's rendered.
  const size =
    (active.node.attrs["size"] as Size | null) ?? defaultHeadingSize(level);
  return (
    <>
      <Field label="Level">
        <Segmented
          ariaLabel="Level"
          value={String(level)}
          options={[1, 2, 3, 4].map((n) => ({
            value: String(n),
            label: `H${n}`,
          }))}
          onChange={(v) => {
            // Changing level re-stamps that level's default size (pagy
            // does the same on type switch) — a custom size is a choice
            // about the old level, not the new one.
            const next = Number(v);
            setAttr("level", next);
            setAttr("size", defaultHeadingSize(next));
          }}
        />
      </Field>
      <Field label="Align">
        <Segmented
          ariaLabel="Align"
          value={align}
          options={ALIGN_OPTIONS}
          onChange={(v) => setAttr("align", v)}
        />
      </Field>
      <Field label="Size">
        <Segmented
          ariaLabel="Size"
          value={size}
          options={SIZE_OPTIONS}
          onChange={(v) => setAttr("size", v)}
        />
      </Field>
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Button form
// ────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonColor = "neutral" | "primary" | "secondary" | "tertiary";

// ── Contrast helpers — drive pagy's "ineligible color" X. Filled works with
// any hue (it's the fill), but Outline/Ghost paint the hue as *text*, so one
// too close to the page background reads as near-invisible.
function srgbChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relLuminance(hex: string): number {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  if (h.length !== 6) return 0;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return 0;
  return (
    0.2126 * srgbChannel((n >> 16) & 255) +
    0.7152 * srgbChannel((n >> 8) & 255) +
    0.0722 * srgbChannel(n & 255)
  );
}
function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return la >= lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}
/** Whether `color` can be used for `variant` against the page `bg`. Filled:
 *  always. Outline/ghost: only if the hue stands out enough to read as text
 *  (so cream/white on a white page are excluded, like pagy). */
function isColorEligible(
  color: string | undefined,
  bg: string,
  variant: ButtonVariant,
): boolean {
  if (variant === "primary" || !color) return true;
  return contrastRatio(color, bg) >= 1.7;
}

/** Color swatches sourced from the active theme. Contrast-aware like pagy:
 *  hues that can't carry an outline/ghost button get a disabled X. */
function ButtonColorPicker({
  value,
  variant,
  onChange,
}: {
  value: ButtonColor;
  variant: ButtonVariant;
  onChange: (next: ButtonColor) => void;
}) {
  const theme = usePageBuilderStore((s) => s.theme);
  const bg = theme.colors.background;
  const slots: { key: ButtonColor; color: string | undefined }[] = [
    { key: "neutral", color: theme.colors.neutral },
    { key: "primary", color: theme.colors.primary },
    { key: "secondary", color: theme.colors.secondary },
    { key: "tertiary", color: theme.colors.tertiary },
  ];
  return (
    <div className="pb-color-swatches" role="group" aria-label="Color">
      {slots.map((slot) => {
        const eligible = isColorEligible(slot.color, bg, variant);
        return (
          <button
            key={slot.key}
            type="button"
            className="pb-color-swatch"
            data-active={slot.key === value || undefined}
            data-ineligible={!eligible || undefined}
            disabled={!eligible}
            style={{ background: slot.color ?? "#ccc" }}
            onClick={() => eligible && onChange(slot.key)}
            aria-label={
              eligible ? slot.key : `${slot.key} — too low contrast for this style`
            }
            title={eligible ? undefined : "Too low contrast for an outline/ghost button"}
          >
            {!eligible && <X size={13} weight="bold" />}
          </button>
        );
      })}
    </div>
  );
}

/** Live style preview shown inside the Type control — pagy renders the
 *  three button styles rather than text labels. The popover is portaled outside
 *  the themed canvas, so it has no `--color-*` palette; `.pb-button-type-preview`
 *  (page-builder.css) re-points the button vars at the editor-chrome `--pb-*`
 *  tokens so every style stays legible in both light and dark chrome. */
function ButtonTypePreview({ variant }: { variant: ButtonVariant }) {
  return (
    <span
      className={`pp-button pp-button--${variant} pb-button-type-preview`}
      aria-hidden
    >
      Button
    </span>
  );
}

/** Pagy's Type control: three separate cards (not a segmented track), each
 *  showing the style live. The chosen card gets a dark ring; the rest sit on
 *  a faint fill. */
function ButtonTypePicker({
  value,
  onChange,
}: {
  value: ButtonVariant;
  onChange: (next: ButtonVariant) => void;
}) {
  const options: readonly { value: ButtonVariant; title: string }[] = [
    { value: "primary", title: "Filled" },
    { value: "secondary", title: "Outline" },
    { value: "ghost", title: "Ghost" },
  ];
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <div className="pb-type-picker" role="group" aria-label="Type">
        {options.map((opt) => (
          <TooltipButton
            key={opt.value}
            label={opt.title}
            className="pb-type-picker-option"
            data-active={opt.value === value || undefined}
            aria-pressed={opt.value === value}
            onClick={() => onChange(opt.value)}
          >
            <ButtonTypePreview variant={opt.value} />
          </TooltipButton>
        ))}
      </div>
    </TooltipProvider>
  );
}

const ButtonForm: BlockForm = ({ active, setAttr }) => {
  const label = (active.node.attrs["label"] as string) ?? "";
  const variant =
    (active.node.attrs["variant"] as ButtonVariant) ?? "primary";
  const color = (active.node.attrs["color"] as ButtonColor) ?? "primary";
  const size = (active.node.attrs["size"] as Size) ?? "s";
  const width = (active.node.attrs["width"] as "fit" | "fill") ?? "fit";
  const align = (active.node.attrs["align"] as Align) ?? "left";
  const linkType = (active.node.attrs["linkType"] as "page" | "url") ?? "url";
  const pageId = (active.node.attrs["pageId"] as string) ?? "";
  const href = (active.node.attrs["href"] as string) ?? "#";
  const openInNewTab = !!active.node.attrs["openInNewTab"];
  const pages = usePageBuilderStore((s) => s.pages);
  const theme = usePageBuilderStore((s) => s.theme);
  return (
    <>
      <Field label="Label">
        <input
          type="text"
          className="pb-text-input"
          value={label}
          onChange={(e) => setAttr("label", e.target.value)}
        />
      </Field>
      <Field label="Type">
        <ButtonTypePicker
          value={variant}
          onChange={(v) => {
            setAttr("variant", v);
            // If switching to a style the current color can't carry (an
            // outline/ghost in a near-background hue), fall back to neutral
            // so the button never renders invisible.
            if (!isColorEligible(theme.colors[color], theme.colors.background, v)) {
              setAttr("color", "neutral");
            }
          }}
        />
      </Field>
      <Field label="Color">
        <ButtonColorPicker
          value={color}
          variant={variant}
          onChange={(v) => setAttr("color", v)}
        />
      </Field>
      <Field label="Size">
        <Segmented
          ariaLabel="Size"
          value={size}
          options={SIZE_OPTIONS}
          onChange={(v) => setAttr("size", v)}
        />
      </Field>
      <Field label="Width">
        <Segmented
          ariaLabel="Width"
          value={width}
          options={[
            { value: "fit", label: "Fit" },
            { value: "fill", label: "Fill" },
          ]}
          onChange={(v) => setAttr("width", v)}
        />
      </Field>
      {/* Align only matters when the button is Fit — a Fill button
          stretches across its whole column span, so there's nothing to
          align. Hide the control entirely when Fill, mirroring pagy. */}
      {width === "fit" && (
        <Field label="Align">
          <Segmented
            ariaLabel="Align"
            value={align}
            options={ALIGN_OPTIONS}
            onChange={(v) => setAttr("align", v)}
          />
        </Field>
      )}
      <Field label="Link">
        <Segmented
          ariaLabel="Link type"
          value={linkType}
          options={[
            { value: "page", label: "Page" },
            { value: "url", label: "URL" },
          ]}
          onChange={(v) => {
            setAttr("linkType", v);
            // Default the page link to the first slide so the dropdown
            // isn't blank on first switch (pagy shows "Home").
            if (v === "page" && !pageId && pages[0]) setAttr("pageId", pages[0].id);
          }}
        />
      </Field>
      {linkType === "page" ? (
        <select
          className="pb-select"
          aria-label="Linked page"
          value={pageId}
          onChange={(e) => setAttr("pageId", e.target.value)}
        >
          {pages.length === 0 && <option value="">No pages</option>}
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          className="pb-text-input"
          aria-label="Link URL"
          value={href}
          onChange={(e) => setAttr("href", e.target.value)}
        />
      )}
      <Field label="Open in new tab">
        <Segmented
          ariaLabel="Open in new tab"
          value={openInNewTab ? "yes" : "no"}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
          onChange={(v) => setAttr("openInNewTab", v === "yes")}
        />
      </Field>
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Image form
// ────────────────────────────────────────────────────────────────

/** Corner-radius glyph — a rounded square at increasing radii. Drawn
 *  inline (not from an icon set) so the three options read as one
 *  consistent set, à la pagy's Corners control. */
function CornerIcon({ rx }: { rx: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx={rx}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Thumbnail + Replace/Choose-file + Delete for an image / video / audio
 *  URL attr. Shared by the Image block, the Video + Audio blocks, the
 *  Card's background image, and the Section's background media. No upload
 *  backend yet, so the chosen file becomes an inline data URL — but the
 *  preview replaces a raw URL field, so it's never shown (matches pagy).
 *  `onChange("")` clears. `kind` swaps the accept filter and the preview:
 *  a muted `<video>` thumbnail for video, the native `<audio>` control
 *  for audio (which is also where the audio actually plays — the canvas
 *  control is inert). The audio layout drops the 16/9 thumbnail box (see
 *  `[data-kind="audio"]` in page-builder.css). */
const ACCEPT_BY_KIND: Record<"image" | "video" | "audio", string> = {
  image: "image/*",
  video: "video/mp4,video/webm,.mp4,.webm",
  audio: "audio/*,.mp3,.wav,.m4a,.ogg",
};

export function ImagePicker({
  src,
  onChange,
  kind = "image",
}: {
  src: string;
  onChange: (dataUrl: string) => void;
  kind?: "image" | "video" | "audio";
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <div
      className="pb-image-preview"
      data-kind={kind}
      data-empty={!src || undefined}
    >
      {src ? (
        kind === "video" ? (
          <video className="pb-image-preview-img" src={src} muted playsInline />
        ) : kind === "audio" ? (
          <audio className="pb-audio-preview" src={src} controls />
        ) : (
          <img className="pb-image-preview-img" src={src} alt="" />
        )
      ) : (
        <span className="pb-image-preview-placeholder">
          {kind === "video"
            ? "No video"
            : kind === "audio"
              ? "No audio"
              : "No image"}
        </span>
      )}
      <div className="pb-image-preview-actions">
        <button
          type="button"
          className="pb-image-replace"
          onClick={() => fileInputRef.current?.click()}
        >
          {src ? "Replace" : "Choose file"}
        </button>
        {src && (
          <button
            type="button"
            className="pb-image-delete"
            aria-label={`Remove ${kind}`}
            onClick={() => onChange("")}
          >
            <Trash size={14} weight="regular" />
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_BY_KIND[kind]}
        hidden
        onChange={onPickFile}
      />
    </div>
  );
}

/* Mirrors pagy's image panel (`panels/block-settings/image.tsx`):
   Shape, then Aspect ratio (rectangles only), Corners (non-circles
   only), Style. Square/Circle force a 1:1 ratio so Aspect is hidden;
   Circle is fully round so Corners is hidden. */
const ImageForm: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const src = (attrs["src"] as string) ?? "";
  const alt = (attrs["alt"] as string) ?? "";
  const aspect = (attrs["aspect"] as string) ?? "16/9";
  const shape = (attrs["shape"] as string) ?? "";
  const radius = (attrs["radius"] as string) ?? "medium";
  const frame = (attrs["frame"] as string) ?? "";
  const width = attrs["width"] as number | null;
  const align = (attrs["align"] as Align) ?? "center";

  return (
    <>
      <ImagePicker src={src} onChange={(url) => setAttr("src", url)} />
      <Field label="Shape">
        <Segmented
          ariaLabel="Shape"
          value={shape}
          options={[
            { value: "", label: "Rectangle" },
            { value: "square", label: "Square" },
            { value: "circle", label: "Circle" },
          ]}
          onChange={(v) => setAttr("shape", v)}
        />
      </Field>
      {shape === "" && (
        <Field label="Aspect ratio">
          <Segmented
            ariaLabel="Aspect ratio"
            value={aspect}
            options={[
              { value: "original", label: "Original" },
              { value: "16/9", label: "16:9" },
              { value: "3/2", label: "3:2" },
              { value: "4/3", label: "4:3" },
            ]}
            onChange={(v) => setAttr("aspect", v)}
          />
        </Field>
      )}
      {shape !== "circle" && (
        <Field label="Corners">
          <Segmented
            ariaLabel="Corners"
            value={radius}
            options={[
              { value: "none", label: <CornerIcon rx={0.5} /> },
              { value: "medium", label: <CornerIcon rx={3} /> },
              { value: "large", label: <CornerIcon rx={6} /> },
            ]}
            onChange={(v) => setAttr("radius", v)}
          />
        </Field>
      )}
      <Field label="Style">
        <Segmented
          ariaLabel="Style"
          value={frame}
          options={[
            { value: "", label: "Plain" },
            { value: "inset", label: "Inset" },
            { value: "shadow", label: "Shadow" },
          ]}
          onChange={(v) => setAttr("frame", v)}
        />
      </Field>
      <Field label="Alt text">
        <input
          type="text"
          className="pb-text-input"
          value={alt}
          onChange={(e) => setAttr("alt", e.target.value)}
        />
      </Field>
      {/* Pagy's conditional Align: only meaningful once the image has been
          resized narrower than its footprint (the inset handles set `width`;
          full width is stored as `null`). Mirrors `{element.width && ...}`. */}
      {width != null && width < 100 && (
        <Field label="Align">
          <Segmented
            ariaLabel="Align"
            value={align}
            options={ALIGN_OPTIONS}
            onChange={(v) => setAttr("align", v)}
          />
        </Field>
      )}
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Video + audio forms
// ────────────────────────────────────────────────────────────────

/** Yes/No segmented control over a boolean attr — the shape pagy's video
 *  panel uses for Show controls / Autoplay / Muted / Loop. */
function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Field label={label}>
      <Segmented
        ariaLabel={label}
        value={value ? "yes" : "no"}
        options={[
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ]}
        onChange={(v) => onChange(v === "yes")}
      />
    </Field>
  );
}

/* Mirrors pagy's video panel (`panels/block-settings/video.tsx`): the
   media picker (Add / Replace), Style, Corners, then — once a source is
   set — Show controls, Autoplay, Muted, Loop, and a Preview image
   (poster). We have no embed providers, so the picker uploads a file
   (inline data URL) rather than pagy's Embed/Upload tab split. */
const VideoForm: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const src = (attrs["src"] as string) ?? "";
  const poster = (attrs["poster"] as string) ?? "";
  const radius = (attrs["radius"] as string) ?? "medium";
  const frame = (attrs["frame"] as string) ?? "";
  const controls = !!attrs["controls"];
  const autoplay = !!attrs["autoplay"];
  const muted = !!attrs["muted"];
  const loop = !!attrs["loop"];
  return (
    <>
      <ImagePicker
        src={src}
        kind="video"
        onChange={(url) => setAttr("src", url)}
      />
      <Field label="Style">
        <Segmented
          ariaLabel="Style"
          value={frame}
          options={[
            { value: "", label: "Plain" },
            { value: "inset", label: "Inset" },
            { value: "shadow", label: "Shadow" },
          ]}
          onChange={(v) => setAttr("frame", v)}
        />
      </Field>
      <Field label="Corners">
        <Segmented
          ariaLabel="Corners"
          value={radius}
          options={[
            { value: "none", label: <CornerIcon rx={0.5} /> },
            { value: "medium", label: <CornerIcon rx={3} /> },
            { value: "large", label: <CornerIcon rx={6} /> },
          ]}
          onChange={(v) => setAttr("radius", v)}
        />
      </Field>
      {/* Playback options only matter once there's a source — pagy hides
          them too until the video is set. */}
      {src && (
        <>
          <YesNoField
            label="Show controls"
            value={controls}
            onChange={(v) => setAttr("controls", v)}
          />
          <YesNoField
            label="Autoplay"
            value={autoplay}
            onChange={(v) => setAttr("autoplay", v)}
          />
          <YesNoField
            label="Muted"
            value={muted}
            onChange={(v) => setAttr("muted", v)}
          />
          <YesNoField
            label="Loop"
            value={loop}
            onChange={(v) => setAttr("loop", v)}
          />
          <Field label="Preview image">
            <ImagePicker
              src={poster}
              onChange={(url) => setAttr("poster", url)}
            />
          </Field>
        </>
      )}
    </>
  );
};

/* Audio has no pagy equivalent and no media frame — just the source
   picker, which doubles as the inline player (the canvas control is
   inert; playback happens here, like the video preview). */
const AudioForm: BlockForm = ({ active, setAttr }) => {
  const src = (active.node.attrs["src"] as string) ?? "";
  return (
    <ImagePicker src={src} kind="audio" onChange={(url) => setAttr("src", url)} />
  );
};

// ────────────────────────────────────────────────────────────────
// Layout-block forms (row, container)
// ────────────────────────────────────────────────────────────────

/** A row's cross-axis (vertical) alignment is owned by shuffle's own
 *  `alignment` attr, which shuffle writes as an *inline* `align-items`
 *  style on the row (see its plugin decoration). An inline style beats any
 *  class, so this control MUST drive `alignment` directly — the old
 *  `alignContent` class had matching CSS but could never win against the
 *  inline `align-items`. These maps bridge our top/middle/bottom/stretch
 *  labels to shuffle's start/center/end/stretch. */
type ShuffleAlignment = "start" | "center" | "end" | "stretch";
const ALIGN_CONTENT_TO_SHUFFLE: Record<AlignContent, ShuffleAlignment> = {
  top: "start",
  middle: "center",
  bottom: "end",
  stretch: "stretch",
};
const SHUFFLE_TO_ALIGN_CONTENT: Record<ShuffleAlignment, AlignContent> = {
  start: "top",
  center: "middle",
  end: "bottom",
  stretch: "stretch",
};

/** Row-only. A row lays its children out horizontally, so aligning them on
 *  the cross (vertical) axis — top / middle / bottom / stretch — is meaningful.
 *  (A container has its own axis-aware alignment controls — see
 *  `ContainerForm` — driven by classes, not shuffle's inline `align-items`.) */
const RowAlignForm: BlockForm = ({ active, setAttr }) => {
  const alignment =
    (active.node.attrs["alignment"] as ShuffleAlignment) ?? "center";
  return (
    <Field label="Align content">
      <Segmented
        ariaLabel="Align content"
        value={SHUFFLE_TO_ALIGN_CONTENT[alignment] ?? "middle"}
        options={ALIGN_CONTENT_OPTIONS}
        onChange={(v) => setAttr("alignment", ALIGN_CONTENT_TO_SHUFFLE[v])}
      />
    </Field>
  );
};

// Container = a flex stack ("a container on another axis"). The alignment
// controls are axis-relative, so their icons flip with the chosen direction:
// "Align" is the CROSS axis (align-items), "Distribute" is the MAIN axis
// (justify-content). The attr values stay canonical (start/center/end[/stretch
// | between]); only the glyphs + labels change so they always read correctly.
type StackOpt<T extends string> = { value: T; label: React.ReactNode; title?: string };

const AXIS_OPTIONS: readonly StackOpt<StackAxis>[] = [
  { value: "vertical", label: <ArrowsVertical size={16} />, title: "Vertical" },
  { value: "horizontal", label: <ArrowsHorizontal size={16} />, title: "Horizontal" },
];

// Cross-axis align (align-items). Vertical stack → cross is horizontal;
// horizontal stack → cross is vertical. `Rows` is the shared "stretch" glyph.
const ALIGN_CROSS_HORIZONTAL: readonly StackOpt<StackAlign>[] = [
  { value: "start", label: <AlignLeft size={16} />, title: "Left" },
  { value: "center", label: <AlignCenterHorizontal size={16} />, title: "Center" },
  { value: "end", label: <AlignRight size={16} />, title: "Right" },
  { value: "stretch", label: <Rows size={16} />, title: "Stretch" },
];
const ALIGN_CROSS_VERTICAL: readonly StackOpt<StackAlign>[] = [
  { value: "start", label: <AlignTop size={16} />, title: "Top" },
  { value: "center", label: <AlignCenterVertical size={16} />, title: "Middle" },
  { value: "end", label: <AlignBottom size={16} />, title: "Bottom" },
  { value: "stretch", label: <Rows size={16} />, title: "Stretch" },
];

// Main-axis distribution (justify-content). Vertical stack → main is vertical;
// horizontal stack → main is horizontal. The "between" glyph points along the
// main axis (space pushed apart).
const JUSTIFY_MAIN_VERTICAL: readonly StackOpt<StackJustify>[] = [
  { value: "start", label: <AlignTop size={16} />, title: "Top" },
  { value: "center", label: <AlignCenterVertical size={16} />, title: "Middle" },
  { value: "end", label: <AlignBottom size={16} />, title: "Bottom" },
  { value: "between", label: <ArrowsOutLineVertical size={16} />, title: "Space between" },
];
const JUSTIFY_MAIN_HORIZONTAL: readonly StackOpt<StackJustify>[] = [
  { value: "start", label: <AlignLeft size={16} />, title: "Left" },
  { value: "center", label: <AlignCenterHorizontal size={16} />, title: "Center" },
  { value: "end", label: <AlignRight size={16} />, title: "Right" },
  { value: "between", label: <ArrowsOutLineHorizontal size={16} />, title: "Space between" },
];

const WRAP_OPTIONS: readonly StackOpt<"wrap" | "nowrap">[] = [
  { value: "wrap", label: "Wrap" },
  { value: "nowrap", label: "No wrap" },
];

/** Container settings — the flex-stack controls. Direction flips the main axis;
 *  Align (cross axis) and Distribute (main axis) use axis-aware icon sets so
 *  they always read correctly; Wrap only matters once children flow
 *  horizontally, so it's shown only then. Inter-child spacing is NOT here — it's
 *  each child's leading margin (the canvas handle + the Spacing section below),
 *  axis-relative, so the rhythm stays individually adjustable. */
const ContainerForm: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const axis = (attrs["axis"] as StackAxis) ?? "vertical";
  const align = (attrs["stackAlign"] as StackAlign) ?? "stretch";
  const justify = (attrs["stackJustify"] as StackJustify) ?? "start";
  const wrap = attrs["wrap"] !== false;
  const horizontal = axis === "horizontal";
  return (
    <>
      <Field label="Direction">
        <Segmented
          ariaLabel="Direction"
          value={axis}
          options={AXIS_OPTIONS}
          onChange={(v) => setAttr("axis", v)}
        />
      </Field>
      <Field label="Align">
        <Segmented
          ariaLabel="Align"
          value={align}
          options={horizontal ? ALIGN_CROSS_VERTICAL : ALIGN_CROSS_HORIZONTAL}
          onChange={(v) => setAttr("stackAlign", v)}
        />
      </Field>
      <Field label="Distribute">
        <Segmented
          ariaLabel="Distribute"
          value={justify}
          options={horizontal ? JUSTIFY_MAIN_HORIZONTAL : JUSTIFY_MAIN_VERTICAL}
          onChange={(v) => setAttr("stackJustify", v)}
        />
      </Field>
      {horizontal && (
        <Field label="Wrap">
          <Segmented
            ariaLabel="Wrap"
            value={wrap ? "wrap" : "nowrap"}
            options={WRAP_OPTIONS}
            onChange={(v) => setAttr("wrap", v === "wrap")}
          />
        </Field>
      )}
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Card form
// ────────────────────────────────────────────────────────────────

type CardTheme = "" | "inverted" | "primary" | "secondary" | "tertiary";

/**
 * Theme-variant swatches ("A" specimens) — the shared "Colors" picker for BOTH
 * the Section settings popover and the Card form, so they speak the same
 * vocabulary (Default / Inverted / Primary / Secondary / Tertiary) and the same
 * self-rescoping `theme -X` mechanism (themeToCss's `.theme.-X` scopes). Picking
 * a variant rescopes the element's whole palette *on itself*, so a card's look
 * depends only on its own choice — never on the section it sits in. That's what
 * keeps a section recolor from bleeding into its cards, and what makes each
 * swatch a faithful preview of the result. Each swatch carries `site theme -X`,
 * so it renders live against the current theme; secondary/tertiary show only
 * when the theme defines them, exactly like pagy.
 */
export function ThemeVariantPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const theme = usePageBuilderStore((s) => s.theme);
  const variants: { key: string; className: string; label: string }[] = [
    { key: "", className: "-default", label: "Default" },
    { key: "inverted", className: "-inverted", label: "Inverted" },
    { key: "primary", className: "-primary", label: "Primary" },
    ...(theme.colors.secondary
      ? [{ key: "secondary", className: "-secondary", label: "Secondary" }]
      : []),
    ...(theme.colors.tertiary
      ? [{ key: "tertiary", className: "-tertiary", label: "Tertiary" }]
      : []),
  ];
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <div className="pb-theme-swatches" role="group" aria-label="Colors">
        {variants.map((v) => (
          <TooltipButton
            key={v.key || "default"}
            label={v.label}
            className={`pb-theme-swatch site theme ${v.className}`}
            data-active={v.key === value || undefined}
            onClick={() => onChange(v.key)}
          >
            A
          </TooltipButton>
        ))}
      </div>
    </TooltipProvider>
  );
}

/* Mirrors pagy's card panel (`panels/block-settings/card.tsx`):
   Padding, Corners, Background image, Overlay (only with an image),
   Colors. */
const CardForm: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const padding = (attrs["padding"] as Size) ?? "m";
  const radius = (attrs["radius"] as string) ?? "large";
  const cardTheme = (attrs["theme"] as CardTheme) ?? "";
  const image = (attrs["image"] as string) ?? "";
  const overlay = (attrs["overlay"] as string) ?? "";
  return (
    <>
      <Field label="Padding">
        <Segmented
          ariaLabel="Padding"
          value={padding}
          options={SIZE_OPTIONS}
          onChange={(v) => setAttr("padding", v)}
        />
      </Field>
      <Field label="Corners">
        <Segmented
          ariaLabel="Corners"
          value={radius}
          options={[
            { value: "none", label: <CornerIcon rx={0.5} /> },
            { value: "medium", label: <CornerIcon rx={3} /> },
            { value: "large", label: <CornerIcon rx={6} /> },
          ]}
          onChange={(v) => setAttr("radius", v)}
        />
      </Field>
      <Field label="Background image">
        <ImagePicker src={image} onChange={(url) => setAttr("image", url)} />
      </Field>
      {image && (
        <Field label="Overlay">
          <Segmented
            ariaLabel="Overlay"
            value={overlay}
            options={[
              { value: "", label: "None" },
              { value: "light", label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "strong", label: "Strong" },
            ]}
            onChange={(v) => setAttr("overlay", v)}
          />
        </Field>
      )}
      <Field label="Colors">
        <ThemeVariantPicker
          value={cardTheme}
          onChange={(v) => setAttr("theme", v)}
        />
      </Field>
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────

export const BLOCK_FORMS = {
  paragraph: ParagraphForm,
  heading: HeadingForm,
  button: ButtonForm,
  image: ImageForm,
  video: VideoForm,
  audio: AudioForm,
  row: RowAlignForm,
  container: ContainerForm,
  card: CardForm,
} as const;

export const BLOCK_TITLES: Record<keyof typeof BLOCK_FORMS, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  button: "Button",
  image: "Image",
  video: "Video",
  audio: "Audio",
  row: "Row",
  container: "Container",
  card: "Card",
};
