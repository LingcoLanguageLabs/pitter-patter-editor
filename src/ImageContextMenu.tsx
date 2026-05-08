import {
  Copy,
  MagicWand,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
} from "@handlewithcare/react-prosemirror";
import { NodeSelection } from "prosemirror-state";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const AI_ALT_ENDPOINT = "http://localhost:3001/api/ai/alt";

interface MenuState {
  pos: number;
  src: string;
  x: number;
  y: number;
}

/**
 * Right-click context menu on images. Listens for `contextmenu` on
 * `.ProseMirror figure.pp-image` and renders a small floating menu
 * with Copy URL / Edit alt / Generate alt with AI / Delete.
 *
 * Render alongside `<editor.Editor>` as a companion.
 */
export function ImageContextMenu() {
  const [state, setState] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEditorEffect((view) => {
    const editorEl = view.dom;

    const handleContextMenu = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest) return;
      const figure = target.closest("figure.pp-image");
      if (!figure || !editorEl.contains(figure)) return;
      event.preventDefault();
      const img = figure.querySelector("img");
      const src = img?.getAttribute("src") ?? "";
      const mouseEvent = event as MouseEvent;
      const pos = view.posAtDOM(figure, 0);
      if (pos < 0) return;
      // Select the image node so subsequent commands operate on it.
      view.dispatch(
        view.state.tr.setSelection(
          NodeSelection.create(view.state.doc, pos),
        ),
      );
      setState({
        pos,
        src,
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      });
    };

    editorEl.addEventListener("contextmenu", handleContextMenu);
    return () => editorEl.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!state) return;
    const onClick = (event: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(event.target as Node)) {
        setState(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setState(null);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [state]);

  const copyUrl = useCallback(() => {
    if (!state?.src) return;
    void navigator.clipboard?.writeText(state.src);
    setState(null);
  }, [state]);

  const focusBubbleAlt = useCallback(() => {
    // The image bubble menu owns the alt text input — focus it after
    // closing this menu. We rely on the bubble being mounted (it shows
    // when an image is selected, which we just set above).
    setState(null);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        ".pp-image-alt-input",
      );
      input?.focus();
      input?.select();
    });
  }, []);

  const remove = useEditorEventCallback((view) => {
    if (!view) return;
    const sel = view.state.selection;
    if (!(sel instanceof NodeSelection)) return;
    if (sel.node.type.name !== "image") return;
    view.dispatch(view.state.tr.deleteSelection());
    setState(null);
  });

  const generateAlt = useEditorEventCallback(async (view) => {
    if (!view || !state) return;
    const sel = view.state.selection;
    if (!(sel instanceof NodeSelection)) return;
    if (sel.node.type.name !== "image") return;
    const src = sel.node.attrs["src"] as string | undefined;
    if (!src) return;
    setState(null);
    try {
      const response = await fetch(AI_ALT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src }),
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffered = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) buffered += value;
      }
      const alt = buffered.trim();
      if (!alt) return;
      const liveSel = view.state.selection;
      if (liveSel instanceof NodeSelection && liveSel.node.type.name === "image") {
        view.dispatch(
          view.state.tr.setNodeMarkup(liveSel.from, undefined, {
            ...liveSel.node.attrs,
            alt,
          }),
        );
      }
    } catch {
      /* best-effort; failure is silent in the menu */
    }
  });

  if (!state) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="pp-image-context-menu"
      role="menu"
      style={{ position: "fixed", left: state.x, top: state.y }}
    >
      <button type="button" className="pp-image-context-item" onClick={copyUrl}>
        <Copy size={14} weight="bold" />
        Copy image URL
      </button>
      <button type="button" className="pp-image-context-item" onClick={focusBubbleAlt}>
        <PencilSimple size={14} weight="bold" />
        Edit alt text
      </button>
      <button
        type="button"
        className="pp-image-context-item"
        onClick={() => generateAlt()}
      >
        <MagicWand size={14} weight="bold" />
        Generate alt with AI
      </button>
      <span className="pp-image-context-divider" />
      <button
        type="button"
        className="pp-image-context-item pp-image-context-item-danger"
        onClick={remove}
      >
        <Trash size={14} weight="bold" />
        Delete image
      </button>
    </div>,
    document.body,
  );
}
