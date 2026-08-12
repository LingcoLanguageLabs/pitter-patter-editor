/**
 * Tooltip edit popup — opens ABOVE the text selection when the toolbar's
 * Tooltip button is clicked, styled as the dark tooltip bubble itself, so
 * typing the note is a live preview of how the gloss will appear on the site.
 * The student-gloss sibling of `LinkPopover`, but a bubble rather than a card:
 *
 *   • One text field, live-applied to the `tooltip` mark on every keystroke
 *     (so the in-editor hover bubble + the site tooltip update immediately).
 *   • A quiet × removes the gloss outright.
 *
 * Closing with an empty note unwraps the mark (mirrors `LinkPopover`'s
 * empty-URL cleanup), so cancelling never leaves a dead `pp-tooltip-term`
 * span with nothing to show. Close also restores focus and the original
 * text selection, which brings the formatting toolbar back.
 *
 * Anchoring: the selection rect is captured by the opener (focus moves into
 * the field, after which the DOM selection rect is gone) and pinned under a
 * zero-size Radix anchor — the same trick `LinkPopover` uses.
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

export interface TooltipRange {
  from: number;
  to: number;
}

/** First tooltip mark's content inside the range, or null when the range
 *  carries no tooltip mark. Mark edits don't change node sizes, so the range
 *  captured at open stays valid for the popover's lifetime. */
function readTooltipContent(
  state: EditorState,
  range: TooltipRange,
): string | null {
  const type = state.schema.marks["tooltip"];
  if (!type) return null;
  let found: string | null = null;
  state.doc.nodesBetween(range.from, range.to, (node) => {
    if (found != null) return false;
    const mark = type.isInSet(node.marks);
    if (mark) found = (mark.attrs["content"] as string) ?? "";
    return true;
  });
  return found;
}

export function TooltipPopover({
  range,
  rect,
  onClose,
}: {
  range: TooltipRange;
  rect: DOMRect | null;
  onClose: () => void;
}) {
  const editorState = useEditorState();
  // Local draft so the textarea keeps focus/caret while every keystroke also
  // writes through to the mark (the link popover live-updates the same way).
  const [draft, setDraft] = useState(readTooltipContent(editorState, range) ?? "");

  const patchContent = useEditorEventCallback((view, content: string) => {
    const type = view.state.schema.marks["tooltip"];
    if (!type) return;
    view.dispatch(
      view.state.tr.addMark(range.from, range.to, type.create({ content })),
    );
  });

  /** Close, unwrapping an empty gloss, and hand focus + the original text
   *  selection back to the editor. */
  const close = useEditorEventCallback((view, removeTooltip: boolean) => {
    const type = view.state.schema.marks["tooltip"];
    if (type) {
      const content = readTooltipContent(view.state, range);
      if (removeTooltip || !content) {
        view.dispatch(view.state.tr.removeMark(range.from, range.to, type));
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
          className="pb-tooltip-edit"
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <textarea
            className="pb-tooltip-edit-input"
            value={draft}
            placeholder="Tooltip"
            rows={1}
            aria-label="Tooltip note"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(event) => {
              setDraft(event.target.value);
              patchContent(event.target.value);
            }}
            onKeyDown={(event) => {
              // Enter commits; Shift+Enter inserts a newline (notes can wrap).
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                close(false);
              }
            }}
          />
          {draft && (
            <button
              type="button"
              className="pb-tooltip-edit-remove"
              aria-label="Delete tooltip"
              onClick={() => close(true)}
            >
              <Trash size={14} weight="regular" />
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>,
    document.body,
  );
}
