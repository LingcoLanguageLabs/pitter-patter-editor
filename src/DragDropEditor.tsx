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
import { Schema } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";

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

const schema = addShuffleNodes(
  new Schema({ nodes: baseNodes, marks: basic.spec.marks }),
  "block+",
  "block",
);

const PORTRAIT_SRC =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&auto=format&fit=crop";
const STUDIO_SRC =
  "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=900&auto=format&fit=crop";

const p = (text: string) => schema.nodes["paragraph"]!.create(null, schema.text(text));

const h = (level: number, text: string) =>
  schema.nodes["heading"]!.create({ level }, schema.text(text));

const initialDoc = schema.nodes["doc"]!.create(null, [
  schema.nodes["row"]!.create({ shuffleStart: 0, shuffleEnd: 13 }, [
    schema.nodes["container"]!.create({ shuffleStart: 1, shuffleEnd: 6 }, [
      h(1, "Taylor Wilder"),
      p(
        "I'm a product designer by day and a street photographer by night, exploring the intersection of technology and human experience.",
      ),
      p(
        "I share my thoughts on design principles, creative processes, and finding meaning in our increasingly digital lives through my weekly newsletter, “Design & Meaning.”",
      ),
      p(
        "Each Sunday, I'll send you one new idea to consider, one useful resource I've discovered, and one question that's been on my mind lately.",
      ),
    ]),
    schema.nodes["image"]!.create({
      shuffleStart: 7,
      shuffleEnd: 12,
      src: PORTRAIT_SRC,
      alt: "Portrait of Taylor",
    }),
  ]),
  schema.nodes["horizontal_rule"]!.create({ shuffleStart: 1, shuffleEnd: 12 }),
  schema.nodes["heading"]!.create(
    { level: 2, shuffleStart: 1, shuffleEnd: 12 },
    schema.text("Recent essays"),
  ),
  schema.nodes["row"]!.create({ shuffleStart: 0, shuffleEnd: 13 }, [
    schema.nodes["container"]!.create({ shuffleStart: 1, shuffleEnd: 4 }, [
      h(3, "On Slow Design"),
      p(
        "Why the most memorable interfaces aren't trying to be fast. A meditation on patience as a design principle.",
      ),
    ]),
    schema.nodes["container"]!.create({ shuffleStart: 5, shuffleEnd: 8 }, [
      h(3, "Letters from the Studio"),
      p(
        "Notes from a year spent rebuilding my creative practice — from morning rituals to the tools I keep on my desk.",
      ),
    ]),
    schema.nodes["container"]!.create({ shuffleStart: 9, shuffleEnd: 12 }, [
      h(3, "The Quiet Web"),
      p(
        "On personal sites, slow feeds, and the small communities still building the internet I fell in love with.",
      ),
    ]),
  ]),
  schema.nodes["row"]!.create({ shuffleStart: 0, shuffleEnd: 13 }, [
    schema.nodes["image"]!.create({
      shuffleStart: 1,
      shuffleEnd: 6,
      src: STUDIO_SRC,
      alt: "Studio desk",
    }),
    schema.nodes["container"]!.create({ shuffleStart: 7, shuffleEnd: 12 }, [
      h(2, "Inside the studio"),
      p(
        "I work from a converted carriage house in the East End. Most weeks you'll find me there with a Moka pot, a stack of index cards, and whatever book is currently rearranging my thinking.",
      ),
      p(
        "Try dragging this image to the other side of the row, or grabbing the side handles to resize it. Every block on this page is a real ProseMirror node.",
      ),
    ]),
  ]),
]);

function ImageNodeView({ nodeProps, ref, children: _children, ...props }: NodeViewComponentProps) {
  useSelectNode(() => {});
  return (
    <img
      ref={ref}
      {...props}
      src={nodeProps.node.attrs["src"] as string}
      draggable={false}
      style={{ touchAction: "none", userSelect: "none", borderRadius: "0.5rem" }}
    />
  );
}

const nodeViewComponents = { image: ImageNodeView };

const editorState = EditorState.create({
  doc: initialDoc,
  plugins: [reactKeys(), shuffle(), keymap(baseKeymap)],
});

export function DragDropEditor() {
  return (
    <ProseMirror defaultState={editorState} nodeViewComponents={nodeViewComponents}>
      <ShuffleSkeleton>
        <ProseMirrorDoc />
        <ResizeHandles />
        <DragHandles />
      </ShuffleSkeleton>
    </ProseMirror>
  );
}
