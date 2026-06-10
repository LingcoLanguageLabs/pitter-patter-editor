/**
 * Link popover — opens below the text selection when the toolbar's
 * Link button is clicked. Pagy's link-target popover translated to
 * our link mark:
 *
 *   • URL input, live-applied to the mark on every keystroke.
 *   • Style: Underlined (default) / Minimal.
 *   • Open in a new tab: No / Yes.
 *   • Trash removes the link outright.
 *
 * Pagy also offers "To: Page" targeting a site page; the page builder
 * has no pages model yet, so this popover is URL-only (the mark spec
 * in schema.ts notes the same seam).
 *
 * Closing with an empty URL unwraps the link — mirrors pagy's
 * `closeLinkPopover`, so cancelling the flow never leaves a dead
 * `<a href="">` in the doc. Close also restores focus and the original
 * text selection, which brings the formatting toolbar back.
 *
 * Anchoring: the selection rect is captured by the opener (focus moves
 * into the URL input, after which the DOM selection rect is gone) and
 * pinned under a zero-size Radix anchor — the same trick as pagy's
 * `mirrorRef` div.
 */

"use client";

import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { Trash } from "@phosphor-icons/react";
import * as Popover from "@radix-ui/react-popover";
import type { EditorState } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Field, Segmented } from "./blockSettings/forms";
import type { LinkVariant } from "./schema";

export interface LinkRange {
  from: number;
  to: number;
}

interface LinkAttrs {
  href: string;
  newTab: boolean;
  variant: LinkVariant;
}

/** First link mark's attrs inside the range, or null. Mark edits don't
 *  change node sizes, so the range captured at open stays valid for
 *  the popover's lifetime. */
function readLinkAttrs(state: EditorState, range: LinkRange): LinkAttrs | null {
  const linkType = state.schema.marks["link"];
  if (!linkType) return null;
  let found: LinkAttrs | null = null;
  state.doc.nodesBetween(range.from, range.to, (node) => {
    if (found) return false;
    const mark = linkType.isInSet(node.marks);
    if (mark) found = mark.attrs as LinkAttrs;
    return true;
  });
  return found;
}

export function LinkPopover({
  range,
  rect,
  onClose,
}: {
  range: LinkRange;
  rect: DOMRect | null;
  onClose: () => void;
}) {
  const editorState = useEditorState();
  const attrs = readLinkAttrs(editorState, range);
  // Local draft so the input keeps focus/caret while every keystroke
  // also writes through to the mark (pagy live-updates the same way).
  const [draft, setDraft] = useState(attrs?.href ?? "");

  const patchAttrs = useEditorEventCallback(
    (view, patch: Partial<LinkAttrs>) => {
      const linkType = view.state.schema.marks["link"];
      if (!linkType) return;
      const current = readLinkAttrs(view.state, range) ?? {
        href: "",
        newTab: false,
        variant: "" as LinkVariant,
      };
      view.dispatch(
        view.state.tr.addMark(
          range.from,
          range.to,
          linkType.create({ ...current, ...patch }),
        ),
      );
    },
  );

  /** Close, unwrapping an empty link (pagy's `closeLinkPopover`), and
   *  hand focus + the original text selection back to the editor. */
  const close = useEditorEventCallback((view, removeLink: boolean) => {
    const linkType = view.state.schema.marks["link"];
    if (linkType) {
      const current = readLinkAttrs(view.state, range);
      if (removeLink || (current && !current.href)) {
        view.dispatch(
          view.state.tr.removeMark(range.from, range.to, linkType),
        );
      }
    }
    view.focus();
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, range.from, range.to),
      ),
    );
    onClose();
  });

  return createPortal(
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <Popover.Anchor asChild>
        <div
          style={{
            position: "fixed",
            top: rect?.top ?? 0,
            left: rect?.left ?? 0,
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            pointerEvents: "none",
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="pb-link-popover"
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <header className="pb-link-popover-header">
            <span className="pb-link-popover-title">Link</span>
            <button
              type="button"
              className="pb-section-tool -destructive"
              aria-label="Remove link"
              title="Remove link"
              onClick={() => close(true)}
            >
              <Trash size={15} weight="regular" />
            </button>
          </header>

          <Field label="URL">
            <input
              className="pb-text-input"
              value={draft}
              placeholder="Enter your link"
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onChange={(event) => {
                setDraft(event.target.value);
                patchAttrs({ href: event.target.value });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  close(false);
                }
              }}
            />
          </Field>

          <Field label="Style">
            <Segmented<LinkVariant>
              value={attrs?.variant ?? ""}
              ariaLabel="Link style"
              options={[
                { value: "", label: <u>Underlined</u> },
                { value: "minimal", label: "Minimal" },
              ]}
              onChange={(variant) => patchAttrs({ variant })}
            />
          </Field>

          <Field label="Open in a new tab">
            <Segmented<"no" | "yes">
              value={attrs?.newTab ? "yes" : "no"}
              ariaLabel="Open in a new tab"
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
              onChange={(value) => patchAttrs({ newTab: value === "yes" })}
            />
          </Field>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>,
    document.body,
  );
}
