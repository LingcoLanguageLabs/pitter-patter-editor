/**
 * Shuffle-grid editor reused by the Form Builder stories. Mirrors the
 * setup in DragDropEditor.tsx but takes the initial doc + optional
 * schema-extension as props so we can mount empty / quiz / future
 * Form-Builder demos without duplicating all the wiring.
 */

import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useSelectNode,
  type NodeViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import {
  addShuffleNodes,
  DragHandles,
  ResizeHandles,
  ShuffleSkeleton,
  shuffle,
} from "@pitter-patter/shuffle";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { Schema, type Node as PmNode, type NodeSpec } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";
import { EditorState, type Command, type Plugin } from "prosemirror-state";
import { useMemo } from "react";

import "@pitter-patter/shuffle/style/shuffle.css";

import {
  Bold,
  History,
  Italic,
  Strike,
  Underline,
} from "./editor/extensions";
import type { Extension } from "./editor/types";

/**
 * Mark extensions reused from the toolkit's editor — the same Bold,
 * Italic, Underline, Strike code that powers the configured editor.
 * We pluck their schema specs, commands, and keymap declarations out
 * of the Extension objects rather than re-implementing them.
 */
export const formBuilderMarkExtensions: readonly Extension[] = [
  Bold,
  Italic,
  Underline,
  Strike,
];

/**
 * Extensions that aren't marks but contribute plugins / commands /
 * keymap to the editor. Right now that's just History (the
 * prosemirror-history plugin + Mod-z / Mod-y / Shift-Mod-z keymap).
 */
const formBuilderSystemExtensions: readonly Extension[] = [History];

const imageSpec = basic.spec.nodes.get("image")!;

export const BLOCK_SIZES = ["xs", "s", "m", "l", "xl"] as const;
export type BlockSize = (typeof BLOCK_SIZES)[number];
export const BLOCK_ALIGNS = ["left", "center", "right"] as const;
export type BlockAlign = (typeof BLOCK_ALIGNS)[number];

/**
 * Patch a textblock NodeSpec so it carries `align` and `size` attrs that
 * round-trip through parseDOM/toDOM. Wraps the original toDOM, appending
 * data attrs + a style string so we can target them from CSS.
 */
function withBlockAttrs(base: NodeSpec, defaultTag: string): NodeSpec {
  const baseAttrs = base.attrs ?? {};
  const baseToDOM = base.toDOM;
  return {
    ...base,
    attrs: {
      ...baseAttrs,
      align: { default: null },
      size: { default: null },
    },
    parseDOM: (base.parseDOM ?? []).map((rule) => ({
      ...rule,
      getAttrs(node: HTMLElement | string) {
        const inherited =
          typeof rule.getAttrs === "function"
            ? rule.getAttrs(node as never)
            : rule.attrs ?? null;
        if (inherited === false) return false;
        if (typeof node === "string") return inherited ?? null;
        const align = node.style.textAlign || node.getAttribute("data-align");
        const size = node.getAttribute("data-size");
        const alignValue = (BLOCK_ALIGNS as readonly string[]).includes(align ?? "")
          ? (align as BlockAlign)
          : null;
        const sizeValue = (BLOCK_SIZES as readonly string[]).includes(size ?? "")
          ? (size as BlockSize)
          : null;
        return {
          ...(inherited ?? {}),
          align: alignValue,
          size: sizeValue,
        };
      },
    })),
    toDOM(node) {
      const align = node.attrs["align"] as BlockAlign | null;
      const size = node.attrs["size"] as BlockSize | null;
      const result = baseToDOM ? baseToDOM(node) : [defaultTag, 0];
      if (!Array.isArray(result)) return result;
      const [tag, second, ...rest] = result;
      const hasAttrs =
        second &&
        typeof second === "object" &&
        !Array.isArray(second) &&
        !(second && (second as { nodeType?: number }).nodeType);
      const attrs: Record<string, unknown> = hasAttrs
        ? { ...(second as Record<string, unknown>) }
        : {};
      if (align) {
        attrs["data-align"] = align;
        const existing = (attrs["style"] as string | undefined) ?? "";
        attrs["style"] = `${existing}${existing ? "; " : ""}text-align: ${align}`;
      }
      if (size) attrs["data-size"] = size;
      const rebuilt: unknown[] = [tag, attrs];
      if (hasAttrs) rebuilt.push(...rest);
      else if (second !== undefined) rebuilt.push(second, ...rest);
      return rebuilt as ReturnType<NonNullable<NodeSpec["toDOM"]>>;
    },
  };
}

const baseNodes = basic.spec.nodes
  .update("image", {
    ...imageSpec,
    group: "block",
    inline: false,
  })
  .update(
    "paragraph",
    withBlockAttrs(
      {
        ...basic.spec.nodes.get("paragraph")!,
        toDOM() {
          return ["p", { "data-node-type": "paragraph" }, 0];
        },
      },
      "p",
    ),
  )
  .update(
    "heading",
    withBlockAttrs(basic.spec.nodes.get("heading")!, "h2"),
  );

/**
 * Marks beyond the prosemirror-schema-basic defaults. The basic schema
 * ships with `em`, `strong`, `code`, and `link`; the form-builder mark
 * extensions (Bold/Italic/Underline/Strike) bring `underline` and
 * `strike` along with their commands and keymap declarations.
 */
const baseMarks = formBuilderMarkExtensions.reduce((acc, ext) => {
  if (!ext.marks) return acc;
  let marks = acc;
  for (const [name, spec] of Object.entries(ext.marks)) {
    if (marks.get(name)) continue; // basic schema already has it (em, strong)
    marks = marks.addToEnd(name, spec);
  }
  return marks;
}, basic.spec.marks);

/** Build a shuffle-aware schema, optionally letting the caller add
 *  more nodes (like quiz) before the shuffle attrs get sprinkled on. */
export function buildShuffleSchema(
  extend?: (schema: Schema) => Schema,
): Schema {
  let schema = new Schema({ nodes: baseNodes, marks: baseMarks });
  if (extend) schema = extend(schema);
  return addShuffleNodes(schema, "block+", "block");
}

function ImageNodeView({
  nodeProps,
  ref,
  children: _children,
  ...props
}: NodeViewComponentProps) {
  useSelectNode(() => {});
  return (
    <img
      ref={ref}
      {...props}
      src={nodeProps.node.attrs["src"] as string}
      draggable={false}
      style={{
        touchAction: "none",
        userSelect: "none",
        borderRadius: "0.5rem",
      }}
    />
  );
}

const baseNodeViewComponents = { image: ImageNodeView };

export interface FormBuilderEditorProps {
  /**
   * Build the initial doc from the (already-shuffle-extended) schema.
   * If you supplied `extendSchema`, the schema passed here will include
   * those additions too.
   */
  initialDoc: (schema: Schema) => PmNode;
  /** Optional schema extension (e.g. addQuizToSchema, addBlankToSchema). */
  extendSchema?: (schema: Schema) => Schema;
  /** Additional nodeViewComponents to merge with the defaults. */
  extraNodeViewComponents?: Record<string, React.ComponentType<NodeViewComponentProps>>;
  /** Extra plugins (e.g. keymaps for story-only commands). */
  extraPlugins?: Plugin[];
  /** Optional bubble/overlay components mounted inside <ProseMirror>. */
  overlays?: React.ReactNode;
}

export function FormBuilderEditor({
  initialDoc,
  extendSchema,
  extraNodeViewComponents,
  extraPlugins,
  overlays,
}: FormBuilderEditorProps) {
  const editorState = useMemo(() => {
    const schema = buildShuffleSchema(extendSchema);

    // Collect plugins + keymap bindings from every reused Extension.
    // History contributes its prosemirror-history plugin; Bold/Italic/
    // Underline/Strike contribute Mod-b/i/u/⇧s. Everything stays in
    // lockstep with the configured editor — the same Extension
    // objects power both.
    const reusedExtensions: readonly Extension[] = [
      ...formBuilderSystemExtensions,
      ...formBuilderMarkExtensions,
    ];
    const reusedPlugins = reusedExtensions.flatMap(
      (ext) => ext.plugins?.(schema) ?? [],
    );
    const reusedKeymap: Record<string, Command> = {};
    for (const ext of reusedExtensions) {
      if (!ext.commands || !ext.keymap) continue;
      for (const [stroke, commandName] of Object.entries(ext.keymap)) {
        const factory = ext.commands[commandName];
        if (!factory) continue;
        reusedKeymap[stroke] = factory(schema);
      }
    }

    return EditorState.create({
      doc: initialDoc(schema),
      plugins: [
        reactKeys(),
        shuffle(),
        ...reusedPlugins,
        keymap(reusedKeymap),
        ...(extraPlugins ?? []),
        keymap(baseKeymap),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nodeViewComponents = useMemo(
    () => ({ ...baseNodeViewComponents, ...extraNodeViewComponents }),
    [extraNodeViewComponents],
  );

  return (
    <ProseMirror
      defaultState={editorState}
      nodeViewComponents={nodeViewComponents}
    >
      <ShuffleSkeleton>
        <ProseMirrorDoc />
        <ResizeHandles />
        <DragHandles />
      </ShuffleSkeleton>
      {overlays}
    </ProseMirror>
  );
}
