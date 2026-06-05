/**
 * Floating popover that shows settings for the block under the
 * current selection — paragraph alignment, button variant, image
 * source, etc. Modelled on pagy's `panels/block-settings.tsx`:
 * a single popover that branches by node type into the right form.
 *
 * How it tracks the active block:
 *
 *   • Subscribes to `useEditorState`. On every state change, walks
 *     the selection's $from path looking for the deepest ancestor
 *     whose node type has a form registered in `BLOCK_FORMS`.
 *   • Returns null when nothing matches (e.g. selection inside a
 *     section but not inside a block).
 *   • Re-resolves the active block's DOM via `view.nodeDOM(pos)`,
 *     and feeds that to @floating-ui/react as the reference element
 *     so the popover stays glued to the right side of the block
 *     through scroll + resize.
 *
 * Updates are applied via `view.dispatch(tr.setNodeAttribute(...))`,
 * which writes immediately. No save button — same model as pagy.
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
import { Copy, Trash } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { BLOCK_FORMS, BLOCK_TITLES, type ActiveBlock } from "./forms";

/** Walks up the selection's $from path looking for the deepest
 *  ancestor whose node type has a registered settings form. */
function findActiveBlock(
  doc: import("prosemirror-model").Node,
  selection: import("prosemirror-state").Selection,
): ActiveBlock | null {
  const $from = selection.$from;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    const typeName = node.type.name;
    if (typeName in BLOCK_FORMS) {
      const pos = depth === 0 ? 0 : $from.before(depth);
      return { pos, node, typeName: typeName as keyof typeof BLOCK_FORMS };
    }
  }
  // Selection might be a NodeSelection on an atom (button / image).
  if ("node" in selection) {
    const node = (selection as import("prosemirror-state").NodeSelection).node;
    if (node.type.name in BLOCK_FORMS) {
      return {
        pos: selection.from,
        node,
        typeName: node.type.name as keyof typeof BLOCK_FORMS,
      };
    }
  }
  return null;
}

export function BlockSettings() {
  const editorState = useEditorState();
  const active = useMemo(
    () => findActiveBlock(editorState.doc, editorState.selection),
    [editorState.doc, editorState.selection],
  );

  if (!active) return null;
  return <BlockSettingsPopover active={active} />;
}

function BlockSettingsPopover({ active }: { active: ActiveBlock }) {
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);

  /** Resolve the active block's DOM node from the view. `useEditorEffect`
   *  is the right hook here: it waits until the PM view is mounted and
   *  re-runs when the block's position changes (e.g. after an insert
   *  above it). */
  useEditorEffect(
    (view) => {
      const dom = view.nodeDOM(active.pos);
      setReferenceEl(dom instanceof HTMLElement ? dom : null);
    },
    [active.pos],
  );

  const { x, y, strategy, refs } = useFloating({
    placement: "right-start",
    middleware: [offset(20), flip(), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    refs.setReference(referenceEl);
  }, [referenceEl, refs]);

  /** Commit attr updates back to the doc. */
  const setAttr = useEditorEventCallback(
    (view, name: string, value: unknown) => {
      view.dispatch(view.state.tr.setNodeAttribute(active.pos, name, value));
    },
  );

  const duplicate = useEditorEventCallback((view) => {
    const insertAt = active.pos + active.node.nodeSize;
    view.dispatch(view.state.tr.insert(insertAt, active.node));
  });

  const remove = useEditorEventCallback((view) => {
    view.dispatch(
      view.state.tr.delete(active.pos, active.pos + active.node.nodeSize),
    );
  });

  const Form = BLOCK_FORMS[active.typeName];

  return createPortal(
    <div
      ref={refs.setFloating}
      className="pb-block-settings"
      style={{ position: strategy, top: y ?? 0, left: x ?? 0 }}
    >
      <header className="pb-block-settings-header">
        <span className="pb-block-settings-title">
          {BLOCK_TITLES[active.typeName]}
        </span>
        <div className="pb-block-settings-actions">
          <button
            type="button"
            className="pb-block-settings-icon"
            onClick={duplicate}
            aria-label="Duplicate block"
          >
            <Copy size={14} weight="regular" />
          </button>
          <button
            type="button"
            className="pb-block-settings-icon"
            onClick={remove}
            aria-label="Delete block"
          >
            <Trash size={14} weight="regular" />
          </button>
        </div>
      </header>
      <div className="pb-block-settings-body">
        <Form active={active} setAttr={setAttr} />
      </div>
    </div>,
    document.body,
  );
}
