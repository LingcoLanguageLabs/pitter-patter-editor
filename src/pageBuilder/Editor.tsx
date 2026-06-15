/**
 * Page-builder editor. Hosts a ProseMirror instance with the
 * page-builder schema and renders the canvas overlays alongside the
 * doc.
 *
 * Everything substantial lives in its own module:
 *
 *   • `schema.ts`           — builds the schema (page-builder nodes
 *                              + shuffle + section containment).
 *   • `nodeViews/`          — section / button / image NodeViews.
 *   • `sectionChromePlugin` — adds the "+ Add block / + Add section"
 *                              affordances per section via a widget
 *                              decoration.
 *   • `editorStoreSync`     — the one bridge to `usePageBuilderStore`:
 *                              mirrors deck + drag state out, pushes the
 *                              mobile flag in.
 *
 * This file's job is to wire them together inside one ProseMirror.
 */

import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import {
  DragHandles,
  ResizeHandles,
  ShuffleSkeleton,
  shuffle,
  shufflePluginKey,
} from "@pitter-patter/shuffle";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";
import { EditorState, type Command } from "prosemirror-state";
import { Decoration } from "prosemirror-view";
import { useMemo } from "react";

import "@pitter-patter/shuffle/style/shuffle.css";

import {
  Bold,
  createPlaceholder,
  History,
  Italic,
  Strike,
  Underline,
} from "../editor/extensions";
import type { Extension } from "../editor/types";

import { activePagePlugin } from "./activePagePlugin";
import { attrClassesPlugin } from "./attrClassesPlugin";
import {
  blockHighlightPlugin,
  getActiveBlockPos,
} from "./blockHighlightPlugin";
import { BlockContextMenu } from "./BlockContextMenu";
import { BlockMarginHandle } from "./BlockMarginHandle";
import { BlockSettings } from "./blockSettings/BlockSettings";
import { editorStoreSyncPlugin } from "./editorStoreSync";
import { nodeViewComponents } from "./nodeViews";
import { orderCommand } from "./orderCommands";
import { SelectableDragHandle } from "./SelectableDragHandle";
import { splitRowCellIntoContainer } from "./rowEnterCommand";
import { buildPageBuilderSchema, type InitialDocBuilder } from "./schema";
import { sectionChromePlugin } from "./sectionChromePlugin";
import { sectionHighlightPlugin } from "./sectionHighlightPlugin";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

const markExtensions: readonly Extension[] = [Bold, Italic, Underline, Strike];
const systemExtensions: readonly Extension[] = [History];

/** Folds extension marks into the basic schema's marks map. */
function collectMarks(): typeof basic.spec.marks {
  let marks = basic.spec.marks;
  for (const ext of markExtensions) {
    if (!ext.marks) continue;
    for (const [name, spec] of Object.entries(ext.marks)) {
      if (marks.get(name)) continue;
      marks = marks.addToEnd(name, spec);
    }
  }
  return marks;
}

/** Resolves the keymap shortcuts declared by extensions against the
 *  finished schema. */
function collectKeymap(schema: Schema): Record<string, Command> {
  const map: Record<string, Command> = {};
  for (const ext of [...systemExtensions, ...markExtensions]) {
    if (!ext.commands || !ext.keymap) continue;
    for (const [stroke, commandName] of Object.entries(ext.keymap)) {
      const factory = ext.commands[commandName];
      if (factory) map[stroke] = factory(schema);
    }
  }
  return map;
}

/** Collects the plugins each extension contributes. */
function collectExtensionPlugins(schema: Schema) {
  return [...systemExtensions, ...markExtensions].flatMap(
    (ext) => ext.plugins?.(schema) ?? [],
  );
}

export interface PageBuilderEditorProps {
  initialDoc: InitialDocBuilder;
  overlays?: React.ReactNode;
}

/**
 * Renders shuffle's resize handles only while a block is explicitly
 * selected (`blockHighlightPlugin`) and not mid-drag. Shuffle keys the
 * handles off the raw PM selection, which never clears — so without
 * this gate they'd linger after a gutter/outside click, out of sync
 * with the toolbar and ring. The selection still drives *which* block
 * the handles attach to; we only gate *whether* they show.
 */
function ActiveResizeHandles() {
  const state = useEditorState();
  const active =
    getActiveBlockPos(state) != null &&
    shufflePluginKey.getState(state)?.activeNodePos == null;
  return active ? <ResizeHandles /> : null;
}

export function PageBuilderEditor({
  initialDoc,
  overlays,
}: PageBuilderEditorProps) {
  const editorState = useMemo(() => {
    const base = new Schema({
      nodes: basic.spec.nodes,
      marks: collectMarks(),
    });
    const schema = buildPageBuilderSchema(base);
    return EditorState.create({
      doc: initialDoc(schema),
      plugins: [
        reactKeys(),
        // `hoverDecorations` rings the hovered block in the accent
        // color — a companion to shuffle's type-label drag handle, so
        // it's obvious which block you're about to act on. Applied to
        // every hover position (same set the drag handles use). The
        // active/resizing block gets the same ring via
        // `blockHighlightPlugin` below; both share one CSS rule.
        shuffle({
          hoverDecorations: (from, to) =>
            Decoration.node(from, to, { class: "pb-block-hovered" }),
        }),
        sectionChromePlugin(),
        blockHighlightPlugin(),
        // Section-level twin of blockHighlightPlugin: rings the active
        // section in the accent color. Independent of the block ring, so
        // clicking a block shows both (the section outline + the inner
        // block outline), like pagy.
        sectionHighlightPlugin(),
        activePagePlugin(),
        attrClassesPlugin(),
        // The one bridge to the zustand UI store: mirrors deck + drag state
        // out (for the Pages panel / chrome) and pushes the mobile flag in
        // (single-column shuffle mode). Replaces the old per-value *Sync
        // components. See `editorStoreSync.ts`.
        editorStoreSyncPlugin(),
        // Placeholder text in empty text blocks: "Start writing…" for
        // paragraphs, "Heading N" for headings (by level). Shown in every
        // empty block, not just the focused one.
        ...(createPlaceholder({
          showOnlyCurrent: false,
          className: "pb-empty-block",
          placeholder: (node) =>
            node.type.name === "heading"
              ? `Heading ${(node.attrs["level"] as number) ?? 1}`
              : node.type.name === "paragraph"
                ? "Start writing…"
                : "",
        }).plugins?.(schema) ?? []),
        ...collectExtensionPlugins(schema),
        keymap(collectKeymap(schema)),
        // Z-order arrange shortcuts (Google Slides parity) for a block that
        // overlaps its row siblings. Each returns false when ordering doesn't
        // apply, so the arrow keys fall through to normal navigation.
        keymap({
          "Mod-Shift-ArrowUp": orderCommand("front"),
          "Mod-ArrowUp": orderCommand("forward"),
          "Mod-ArrowDown": orderCommand("backward"),
          "Mod-Shift-ArrowDown": orderCommand("back"),
        }),
        // Enter inside a row cell wraps it in a container so the new line
        // stacks within that column instead of becoming a 3rd row cell.
        // Returns false for everything else → falls through to baseKeymap.
        keymap({ Enter: splitRowCellIntoContainer }),
        keymap(baseKeymap),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProseMirror
      defaultState={editorState}
      nodeViewComponents={nodeViewComponents}
    >
      <ShuffleSkeleton>
        <ProseMirrorDoc />
        <ActiveResizeHandles />
        <DragHandles handleComponent={SelectableDragHandle} />
      </ShuffleSkeleton>
      <BlockSettings />
      <BlockMarginHandle />
      <BlockContextMenu />
      <TextSelectionToolbar />
      {overlays}
    </ProseMirror>
  );
}
