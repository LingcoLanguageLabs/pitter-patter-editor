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
  useEditorEffect,
  useEditorState,
  useSelectNode,
  type NodeViewComponentProps,
  type WidgetViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import {
  addShuffleNodes,
  ResizeHandles,
  ShuffleSkeleton,
  shuffle,
} from "@pitter-patter/shuffle";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { Schema, type Node as PmNode } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";
import { EditorState, type Plugin } from "prosemirror-state";
import { useMemo, useState } from "react";

import "@pitter-patter/shuffle/style/shuffle.css";

const imageSpec = basic.spec.nodes.get("image")!;

const baseNodes = basic.spec.nodes
  .update("image", {
    ...imageSpec,
    group: "block",
    inline: false,
  })
  .update("paragraph", {
    ...basic.spec.nodes.get("paragraph")!,
    toDOM() {
      return ["p", { "data-node-type": "paragraph" }, 0];
    },
  });

/** Build a shuffle-aware schema, optionally letting the caller add
 *  more nodes (like quiz) before the shuffle attrs get sprinkled on. */
export function buildShuffleSchema(
  extend?: (schema: Schema) => Schema,
): Schema {
  let schema = new Schema({ nodes: baseNodes, marks: basic.spec.marks });
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

export type HandleProps = WidgetViewComponentProps & {
  ref?: React.Ref<HTMLDivElement>;
};

export function createHandle(label: string) {
  function Handle({
    widget,
    ref,
    getPos: _getPos,
    ...props
  }: HandleProps) {
    const editorState = useEditorState();
    const node = editorState.doc.resolve(widget.spec.nodePos).nodeAfter;
    const [top, setTop] = useState(0);
    const [left, setLeft] = useState(0);

    useEditorEffect(
      (view) => {
        const nodeDOM = view.nodeDOM(widget.spec.nodePos);
        if (!(nodeDOM instanceof HTMLElement)) return;
        const { offsetParent } = nodeDOM;
        const coords = nodeDOM.getBoundingClientRect();
        const offsetCoords = offsetParent?.getBoundingClientRect();
        setTop(coords.top - (offsetCoords?.top ?? 0));
        setLeft(
          coords.left -
            (offsetCoords?.left ?? 0) +
            (widget.spec.nodeDepth - 1) * 24,
        );
      },
      [node, widget.spec.nodePos, widget.spec.nodeDepth],
    );

    return (
      <div
        ref={ref}
        {...props}
        contentEditable={false}
        style={{
          position: "absolute",
          backgroundColor: "lightblue",
          transform: "translateY(-1.5rem)",
          cursor: "grab",
          top,
          left,
        }}
      >
        {label}
      </div>
    );
  }
  Handle.displayName = `${label}Handle`;
  return Handle;
}

const baseDragHandles = {
  paragraph: createHandle("Paragraph"),
  container: createHandle("Container"),
  row: createHandle("Row"),
  image: createHandle("Image"),
};

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
  /** Additional drag handles, keyed by node name. */
  extraDragHandles?: Record<string, React.ComponentType<HandleProps>>;
  /** Extra plugins (e.g. keymaps for story-only commands). */
  extraPlugins?: Plugin[];
  /** Optional bubble/overlay components mounted inside <ProseMirror>. */
  overlays?: React.ReactNode;
}

export function FormBuilderEditor({
  initialDoc,
  extendSchema,
  extraNodeViewComponents,
  extraDragHandles,
  extraPlugins,
  overlays,
}: FormBuilderEditorProps) {
  const editorState = useMemo(() => {
    const schema = buildShuffleSchema(extendSchema);
    return EditorState.create({
      doc: initialDoc(schema),
      plugins: [
        reactKeys(),
        shuffle({
          dragHandles: { ...baseDragHandles, ...extraDragHandles },
        }),
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
      </ShuffleSkeleton>
      {overlays}
    </ProseMirror>
  );
}
