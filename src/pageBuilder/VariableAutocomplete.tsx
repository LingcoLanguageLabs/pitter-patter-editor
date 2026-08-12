/**
 * Variable autocomplete — the typeahead that appears when the author types `{{`
 * anywhere in editable text. It lists the {@link VARIABLE_DEFS} (filtered by the
 * partial name), and selecting one inserts `{{full.name}}` and moves the cursor
 * past it.
 *
 * Built as an editor overlay (the same pattern as `TextSelectionToolbar`): it
 * reads the editor state to detect an open `{{` token, anchors a floating menu
 * at the caret via floating-ui's virtual reference, and dispatches the insertion
 * through the view. Keyboard nav (↑/↓/Enter/Tab/Esc) is handled by a
 * capture-phase keydown listener so it beats ProseMirror's own handling while
 * the menu is open.
 */

"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { TextSelection, type EditorState } from "prosemirror-state";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { VARIABLE_DEFS } from "./variables/registry";

interface Trigger {
  /** Partial name typed after `{{` (may be empty). */
  query: string;
  /** Doc position of the opening `{{`. */
  from: number;
  /** Doc position of the caret. */
  to: number;
}

/** Detect an open `{{` token at the caret: a collapsed selection whose
 *  textblock has an unclosed `{{` followed only by name characters. */
function computeTrigger(state: EditorState): Trigger | null {
  const sel = state.selection;
  if (!sel.empty || !(sel instanceof TextSelection)) return null;
  const $from = sel.$from;
  // Text in the current textblock up to the caret (atoms count as 1 char, so
  // string offsets line up with doc positions within the block).
  const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "￼");
  const open = before.lastIndexOf("{{");
  if (open === -1) return null;
  const query = before.slice(open + 2);
  // Only an unclosed token of name chars — a space / `}` means it's not one.
  if (!/^[\w.]*$/.test(query)) return null;
  return { query, from: sel.from - query.length - 2, to: sel.from };
}

export function VariableAutocomplete() {
  const editorState = useEditorState();
  const trigger = useMemo(() => computeTrigger(editorState), [editorState]);

  const matches = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    return VARIABLE_DEFS.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q),
    );
  }, [trigger]);

  const [highlight, setHighlight] = useState(0);
  // Escape dismisses the menu until the author moves to a different `{{` token.
  const [dismissedFrom, setDismissedFrom] = useState<number | null>(null);

  // Reset the highlight as the token / query changes.
  useEffect(() => {
    setHighlight(0);
  }, [trigger?.query, trigger?.from]);

  const open =
    !!trigger && matches.length > 0 && dismissedFrom !== trigger.from;

  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Anchor the menu at the caret via a virtual reference.
  useEditorEffect(
    (view) => {
      if (!trigger) return;
      const coords = view.coordsAtPos(trigger.to);
      refs.setReference({
        getBoundingClientRect: () =>
          new DOMRect(
            coords.left,
            coords.top,
            0,
            coords.bottom - coords.top,
          ),
        contextElement: view.dom,
      });
    },
    [trigger, refs],
  );

  const insert = useEditorEventCallback((view, name: string) => {
    const t = computeTrigger(view.state);
    if (!t) return;
    const text = `{{${name}}}`;
    const tr = view.state.tr.insertText(text, t.from, t.to);
    const pos = t.from + text.length;
    tr.setSelection(TextSelection.create(tr.doc, pos));
    view.dispatch(tr.scrollIntoView());
    view.focus();
  });

  // Latest state for the (once-attached) keydown handler to read.
  const liveRef = useRef({ open, matches, highlight, trigger });
  liveRef.current = { open, matches, highlight, trigger };

  // Capture-phase keydown so the menu's nav keys beat ProseMirror while open.
  useEditorEffect((view) => {
    const onKey = (e: KeyboardEvent) => {
      const s = liveRef.current;
      if (!s.open || s.matches.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => (h + 1) % s.matches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => (h - 1 + s.matches.length) % s.matches.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const m = s.matches[s.highlight];
        if (m) insert(m.name);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (s.trigger) setDismissedFrom(s.trigger.from);
      }
    };
    view.dom.addEventListener("keydown", onKey, true);
    return () => view.dom.removeEventListener("keydown", onKey, true);
  }, []);

  if (!open || !trigger) return null;

  return createPortal(
    <div
      ref={refs.setFloating}
      className="pb-var-menu"
      style={floatingStyles}
      // Keep the editor selection while clicking a row.
      onMouseDown={(e) => e.preventDefault()}
    >
      {matches.map((m, i) => (
        <button
          key={m.name}
          type="button"
          className="pb-var-menu-item"
          data-active={i === highlight || undefined}
          onMouseEnter={() => setHighlight(i)}
          onClick={() => insert(m.name)}
        >
          <span className="pb-var-menu-name">{m.name}</span>
          <span className="pb-var-menu-label">{m.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
