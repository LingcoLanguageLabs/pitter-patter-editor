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
  AlignCenterVertical,
  AlignTop,
  Rows,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  Trash,
} from "@phosphor-icons/react";
import type { Node as PmNode } from "prosemirror-model";
import { type ComponentType, useRef } from "react";

import { usePageBuilderStore } from "../store";
import { defaultHeadingSize, type Align, type AlignContent, type Size } from "../schema";

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
    <div className="pb-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="pb-segmented-option"
          data-active={opt.value === value || undefined}
          title={opt.title}
          aria-label={opt.title}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
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

const ALIGN_OPTIONS: readonly { value: Align; label: React.ReactNode }[] = [
  { value: "left", label: <TextAlignLeft size={16} /> },
  { value: "center", label: <TextAlignCenter size={16} /> },
  { value: "right", label: <TextAlignRight size={16} /> },
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

/** Color swatches sourced from the active theme. Mirrors pagy's
 *  contrast-aware color picker (we ship the picker; full contrast
 *  warnings can come later if needed). */
function ButtonColorPicker({
  value,
  onChange,
}: {
  value: ButtonColor;
  onChange: (next: ButtonColor) => void;
}) {
  const theme = usePageBuilderStore((s) => s.theme);
  const slots: { key: ButtonColor; color: string | undefined }[] = [
    { key: "neutral", color: theme.colors.neutral },
    { key: "primary", color: theme.colors.primary },
    { key: "secondary", color: theme.colors.secondary },
    { key: "tertiary", color: theme.colors.tertiary },
  ];
  return (
    <div className="pb-color-swatches" role="group" aria-label="Color">
      {slots.map((slot) => (
        <button
          key={slot.key}
          type="button"
          className="pb-color-swatch"
          data-active={slot.key === value || undefined}
          style={{ background: slot.color ?? "#ccc" }}
          onClick={() => onChange(slot.key)}
          aria-label={slot.key}
        />
      ))}
    </div>
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
  const href = (active.node.attrs["href"] as string) ?? "#";
  const openInNewTab = !!active.node.attrs["openInNewTab"];
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
        <Segmented
          ariaLabel="Type"
          value={variant}
          options={[
            { value: "primary", label: "Filled" },
            { value: "secondary", label: "Outline" },
            { value: "ghost", label: "Ghost" },
          ]}
          onChange={(v) => setAttr("variant", v)}
        />
      </Field>
      <Field label="Color">
        <ButtonColorPicker
          value={color}
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
        <input
          type="text"
          className="pb-text-input"
          value={href}
          onChange={(e) => setAttr("href", e.target.value)}
        />
      </Field>
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
 *  A container stacks vertically, so there's no vertical alignment to expose;
 *  it uses `ContainerForm` (header actions only, no body). */
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

/** Container settings — intentionally no body. A container is a vertical
 *  stack with no alignment control (that's row-only). Keeping it registered
 *  in `BLOCK_FORMS` is what makes its settings popover appear at all (the
 *  header: convert to Card, duplicate, delete); there's just no form below. */
const ContainerForm: BlockForm = () => null;

// ────────────────────────────────────────────────────────────────
// Card form
// ────────────────────────────────────────────────────────────────

type CardColor = "" | "neutral" | "primary" | "secondary" | "tertiary";

/** Card background swatches: a "default" (page background) plus the
 *  theme slots. Like `ButtonColorPicker` but with the default option,
 *  matching pagy's card Colors. */
function CardColorPicker({
  value,
  onChange,
}: {
  value: CardColor;
  onChange: (next: CardColor) => void;
}) {
  const theme = usePageBuilderStore((s) => s.theme);
  const slots: { key: CardColor; color: string | undefined; label: string }[] =
    [
      { key: "", color: theme.colors.background, label: "Default" },
      { key: "neutral", color: theme.colors.neutral, label: "Neutral" },
      { key: "primary", color: theme.colors.primary, label: "Primary" },
      { key: "secondary", color: theme.colors.secondary, label: "Secondary" },
      { key: "tertiary", color: theme.colors.tertiary, label: "Tertiary" },
    ];
  return (
    <div className="pb-color-swatches" role="group" aria-label="Colors">
      {slots.map((slot) => (
        <button
          key={slot.key || "default"}
          type="button"
          className="pb-color-swatch"
          data-active={slot.key === value || undefined}
          style={{ background: slot.color ?? "#ccc" }}
          onClick={() => onChange(slot.key)}
          aria-label={slot.label}
          title={slot.label}
        />
      ))}
    </div>
  );
}

/* Mirrors pagy's card panel (`panels/block-settings/card.tsx`):
   Padding, Corners, Background image, Overlay (only with an image),
   Colors. */
const CardForm: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const padding = (attrs["padding"] as Size) ?? "m";
  const radius = (attrs["radius"] as string) ?? "large";
  const color = (attrs["color"] as CardColor) ?? "";
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
        <CardColorPicker
          value={color}
          onChange={(v) => setAttr("color", v)}
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
