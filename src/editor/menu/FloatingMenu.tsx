import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement,
  type VirtualElement,
} from "@floating-ui/react";
import { useEditorEffect, useEditorState } from "@handlewithcare/react-prosemirror";
import type { EditorState } from "prosemirror-state";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface FloatingMenuProps {
  shouldShow?: (state: EditorState) => boolean;
  placement?: Placement;
  offset?: number;
  className?: string;
  children: ReactNode;
}

const DEFAULT_SHOULD_SHOW = (state: EditorState) => !state.selection.empty;

export function FloatingMenu({
  shouldShow = DEFAULT_SHOULD_SHOW,
  placement = "top",
  offset: offsetValue = 8,
  className,
  children,
}: FloatingMenuProps) {
  const editorState = useEditorState();
  const rectRef = useRef<DOMRect>(new DOMRect(0, 0, 0, 0));
  const [open, setOpen] = useState(false);

  const virtualEl = useMemo<VirtualElement>(
    () => ({
      getBoundingClientRect: () => rectRef.current,
    }),
    [],
  );

  const { refs, floatingStyles, update } = useFloating({
    placement,
    middleware: [offset(offsetValue), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(virtualEl);
  }, [refs, virtualEl]);

  useEditorEffect(
    (view) => {
      if (!editorState) {
        setOpen(false);
        return;
      }
      const visible = shouldShow(editorState);
      if (!visible) {
        setOpen(false);
        return;
      }
      const { from, to } = editorState.selection;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      const left = Math.min(start.left, end.left);
      const right = Math.max(start.right, end.right);
      const top = Math.min(start.top, end.top);
      const bottom = Math.max(start.bottom, end.bottom);
      rectRef.current = new DOMRect(left, top, right - left || 1, bottom - top || 1);
      update();
      setOpen(true);
    },
    [editorState, shouldShow, update],
  );

  if (!open) return null;
  return createPortal(
    <div
      ref={refs.setFloating}
      className={["pp-floating-anchor", className].filter(Boolean).join(" ")}
      style={floatingStyles}
    >
      {children}
    </div>,
    document.body,
  );
}
