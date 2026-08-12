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

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
  Plus,
  Rows,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  Trash,
  X,
} from "@phosphor-icons/react";
import * as Popover from "@radix-ui/react-popover";
import type { Node as PmNode } from "prosemirror-model";
import { type ComponentType, useRef, useState } from "react";

import { usePageBuilderStore } from "../store";
import {
  defaultHeadingSize,
  type Align,
  type AlignContent,
  type ButtonAction,
  type Size,
  type StackAlign,
  type StackAxis,
  type StackJustify,
} from "../schema";
import {
  ensureSectionHtmlId,
  groupByPage,
  listPrompts,
  listSections,
} from "../sectionUtils";
import { GRADE_SCOPES, type GradeScope } from "../items/shared/grading";
import { VARIABLE_DEFS } from "../variables/registry";
import { TooltipButton, TooltipProvider } from "../../editor/menu";
import { trackDownload, UnsplashBrowser } from "../UnsplashBrowser";
import { pickAlt, pickSrc, type UnsplashPhoto } from "../unsplashPicker";

export interface ActiveBlock {
  /** Doc position of the node. */
  pos: number;
  /** The node itself, so forms can read current attrs. */
  node: PmNode;
  /** Schema name of the node — a built-in block type (`keyof typeof
   *  BLOCK_FORMS`) or a registered learning-item type (read from the item
   *  registry). String so both sources are allowed. */
  typeName: string;
}

export interface BlockFormProps {
  active: ActiveBlock;
  setAttr: (name: string, value: unknown) => void;
  /** Caption-child helpers — meaningful only for image (its sole content
   *  child, `image_caption`, always at `pos + 1`); other forms ignore them. */
  setCaptionAttr?: (name: string, value: unknown) => void;
  focusCaption?: () => void;
  clearCaption?: () => void;
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

/**
 * Tracks which of a section's opt-in properties are currently visible: always
 * the ones already carrying an explicit value (`initial`), plus whichever the
 * user has picked from the section's "+" menu this session. Lifted out of the
 * individual rows (the old per-row `useState` in `OptInRow`) so `SectionHeader`
 * can know, on every render, which properties are left to offer — pass a `key`
 * (the block pos) at the call site so this resets when the selection changes.
 */
export function useOptInVisibility(initial: string[]) {
  const [extra, setExtra] = useState<Set<string>>(new Set());
  return {
    isVisible: (key: string) => initial.includes(key) || extra.has(key),
    add: (key: string) => setExtra((prev) => new Set(prev).add(key)),
    remove: (key: string) =>
      setExtra((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
  };
}

/**
 * A section header ("Attributes", "Styles", "Spacing") with a single "+" that
 * offers whichever opt-in properties aren't visible yet — replaces a per-row
 * "+" for each one, which stopped scaling once a section grew past a couple of
 * options. One addable property is a direct toggle (no point menu-ing a single
 * item); more than one opens a dropdown so the section body only ever lists
 * what's actually in use. Renders a bare header once nothing's left to add.
 */
export function SectionHeader({
  label,
  addable,
  onAdd,
}: {
  label: string;
  /** Not-yet-shown optional properties this section could add. */
  addable: { key: string; label: string }[];
  onAdd: (key: string) => void;
}) {
  return (
    <div className="pb-spacing-head">
      <span className="pb-field-label">{label}</span>
      {addable.length === 1 && (
        <button
          type="button"
          className="pb-spacing-add"
          aria-label={`Add ${addable[0].label.toLowerCase()}`}
          onClick={() => onAdd(addable[0].key)}
        >
          <Plus size={14} weight="bold" />
        </button>
      )}
      {addable.length > 1 && (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="pb-spacing-add"
              aria-label={`Add a ${label.toLowerCase()} property`}
            >
              <Plus size={14} weight="bold" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="pb-scrub-menu"
              align="end"
              sideOffset={6}
            >
              {addable.map((opt) => (
                <DropdownMenu.Item
                  key={opt.key}
                  className="pb-scrub-menu-item"
                  onSelect={() => onAdd(opt.key)}
                >
                  {opt.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

/**
 * One opt-in property once `SectionHeader`'s menu has added it — label, the
 * control, and a "✕" that removes it (the call site clears the value AND
 * drops it back out of `useOptInVisibility`'s visible set).
 */
export function PropertyRow({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-attr-row">
      <span className="pb-field-label">{label}</span>
      <div className="pb-attr-control">
        {children}
        <button
          type="button"
          className="pb-scrub-remove"
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={onRemove}
        >
          <X size={12} weight="bold" />
        </button>
      </div>
    </div>
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

// Headings get one tier beyond the shared scale: "XXL" — an oversized, fluid
// headline size (CSS `clamp`) with tight leading + tracking, for cover/hero
// titles like the Iceland deck's giant "Iceland". Continues the XS→XL t-shirt
// scale (so it reads at a glance), but is heading-only and deliberately NOT in
// the shared `SIZE_VALUES`, so the selection toolbar / context menu keep the
// five standard sizes and no paragraph/button can pick a size with no rule. A
// heading carries it as `pp-size-xxl` (attrClassesPlugin maps any `size` value
// generically) → the `.pp-size-xxl` rule in the CSS.
type HeadingSize = Size | "xxl";
const HEADING_SIZE_OPTIONS: readonly { value: HeadingSize; label: string }[] = [
  ...SIZE_OPTIONS,
  { value: "xxl", label: "XXL" },
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
  const dropCap = !!active.node.attrs["dropCap"];
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
      {/* Drop cap — an enlarged first letter (editorial lead-paragraph effect). */}
      <Field label="Drop cap">
        <Segmented
          ariaLabel="Drop cap"
          value={dropCap ? "on" : "off"}
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
          onChange={(v) => setAttr("dropCap", v === "on")}
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
    (active.node.attrs["size"] as HeadingSize | null) ?? defaultHeadingSize(level);
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
          options={HEADING_SIZE_OPTIONS}
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
      <ButtonActionControls active={active} setAttr={setAttr} />
    </>
  );
};

/** Target sub-controls for a navigation action — the URL field (+ open-in-new-
 *  tab), the page dropdown, or the section dropdown that follows the action /
 *  link picker. Shared by the Button "Action" panel and the Image "Link" panel
 *  so both resolve identically through `useNavAction`. "Go to section" lists
 *  every section in the deck; picking one auto-assigns it an anchor id (via
 *  `ensureSectionHtmlId`) so any section is linkable without setting an ID
 *  first. URL/prev/next-without-target render nothing here. Reads the live doc
 *  through the store's `pagesView` to enumerate pages + sections. */
function LinkTargetFields({ active, setAttr }: BlockFormProps) {
  const attrs = active.node.attrs;
  const action = (attrs["action"] as string) ?? "url";
  const pageId = (attrs["pageId"] as string) ?? "";
  const sectionId = (attrs["sectionId"] as string) ?? "";
  const href = (attrs["href"] as string) ?? "";
  const openInNewTab = !!attrs["openInNewTab"];
  const pages = usePageBuilderStore((s) => s.pages);
  const view = usePageBuilderStore((s) => s.pagesView);
  const sections = view ? listSections(view.state) : [];
  // Map the stored anchor id back to a section row so the dropdown shows the
  // current pick (options are keyed by live position; the node stores the
  // stable htmlId).
  const current = sections.find((s) => s.htmlId && s.htmlId === sectionId);

  return (
    <>
      {action === "url" && (
        <>
          <Field label="URL">
            <input
              type="text"
              className="pb-text-input"
              aria-label="Link URL"
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
      )}

      {action === "page" && (
        <Field label="Page">
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
        </Field>
      )}

      {action === "section" && (
        <Field label="Section">
          <select
            className="pb-select"
            aria-label="Linked section"
            value={current ? String(current.pos) : ""}
            onChange={(e) => {
              if (!view) return;
              const pos = Number(e.target.value);
              if (Number.isNaN(pos)) return;
              const id = ensureSectionHtmlId(view, pos);
              if (id) setAttr("sectionId", id);
            }}
          >
            {sections.length === 0 ? (
              <option value="">No sections</option>
            ) : (
              <>
                {!current && <option value="">Choose a section…</option>}
                {groupByPage(sections).map((g, gi) => (
                  <optgroup key={gi} label={g.pageTitle}>
                    {g.rows.map((s) => (
                      <option key={s.pos} value={s.pos}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </>
            )}
          </select>
        </Field>
      )}
    </>
  );
}

/** The button's "Action" — what it does on click. One select (the navigation
 *  ones grouped under "Go to") plus the shared {@link LinkTargetFields}. */
/** Label for the single "Check" action a button offers, per the site's grading
 *  scope (Settings → Grading). One scope ⇒ one Check option. */
const CHECK_LABEL: Record<GradeScope, string> = {
  prompt: "Check prompt",
  section: "Check section",
  page: "Check page",
  activity: "Check activity",
};

const ButtonActionControls: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const action = (attrs["action"] as ButtonAction) ?? "url";
  const pageId = (attrs["pageId"] as string) ?? "";
  const whenDisabled = (attrs["whenDisabled"] as "dim" | "hide") ?? "dim";
  const pages = usePageBuilderStore((s) => s.pages);
  // The site grading scope decides which single Check action is offered.
  const gradingScope = usePageBuilderStore((s) => s.gradingScope);
  // Prev/Next dead-end at the deck's first/last page — the only actions that
  // ever disable — so the "when unavailable" behavior is offered only for them.
  const isEdgeAction = action === "prevPage" || action === "nextPage";
  return (
    <>
      <Field label="Action">
        <select
          className="pb-select"
          aria-label="Button action"
          value={action}
          onChange={(e) => {
            const v = e.target.value as ButtonAction;
            setAttr("action", v);
            // Default a fresh "Page" action to the first slide, like the old
            // page link, so the dropdown isn't blank.
            if (v === "page" && !pageId && pages[0]) setAttr("pageId", pages[0].id);
            // A fresh Check action adopts the site scope + a sensible target:
            // "current" for section/page (great for a pinned bar), none for
            // activity, and a specific prompt is chosen below.
            if (v === "check") {
              setAttr("checkScope", gradingScope);
              setAttr(
                "checkTargetId",
                gradingScope === "section" || gradingScope === "page"
                  ? "current"
                  : "",
              );
            }
          }}
        >
          <option value="url">Open URL</option>
          <optgroup label="Go to">
            <option value="prevPage">Previous page</option>
            <option value="nextPage">Next page</option>
            <option value="page">Page…</option>
            <option value="section">Section…</option>
          </optgroup>
          <optgroup label="Grade">
            <option value="check">{CHECK_LABEL[gradingScope]}</option>
          </optgroup>
        </select>
      </Field>
      {action === "check" ? (
        <CheckTargetControls active={active} setAttr={setAttr} />
      ) : (
        <LinkTargetFields active={active} setAttr={setAttr} />
      )}
      {isEdgeAction && (
        <Field label="When unavailable">
          <Segmented
            ariaLabel="When unavailable"
            value={whenDisabled}
            options={[
              { value: "dim", label: "Dim" },
              { value: "hide", label: "Hide" },
            ]}
            onChange={(v) => setAttr("whenDisabled", v)}
          />
        </Field>
      )}
    </>
  );
};

/** The Check action's target picker, per scope. Section/Page offer a "Current"
 *  option (the in-view section / active page) so one pinned-bar button works
 *  everywhere; otherwise a specific prompt/section/page (picking a section
 *  auto-assigns its anchor id, like nav). Activity needs no target. */
const CheckTargetControls: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const scope = (attrs["checkScope"] as string) ?? "";
  const targetId = (attrs["checkTargetId"] as string) ?? "";
  const pages = usePageBuilderStore((s) => s.pages);
  const view = usePageBuilderStore((s) => s.pagesView);
  const prompts = view ? listPrompts(view.state) : [];
  const sections = view ? listSections(view.state) : [];
  const currentSection = sections.find(
    (s) => s.htmlId && s.htmlId === targetId,
  );

  if (scope === "activity") return null;

  if (scope === "prompt") {
    return (
      <Field label="Prompt">
        <select
          className="pb-select"
          aria-label="Checked prompt"
          value={targetId}
          onChange={(e) => setAttr("checkTargetId", e.target.value)}
        >
          {prompts.length === 0 ? (
            <option value="">No prompts</option>
          ) : (
            <>
              {!targetId && <option value="">Choose a prompt…</option>}
              {groupByPage(prompts).map((g, gi) => (
                <optgroup key={gi} label={g.pageTitle}>
                  {g.rows.map((p) => (
                    <option key={p.itemId} value={p.itemId}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </>
          )}
        </select>
      </Field>
    );
  }

  if (scope === "page") {
    return (
      <Field label="Page">
        <select
          className="pb-select"
          aria-label="Checked page"
          value={targetId || "current"}
          onChange={(e) => setAttr("checkTargetId", e.target.value)}
        >
          <option value="current">Current page</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  // section
  return (
    <Field label="Section">
      <select
        className="pb-select"
        aria-label="Checked section"
        value={targetId === "current" ? "current" : currentSection ? String(currentSection.pos) : "current"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "current") {
            setAttr("checkTargetId", "current");
            return;
          }
          if (!view) return;
          const pos = Number(v);
          if (Number.isNaN(pos)) return;
          const id = ensureSectionHtmlId(view, pos);
          if (id) setAttr("checkTargetId", id);
        }}
      >
        <option value="current">Current section</option>
        {groupByPage(sections).map((g, gi) => (
          <optgroup key={gi} label={g.pageTitle}>
            {g.rows.map((s) => (
              <option key={s.pos} value={s.pos}>
                {s.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
};

/** The image's "Link" — make the image clickable. A segmented None / URL / Page
 *  / Section picker (pagy's image-link control, with Section added per request)
 *  plus the shared {@link LinkTargetFields}. Reuses the same `action` attrs as
 *  buttons / text links, so the runtime's `useNavAction` resolves an image
 *  click identically. "none" (the default) = the image isn't a link. Prev/next
 *  aren't surfaced for images (an image links to an explicit destination). */
const ImageLinkControls: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const action = (attrs["action"] as string) ?? "none";
  const pageId = (attrs["pageId"] as string) ?? "";
  const pages = usePageBuilderStore((s) => s.pages);
  // Collapse the wider action vocab to the four the image offers; anything else
  // (e.g. a pasted prev/next) reads as "none" in the picker.
  const value =
    action === "url" || action === "page" || action === "section"
      ? action
      : "none";
  return (
    <>
      <Field label="Link">
        <Segmented
          ariaLabel="Image link"
          value={value}
          options={[
            { value: "none", label: "None" },
            { value: "url", label: "URL" },
            { value: "page", label: "Page" },
            { value: "section", label: "Section" },
          ]}
          onChange={(v) => {
            setAttr("action", v);
            // Default a fresh "Page" link to the first slide so it isn't blank.
            if (v === "page" && !pageId && pages[0]) setAttr("pageId", pages[0].id);
          }}
        />
      </Field>
      <LinkTargetFields active={active} setAttr={setAttr} />
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
 *  backend yet, so an uploaded file becomes an inline data URL — but the
 *  preview replaces a raw URL field, so it's never shown (matches pagy).
 *  `onChange("")` clears; the second (optional) arg carries Unsplash's alt
 *  text when a photo was picked, ignored by callers that don't take it.
 *  `kind` swaps the accept filter and the preview: a muted `<video>`
 *  thumbnail for video, the native `<audio>` control for audio (which is
 *  also where the audio actually plays — the canvas control is inert). The
 *  audio layout drops the 16/9 thumbnail box (see `[data-kind="audio"]` in
 *  page-builder.css).
 *
 *  For `kind === "image"` the trigger opens a small popover with an
 *  Unsplash/Upload source tab (mirroring `ColorPicker`'s Solid/Gradient
 *  split) — so any picture field can pull from Unsplash, not just the
 *  dedicated "Unsplash" catalog block. Video/audio keep the plain
 *  file-picker button, since Unsplash only has photos. */
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
  onChange: (url: string, alt?: string) => void;
  kind?: "image" | "video" | "audio";
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"unsplash" | "upload">("unsplash");

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result));
      setOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const onPickPhoto = (photo: UnsplashPhoto) => {
    onChange(pickSrc(photo), pickAlt(photo));
    trackDownload(photo);
    setOpen(false);
  };

  const browsable = kind === "image";

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
        {browsable ? (
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
              <button type="button" className="pb-image-replace">
                {src ? "Replace" : "Choose image"}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="pb-image-pick-pop"
                side="bottom"
                align="start"
                sideOffset={8}
                collisionPadding={8}
              >
                <Segmented
                  ariaLabel="Image source"
                  value={source}
                  options={[
                    { value: "unsplash", label: "Unsplash" },
                    { value: "upload", label: "Upload" },
                  ]}
                  onChange={setSource}
                />
                {source === "unsplash" ? (
                  <UnsplashBrowser onPick={onPickPhoto} hint="Click a photo to use it." />
                ) : (
                  <button
                    type="button"
                    className="pb-image-replace pb-image-pick-upload"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose file from device
                  </button>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          <button
            type="button"
            className="pb-image-replace"
            onClick={() => fileInputRef.current?.click()}
          >
            {src ? "Replace" : "Choose file"}
          </button>
        )}
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
const ImageForm: BlockForm = ({
  active,
  setAttr,
  setCaptionAttr,
  focusCaption,
  clearCaption,
}) => {
  const attrs = active.node.attrs;
  const src = (attrs["src"] as string) ?? "";
  // Alt text moved to the shared Attributes section (BlockSettings) — it's a
  // semantic HTML attribute, so it shares a home with Language.
  const aspect = (attrs["aspect"] as string) ?? "16/9";
  const shape = (attrs["shape"] as string) ?? "";
  const radius = (attrs["radius"] as string) ?? "medium";
  const frame = (attrs["frame"] as string) ?? "";
  const width = attrs["width"] as number | null;
  // Caption — the image's sole content child (`image_caption`). Opt-in like
  // Attributes' Language/Placeholder: empty by default (nothing to clutter
  // the panel with), "+" reveals the row AND focuses the caption on canvas so
  // typing starts immediately, ✕ clears its text and hides the row again.
  // Reactive to on-canvas edits too — typing a caption directly reveals the
  // row here on the next render, same as those opt-in fields.
  const captionNode = active.node.firstChild;
  const captionAlign = (captionNode?.attrs["align"] as Align) ?? "center";
  const captionHasText = (captionNode?.content.size ?? 0) > 0;
  const {
    isVisible: captionVisible,
    add: showCaption,
    remove: hideCaption,
  } = useOptInVisibility(captionHasText ? ["caption"] : []);
  const align = (attrs["align"] as Align) ?? "center";
  const pinned = attrs["position"] === "pinned";
  const numAttr = (name: string, fallback: number) =>
    typeof attrs[name] === "number" ? (attrs[name] as number) : fallback;

  return (
    <>
      <ImagePicker
        src={src}
        onChange={(url, alt) => {
          setAttr("src", url);
          if (alt) setAttr("alt", alt);
        }}
      />
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
      <Field label="Depth">
        <Segmented
          ariaLabel="Depth"
          value={frame}
          options={[
            { value: "", label: "Plain" },
            { value: "inset", label: "Inset" },
            { value: "shadow", label: "Shadow" },
          ]}
          onChange={(v) => setAttr("frame", v)}
        />
      </Field>
      {/* Pagy's conditional Align: only meaningful once the image has been
          resized narrower than its footprint (the inset handles set `width`;
          full width is stored as `null`) — and only in flow mode (a floating
          image is placed by x/y). Mirrors `{element.width && ...}`. */}
      {!pinned && width != null && width < 100 && (
        <Field label="Align">
          <Segmented
            ariaLabel="Align"
            value={align}
            options={ALIGN_OPTIONS}
            onChange={(v) => setAttr("align", v)}
          />
        </Field>
      )}
      {/* Floating (pinned) — lift the image out of the grid to overlap / bleed
          for decorative polish. Drag it on the canvas; X/Y/Width are % of the
          section. (Min/Max width to keep it sane on mobile live in the shared
          Width-limits control below the per-type settings.) */}
      <Field label="Position">
        <Segmented
          ariaLabel="Position"
          value={pinned ? "pinned" : "flow"}
          options={[
            { value: "flow", label: "In flow" },
            { value: "pinned", label: "Floating" },
          ]}
          onChange={(v) => setAttr("position", v)}
        />
      </Field>
      {pinned && (
        <>
          <Field label="X (%)">
            <input
              type="number"
              className="pb-text-input"
              value={numAttr("pinX", 50)}
              onChange={(e) => setAttr("pinX", Number(e.target.value))}
            />
          </Field>
          <Field label="Y (%)">
            <input
              type="number"
              className="pb-text-input"
              value={numAttr("pinY", 50)}
              onChange={(e) => setAttr("pinY", Number(e.target.value))}
            />
          </Field>
          <Field label="Width (%)">
            <input
              type="number"
              className="pb-text-input"
              value={numAttr("pinW", 40)}
              onChange={(e) => setAttr("pinW", Number(e.target.value))}
            />
          </Field>
          <p className="pb-field-hint">
            Drag the image on the canvas to place it — values are a % of the
            section, so it scales with the layout.
          </p>
        </>
      )}
      {/* Caption — opt-in row (see comment above); alignment only, since
          removing it is just clearing its text. */}
      <div className="pb-attributes">
        <SectionHeader
          label="Caption"
          addable={
            captionVisible("caption")
              ? []
              : [{ key: "caption", label: "Caption" }]
          }
          onAdd={() => {
            showCaption("caption");
            focusCaption?.();
          }}
        />
        {captionVisible("caption") && (
          <PropertyRow
            label="Alignment"
            onRemove={() => {
              hideCaption("caption");
              clearCaption?.();
            }}
          >
            <Segmented
              ariaLabel="Caption alignment"
              value={captionAlign}
              options={ALIGN_OPTIONS}
              onChange={(v) => setCaptionAttr?.("align", v)}
            />
          </PropertyRow>
        )}
      </div>
      {/* Make the image a link — open a URL or jump to a page / section. */}
      <ImageLinkControls active={active} setAttr={setAttr} />
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
      <Field label="Depth">
        <Segmented
          ariaLabel="Depth"
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

/* Embed is pagy's video embed-providers as a standalone block: paste a share
   URL (YouTube / Vimeo / Loom / Maps / …) rather than upload a file, so the
   source is a plain URL field instead of the ImagePicker. Aspect/Corners/Depth
   mirror the video panel; Title is the iframe's accessible name. */
const EmbedForm: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const src = (attrs["src"] as string) ?? "";
  const title = (attrs["title"] as string) ?? "";
  const aspect = (attrs["aspect"] as string) ?? "16/9";
  const radius = (attrs["radius"] as string) ?? "medium";
  const frame = (attrs["frame"] as string) ?? "";
  return (
    <>
      <Field label="URL">
        <input
          type="text"
          className="pb-text-input"
          aria-label="Embed URL"
          placeholder="Paste a YouTube, Vimeo, Maps… link"
          value={src}
          onChange={(e) => setAttr("src", e.target.value)}
        />
      </Field>
      <Field label="Aspect ratio">
        <Segmented
          ariaLabel="Aspect ratio"
          value={aspect}
          options={[
            { value: "16/9", label: "16:9" },
            { value: "4/3", label: "4:3" },
            { value: "1/1", label: "1:1" },
          ]}
          onChange={(v) => setAttr("aspect", v)}
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
      <Field label="Depth">
        <Segmented
          ariaLabel="Depth"
          value={frame}
          options={[
            { value: "", label: "Plain" },
            { value: "inset", label: "Inset" },
            { value: "shadow", label: "Shadow" },
          ]}
          onChange={(v) => setAttr("frame", v)}
        />
      </Field>
      {/* Accessible name for the iframe — only matters once there's a source,
          like the video panel's playback options. */}
      {src && (
        <Field label="Title">
          <input
            type="text"
            className="pb-text-input"
            aria-label="Embed title"
            placeholder="Embedded content"
            value={title}
            onChange={(e) => setAttr("title", e.target.value)}
          />
        </Field>
      )}
    </>
  );
};

/* Vector is the inline-SVG block: paste raw `<svg>` markup (rendered inline so it
   scales crisply + can be recolored via `currentColor`), with a hosted-URL
   fallback when no markup is set. Width is a % of the footprint (like the image
   block); Align places it when < full; Recolor drives a monochrome icon's color
   from a theme slot. Alt text lives in the shared Attributes section (the block
   carries an `alt` attr). */
const VectorForm: BlockForm = ({ active, setAttr }) => {
  const attrs = active.node.attrs;
  const markup = (attrs["markup"] as string) ?? "";
  const src = (attrs["src"] as string) ?? "";
  const width =
    typeof attrs["width"] === "number" ? (attrs["width"] as number) : 100;
  const align = (attrs["align"] as string) ?? "center";
  const tint = (attrs["tint"] as string) ?? "";
  return (
    <>
      <Field label="SVG code">
        <textarea
          className="pb-text-input pb-svg-code"
          aria-label="SVG code"
          placeholder="Paste <svg>…</svg> markup"
          rows={4}
          value={markup}
          onChange={(e) => setAttr("markup", e.target.value)}
        />
      </Field>
      {/* A hosted .svg URL is only offered when there's no pasted markup — markup
          wins at render time, so showing both at once would be ambiguous. */}
      {!markup && (
        <Field label="Image URL">
          <input
            type="text"
            className="pb-text-input"
            aria-label="SVG URL"
            placeholder="…or link an .svg file"
            value={src}
            onChange={(e) => setAttr("src", e.target.value)}
          />
        </Field>
      )}
      <Field label="Width">
        <Segmented
          ariaLabel="Width"
          value={String(width)}
          options={[
            { value: "25", label: "25%" },
            { value: "50", label: "50%" },
            { value: "75", label: "75%" },
            { value: "100", label: "Full" },
          ]}
          onChange={(v) => setAttr("width", Number(v))}
        />
      </Field>
      {/* Align only matters once the vector is narrower than its footprint. */}
      {width !== 100 && (
        <Field label="Align">
          <Segmented
            ariaLabel="Align"
            value={align}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
            onChange={(v) => setAttr("align", v)}
          />
        </Field>
      )}
      {/* Recolor a monochrome SVG from a theme slot (drives `currentColor`);
          "Original" keeps the SVG's own colors. */}
      <Field label="Recolor">
        <select
          className="pb-text-input"
          aria-label="Recolor"
          value={tint}
          onChange={(e) => setAttr("tint", e.target.value)}
        >
          <option value="">Original</option>
          <option value="muted">Muted</option>
          <option value="light">Light</option>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="tertiary">Tertiary</option>
        </select>
      </Field>
    </>
  );
};

/* Progress — a bar/ring whose value is an expression over the variable scope
   (score.percent, page.number/page.count, …). The value/max inputs offer the
   variable names via a shared <datalist> for quick completion. */
const PROGRESS_COLORS: readonly { value: string; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "tertiary", label: "Tertiary" },
  { value: "neutral", label: "Neutral" },
];

const ProgressForm: BlockForm = ({ active, setAttr }) => {
  const a = active.node.attrs;
  const value = (a["value"] as string) ?? "score.percent";
  const max = (a["max"] as string) ?? "100";
  const display = (a["display"] as string) ?? "bar";
  const color = (a["color"] as string) ?? "primary";
  const label = (a["label"] as string) ?? "";
  const showValue = a["showValue"] !== false;
  return (
    <>
      <datalist id="pb-progress-vars">
        {VARIABLE_DEFS.filter((v) => v.kind === "number").map((v) => (
          <option key={v.name} value={v.name}>
            {v.label}
          </option>
        ))}
      </datalist>
      <Field label="Display">
        <Segmented
          ariaLabel="Display"
          value={display}
          options={[
            { value: "bar", label: "Bar" },
            { value: "ring", label: "Ring" },
          ]}
          onChange={(v) => setAttr("display", v)}
        />
      </Field>
      <Field label="Value">
        <input
          type="text"
          className="pb-text-input"
          list="pb-progress-vars"
          aria-label="Value expression"
          placeholder="score.percent"
          value={value}
          onChange={(e) => setAttr("value", e.target.value)}
        />
      </Field>
      <Field label="Max">
        <input
          type="text"
          className="pb-text-input"
          list="pb-progress-vars"
          aria-label="Max expression"
          placeholder="100"
          value={max}
          onChange={(e) => setAttr("max", e.target.value)}
        />
      </Field>
      <p className="pb-field-hint">
        Use a variable or expression — e.g. <code>score.percent</code>, or{" "}
        <code>page.number / page.count * 100</code> for activity progress.
      </p>
      <Field label="Color">
        <Segmented
          ariaLabel="Color"
          value={color}
          options={PROGRESS_COLORS}
          onChange={(v) => setAttr("color", v)}
        />
      </Field>
      <Field label="Label">
        <input
          type="text"
          className="pb-text-input"
          aria-label="Label"
          placeholder="Optional caption"
          value={label}
          onChange={(e) => setAttr("label", e.target.value)}
        />
      </Field>
      <Field label="Show value">
        <Segmented
          ariaLabel="Show value"
          value={showValue ? "yes" : "no"}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          onChange={(v) => setAttr("showValue", v === "yes")}
        />
      </Field>
    </>
  );
};

/* Divider — just the line style. */
const DividerForm: BlockForm = ({ active, setAttr }) => {
  const variant = (active.node.attrs["variant"] as string) ?? "solid";
  return (
    <Field label="Style">
      <Segmented
        ariaLabel="Divider style"
        value={variant}
        options={[
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ]}
        onChange={(v) => setAttr("variant", v)}
      />
    </Field>
  );
};

/* Accordion — single-open (classic) vs allow several panels open at once. */
const AccordionForm: BlockForm = ({ active, setAttr }) => {
  const allowMultiple = !!active.node.attrs["allowMultiple"];
  return (
    <Field label="Open">
      <Segmented
        ariaLabel="Open mode"
        value={allowMultiple ? "multiple" : "single"}
        options={[
          { value: "single", label: "One at a time" },
          { value: "multiple", label: "Multiple" },
        ]}
        onChange={(v) => setAttr("allowMultiple", v === "multiple")}
      />
    </Field>
  );
};

/* Tabs — which tab opens first on the published site. */
const TabsForm: BlockForm = ({ active, setAttr }) => {
  const count = active.node.childCount;
  const current = Math.min(
    typeof active.node.attrs["active"] === "number"
      ? (active.node.attrs["active"] as number)
      : 0,
    Math.max(0, count - 1),
  );
  return (
    <Field label="Opens on">
      <Segmented
        ariaLabel="Default tab"
        value={String(current)}
        options={Array.from({ length: count }, (_, i) => ({
          value: String(i),
          label: `Tab ${i + 1}`,
        }))}
        onChange={(v) => setAttr("active", Number(v))}
      />
    </Field>
  );
};

/* Table — block-level STYLE (borders / stripes / density). The structural
   row/column/header ops live in the floating `TableToolbar` (it appears whenever
   the cursor is in a cell); this panel shows when the table block itself is
   selected (via its handle), so it's the right home for whole-table styling. */
const TableForm: BlockForm = ({ active, setAttr }) => {
  const a = active.node.attrs;
  const borders = (a["borders"] as string) ?? "all";
  const striped = !!a["striped"];
  const density = (a["density"] as string) ?? "comfortable";
  return (
    <>
      <Field label="Borders">
        <Segmented
          ariaLabel="Borders"
          value={borders}
          options={[
            { value: "all", label: "All" },
            { value: "rows", label: "Rows" },
            { value: "none", label: "None" },
          ]}
          onChange={(v) => setAttr("borders", v)}
        />
      </Field>
      <Field label="Row stripes">
        <Segmented
          ariaLabel="Row stripes"
          value={striped ? "on" : "off"}
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
          onChange={(v) => setAttr("striped", v === "on")}
        />
      </Field>
      <Field label="Density">
        <Segmented
          ariaLabel="Density"
          value={density}
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
          onChange={(v) => setAttr("density", v)}
        />
      </Field>
      <p className="pb-field-hint">
        Click into a cell — the table toolbar adds and removes rows and columns.
      </p>
    </>
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
  const frame = (attrs["frame"] as string) ?? "";
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
      <Field label="Depth">
        <Segmented
          ariaLabel="Depth"
          value={frame}
          options={[
            { value: "", label: "Plain" },
            { value: "inset", label: "Inset" },
            { value: "shadow", label: "Shadow" },
          ]}
          onChange={(v) => setAttr("frame", v)}
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
  embed: EmbedForm,
  vector: VectorForm,
  divider: DividerForm,
  progress: ProgressForm,
  accordion: AccordionForm,
  tabs: TabsForm,
  table: TableForm,
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
  embed: "Embed",
  vector: "Vector",
  divider: "Divider",
  progress: "Progress",
  accordion: "Accordion",
  tabs: "Tabs",
  table: "Table",
  row: "Row",
  container: "Container",
  card: "Card",
};
