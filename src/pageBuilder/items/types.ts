/**
 * Item-type system — the contract every learning "item" (Multiple Choice,
 * Fill Blanks, …) implements. Designed to scale to ~60 types: each type is a
 * self-contained folder that exports ONE `ItemDefinition`, registered in
 * `registry.ts`. Nothing else in the page builder edits per type.
 *
 * The two render surfaces are deliberately INDEPENDENT (see the project's
 * builder/completer split):
 *
 *   • BUILDER  — `nodes` + `nodeViews`: the author edits the item inline in the
 *                one ProseMirror document (shuffle drag/resize, tab between the
 *                prompt + options like any other text). No separate editors.
 *   • COMPLETER — `serialize` + `Completer`: the student-facing render. A
 *                 standalone React component that consumes a typed payload
 *                 produced by `serialize(node)` and NEVER touches ProseMirror.
 *                 Interactions (word banks, grouping) use dnd-kit, not shuffle.
 *
 * The `serialize()` boundary is what keeps the completer decoupled: the runtime
 * walker (`renderNode`) hands it plain doc JSON, gets back a typed def, and
 * mounts `Completer`. Answers stay contained to the block — the completer owns
 * its own response state; nothing leaks to a global store.
 */

import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import type { Icon } from "@phosphor-icons/react";
import type { MarkSpec, Node as PmNode, NodeSpec, Schema } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
import type { ComponentType } from "react";

import type { JsonNode } from "../runtime/shuffleLayout";

/** A button an item contributes to the text-selection toolbar (e.g. Fill
 *  Blanks' "Mark as blank"), so marking lives with the item rather than being
 *  hard-coded into the toolbar. */
export interface ItemSelectionAction {
  key: string;
  label: string;
  icon?: Icon;
  /** Show the button for the current selection? */
  isAvailable(state: EditorState): boolean;
  /** Already applied (toggle/active styling)? */
  isActive?(state: EditorState): boolean;
  /** Perform the action. Return false if it couldn't apply. */
  run(state: EditorState, dispatch: (tr: Transaction) => void): boolean;
}

/** Picker category for item blocks. Folded into the block catalog's groups. */
export type ItemGroup = "Questions";

/**
 * How an item earns its points — an axis ORTHOGONAL to the item type.
 *   • "correctness" — graded against an answer key (right/wrong).
 *   • "completion"  — any non-empty response earns full credit; there's no
 *     right answer (opinion polls, "which foods do you like", reflections).
 * The same MC node can be either; an opinion poll is just MC + "completion".
 */
export type ScoringMode = "correctness" | "completion";

/**
 * The uniform outcome of grading one item — what every type's `grade()`
 * returns, so a future aggregate scorer can sum across types without knowing
 * any one of them. `possible` is 0 for an item that carries no credit
 * (purely informational / free-response with no completion credit).
 */
export interface ItemGradeResult {
  /** correctness items resolve to correct/incorrect; completion items to
   *  complete/incomplete. */
  status: "correct" | "incorrect" | "complete" | "incomplete";
  /** Points awarded for this response. */
  earned: number;
  /** Points available (0 ⇒ ungraded/informational). */
  possible: number;
}

/** What the "+ Add block" picker needs to list an item type. */
export interface ItemCatalogEntry {
  /** ProseMirror node-type name of the item's outer block (the discriminant). */
  type: string;
  /** Label shown in the picker. */
  label: string;
  /** Icon rendered next to the row. */
  icon: Icon;
  /** Picker category. */
  group: ItemGroup;
  /** Attrs to stamp on the constructed node — lets one type expose several
   *  picker presets of the SAME node (e.g. "Multiple Choice" vs "Opinion poll"
   *  = mc with `scoringMode: "completion"`). Passed to `construct`. */
  attrs?: Record<string, unknown>;
}

/** A builder NodeView component, matching `<ProseMirror nodeViewComponents>`. */
export type ItemNodeView = ComponentType<NodeViewComponentProps>;

/** Props every completer receives — just its typed definition. Response state
 *  lives inside the completer (contained to the block). */
export interface CompleterProps<Def> {
  def: Def;
}

/** Props for an item's settings panel — the block-menu form (Classroom's
 *  `propertiesComponent`). Self-contained: just the live node to read attrs
 *  from and a setter that commits one attr. The page builder wraps it with the
 *  shared header (type/duplicate/delete) and spacing controls. */
export interface ItemSettingsProps {
  node: PmNode;
  setAttr: (name: string, value: unknown) => void;
}

/**
 * The full definition of one item type. `Def` is the typed payload `serialize`
 * produces and `Completer` consumes — the contract between the two surfaces.
 */
export interface ItemDefinition<Def = unknown> {
  /** Outer block node-type name; the discriminant used everywhere. */
  type: string;
  /** Picker entry. */
  catalog: ItemCatalogEntry;
  /** Extra picker rows for the SAME node type, differing only by the attrs they
   *  stamp (e.g. an "Opinion poll" preset of Multiple Choice). Each becomes its
   *  own row alongside `catalog`; insertion routes through `construct(attrs)`. */
  catalogPresets?: ItemCatalogEntry[];
  /** Node specs this type contributes (outer block + its children), keyed by
   *  node name. Folded into the page-builder schema before the shuffle step,
   *  so a `group: "block"` outer node gets grid/margin/containment for free. */
  nodes: Record<string, NodeSpec>;
  /** Optional mark specs (e.g. Fill Blanks' `blank` mark). */
  marks?: Record<string, MarkSpec>;
  /** Builder NodeViews keyed by node name. */
  nodeViews: Record<string, ItemNodeView>;
  /** Builds a default instance for insertion from the picker. `attrs` carries
   *  the chosen catalog entry's preset attrs (e.g. an opinion poll's
   *  `scoringMode`); ignore it for a type with a single preset. */
  construct(schema: Schema, attrs?: Record<string, unknown>): PmNode;
  /** Doc JSON → typed payload for the completer (the decoupling boundary). */
  serialize(node: JsonNode): Def;
  /** Student-facing render. Pure React over `Def`; owns its response state. */
  Completer: ComponentType<CompleterProps<Def>>;
  /** Grade a student response into the uniform {@link ItemGradeResult}. Pure (no
   *  DOM / store), so the SAME function powers the completer's inline feedback
   *  AND a future aggregate scorer. `response` is this type's own persisted
   *  response shape (what the completer writes to the grading store). Absent ⇒
   *  the item carries no credit (informational / free-response). */
  grade?(def: Def, response: unknown): ItemGradeResult;
  /** Optional settings panel shown in the block menu when the item is selected
   *  (mode, points, …). Registered here so the type stays self-contained — the
   *  page-builder's `BlockSettings` reads it from the registry. */
  SettingsForm?: ComponentType<ItemSettingsProps>;
  /** Human display labels for this item's node types (the outer block AND its
   *  children), keyed by node-type name — used for the shuffle drag-handle pill
   *  and the Layers panel. e.g. `{ mc: "Multiple Choice", mc_option: "Option" }`.
   *  Keeps user-facing naming self-contained per type. */
  nodeLabels?: Record<string, string>;
  /** Inline atom node types this item adds (e.g. Fill Blanks' `blank`). The
   *  runtime walker delegates rendering of these to the enclosing completer via
   *  the inline-item context, so interactive inline nodes get the completer's
   *  response state. */
  inlineNodes?: string[];
  /** Toolbar buttons contributed for a text selection (e.g. "Mark as blank"). */
  selectionActions?: ItemSelectionAction[];
  /** A selection-driven settings popover (same pattern as BlockSettings),
   *  rendered once in the editor. It watches the selection itself and shows
   *  when relevant (e.g. a `blank` node is selected). Editing via setNodeMarkup
   *  doesn't remount it, so local UI state (open option list) survives. */
  SelectionPopover?: ComponentType;
}
