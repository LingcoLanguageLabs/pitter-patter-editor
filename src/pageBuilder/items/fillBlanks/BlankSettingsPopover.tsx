/**
 * Fill Blanks — the blank settings popover. Same pattern as the page builder's
 * BlockSettings: a single floating popover that watches the selection and shows
 * when a `blank` node is selected, anchored to its DOM. Because it lives OUTSIDE
 * the blank's node view, editing the blank (setNodeMarkup) re-renders it with
 * fresh attrs but never remounts it — so the open option list / inputs survive.
 * Registered via the ItemDefinition; the editor renders it once.
 */

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
import type { Node as PmNode } from "prosemirror-model";
import { NodeSelection } from "prosemirror-state";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { BlankSettings } from "./BlankSettings";
import { BLANK_NODE, type BlankOption } from "./schema";

export function BlankSettingsPopover() {
  const editorState = useEditorState();
  const sel = editorState.selection;
  const isBlank =
    sel instanceof NodeSelection && sel.node.type.name === BLANK_NODE;
  if (!isBlank) return null;
  // Key by position so moving to another blank remounts (fresh state), but
  // editing the same blank reconciles in place.
  return <BlankPopover key={sel.from} pos={sel.from} node={sel.node} />;
}

function BlankPopover({ pos, node }: { pos: number; node: PmNode }) {
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);

  // Re-resolve the blank's DOM each render (no deps), like BlockSettings — an
  // attr edit replaces the element and a stale ref would mis-anchor.
  useEditorEffect((view) => {
    const dom = view.nodeDOM(pos);
    setReferenceEl(dom instanceof HTMLElement ? dom : null);
  });

  const { x, y, strategy, refs } = useFloating({
    placement: "bottom-start",
    middleware: [offset(8), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    refs.setReference(referenceEl);
  }, [referenceEl, refs]);

  const update = useEditorEventCallback(
    (view, patch: Record<string, unknown>) => {
      const fresh = view.state.doc.nodeAt(pos);
      if (!fresh || fresh.type.name !== BLANK_NODE) return;
      const tr = view.state.tr.setNodeMarkup(pos, undefined, {
        ...fresh.attrs,
        ...patch,
      });
      // Keep the blank selected so this popover stays open + anchored.
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      view.dispatch(tr);
    },
  );

  const remove = useEditorEventCallback((view) => {
    const fresh = view.state.doc.nodeAt(pos);
    if (!fresh) return;
    const options = (fresh.attrs["options"] as BlankOption[]) ?? [];
    const answer =
      options.find((o) => o.id === fresh.attrs["answerId"])?.text ?? "";
    const end = pos + fresh.nodeSize;
    const tr = answer
      ? view.state.tr.replaceWith(pos, end, view.state.schema.text(answer))
      : view.state.tr.delete(pos, end);
    view.dispatch(tr);
  });

  const options = (node.attrs["options"] as BlankOption[]) ?? [];

  return createPortal(
    <div
      ref={refs.setFloating}
      className="pp-blank-popover"
      style={{ position: strategy, top: y ?? 0, left: x ?? 0 }}
    >
      <BlankSettings
        mode={node.attrs["mode"] as string}
        options={options}
        answerId={node.attrs["answerId"] as string}
        alternates={(node.attrs["alternates"] as string[]) ?? []}
        update={update}
        remove={remove}
      />
    </div>,
    document.body,
  );
}
