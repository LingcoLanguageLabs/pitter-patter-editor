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
} from "@handlewithcare/react-prosemirror";
import {
  DragHandles,
  ShuffleSkeleton,
  shuffle,
} from "@pitter-patter/shuffle";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";
import { EditorState, type Command } from "prosemirror-state";
import { columnResizing, goToNextCell, tableEditing } from "prosemirror-tables";
import { Decoration } from "prosemirror-view";
import { useMemo } from "react";

import "@pitter-patter/shuffle/style/shuffle.css";
import "prosemirror-tables/style/tables.css";

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
import { blockHighlightPlugin } from "./blockHighlightPlugin";
import { BlockContextMenu } from "./BlockContextMenu";
import { BlockMarginHandle } from "./BlockMarginHandle";
import { BlockResizeHandles } from "./BlockResizeHandles";
import { BlockSettings } from "./blockSettings/BlockSettings";
import { editorStoreSyncPlugin } from "./editorStoreSync";
import { globalBarPlugin } from "./globalBarPlugin";
import { itemBuilderTools } from "./itemBuilderTools";
import { itemSelectionPopovers } from "./items/registry";
import { ItemBuilderToolsProvider } from "./items/shared/blockTools";

const ITEM_SELECTION_POPOVERS = itemSelectionPopovers();
import { layerHoverPlugin } from "./layerHoverPlugin";
import { nodeViewComponents } from "./nodeViews";
import { ensurePageSectionsPlugin, restrictBarItemsPlugin } from "./pageInvariants";
import { orderCommand } from "./orderCommands";
import { SelectableDragHandle } from "./SelectableDragHandle";
import { splitRowCellIntoContainer } from "./rowEnterCommand";
import { buildPageBuilderSchema, type InitialDocBuilder } from "./schema";
import { sectionChromePlugin } from "./sectionChromePlugin";
import { sectionHighlightPlugin } from "./sectionHighlightPlugin";
import { TableToolbar } from "./TableToolbar";
import { TextSelectionToolbar } from "./TextSelectionToolbar";
import { unsplashPickerPlugin } from "./unsplashPicker";
import { VariableAutocomplete } from "./VariableAutocomplete";

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
          // The image's internal resize handles live INSIDE the (draggable)
          // figure; without this, a pointerdown on a handle would grab the
          // block instead of resizing. The selector tells shuffle to ignore
          // pointerdowns there so the handle's own drag runs. See ImageNodeView.
          // `.column-resize-handle` is prosemirror-tables' column-resize grip —
          // same reason (a table is a draggable block).
          // `.pb-image--pinned` is absolutely positioned (out of the grid); its
          // own move handle repositions it, so shuffle must not grid-drag it.
          // `.pp-labeled-draw` is the Labeled-image builder's marker surface — a
          // pointerdown there drops/drags a marker (see MarkerImage).
          ignoreSelector:
            ".pb-image-resize-handle, .column-resize-handle, .pb-image--pinned, .pp-labeled-draw",
          // Drag a block by grabbing anywhere on it, not just the type-label
          // handle. A plain click (no movement) still places the text cursor —
          // the plugin only commits to the drag once the pointer moves.
          startDragInContentDOM: true,
        }),
        sectionChromePlugin(),
        blockHighlightPlugin(),
        // Section-level twin of blockHighlightPlugin: rings the active
        // section in the accent color. Independent of the block ring, so
        // clicking a block shows both (the section outline + the inner
        // block outline), like pagy.
        sectionHighlightPlugin(),
        // Rings the layer hovered in the Layers panel, reusing the same accent
        // ring as shuffle's hover (`pb-block-hovered`). See `layerHoverPlugin`.
        layerHoverPlugin(),
        activePagePlugin(),
        // Heals the `page: header? section+ footer?` invariant PM declares but
        // doesn't auto-enforce: any page left with zero sections (by a delete /
        // move that didn't guard) gets a fresh empty section back. See
        // `pageInvariants`.
        ensurePageSectionsPlugin(),
        // Keeps question items (MC, Rating, …) out of the header/footer bars —
        // they belong in page sections (or descendants), and a question in a bar
        // can't be graded. See `restrictBarItemsPlugin`.
        restrictBarItemsPlugin(),
        // Reconciles the site-wide header/footer masters with the active page:
        // hides a master when the page detaches/hides it, and mounts a restore
        // ghost for a hidden bar. After activePagePlugin so it reads the new
        // active id. See `globalBarPlugin` / `headerFooter`.
        globalBarPlugin(),
        attrClassesPlugin(),
        // The one bridge to the zustand UI store: mirrors deck + drag state
        // out (for the Pages panel / chrome) and pushes the mobile flag in
        // (single-column shuffle mode). Replaces the old per-value *Sync
        // components. See `editorStoreSync.ts`.
        editorStoreSyncPlugin(),
        // Unsplash photo picker state (open flag + doc target). The picker UI
        // is the left-panel "Photos" sheet; this holds where a picked photo
        // lands and keeps that target valid across edits. Before
        // editorStoreSyncPlugin reads it below — order only matters for the
        // mirror, which runs in `view.update` after all plugins' `apply`.
        unsplashPickerPlugin(),
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
                : node.type.name === "image_caption"
                  ? "+ Add a caption"
                  : node.type.name === "item_explanation"
                    ? "Explain the answer (shown after they answer)"
                    : "",
        }).plugins?.(schema) ?? []),
        ...collectExtensionPlugins(schema),
        // Table editing (prosemirror-tables): `columnResizing` adds the drag-to-
        // size grips, `tableEditing` owns cell selection + the row/col commands.
        // columnResizing must come before tableEditing (its own ordering rule).
        columnResizing(),
        tableEditing(),
        // Tab / Shift-Tab move between cells while inside a table; `goToNextCell`
        // returns false elsewhere, so it falls through to normal Tab handling.
        keymap({ Tab: goToNextCell(1), "Shift-Tab": goToNextCell(-1) }),
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
      {/* Inject builder tools (the "+ Add content" picker) into item node views.
          Inside <ProseMirror> so the control's editor hooks resolve. */}
      <ItemBuilderToolsProvider value={itemBuilderTools}>
        <ShuffleSkeleton>
          <ProseMirrorDoc />
          <BlockResizeHandles />
          <DragHandles handleComponent={SelectableDragHandle} />
        </ShuffleSkeleton>
        <BlockSettings />
        <BlockMarginHandle />
        <BlockContextMenu />
        <TextSelectionToolbar />
        <TableToolbar />
        {/* Typeahead that pops when the author types `{{` — inserts a variable
            token (e.g. {{score.percent}}). */}
        <VariableAutocomplete />
        {/* Item-contributed selection popovers (e.g. Fill Blanks' blank
            settings) — each watches the selection and shows itself. */}
        {ITEM_SELECTION_POPOVERS.map((Popover, i) => (
          <Popover key={i} />
        ))}
        {overlays}
      </ItemBuilderToolsProvider>
    </ProseMirror>
  );
}
