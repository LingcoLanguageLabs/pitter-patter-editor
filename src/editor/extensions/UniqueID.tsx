import type { NodeSpec } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
import { Plugin, PluginKey } from "prosemirror-state";

import { Extension } from "../types";

export interface UniqueIDOptions {
  /** Node type names to receive auto-assigned IDs. */
  nodes?: string[];
  /** Attribute key for the ID. Default: "id". */
  attrName?: string;
  /** ID generator. Default: crypto.randomUUID() if available, else short base36. */
  generateID?: () => string;
}

const DEFAULT_NODES = ["heading", "paragraph"];

function defaultGenerateID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `n${Math.random().toString(36).slice(2, 10)}`;
}

function withId(attrName: string, base: NodeSpec): NodeSpec {
  const baseToDOM = base.toDOM;
  return {
    ...base,
    attrs: { ...(base.attrs ?? {}), [attrName]: { default: null } },
    parseDOM: (base.parseDOM ?? []).map((rule) => ({
      ...rule,
      getAttrs(node: HTMLElement | string) {
        const baseAttrs =
          typeof rule.getAttrs === "function"
            ? rule.getAttrs(node as never)
            : rule.attrs ?? null;
        if (baseAttrs === false) return false;
        if (typeof node === "string") return baseAttrs ?? null;
        const id = node.getAttribute(attrName);
        return { ...(baseAttrs ?? {}), [attrName]: id || null };
      },
    })),
    toDOM(node) {
      const result = baseToDOM ? baseToDOM(node) : null;
      if (!result || !node.attrs[attrName]) return result ?? ["div", 0];
      const id = node.attrs[attrName] as string;
      if (Array.isArray(result)) {
        const [tag, second, ...rest] = result;
        const isAttrs =
          second &&
          typeof second === "object" &&
          !Array.isArray(second) &&
          !(second && (second as { nodeType?: number }).nodeType);
        const attrs = isAttrs ? { ...(second as Record<string, unknown>) } : {};
        attrs[attrName] = id;
        return isAttrs
          ? [tag, attrs, ...rest]
          : [tag, attrs, ...(second !== undefined ? [second, ...rest] : [])];
      }
      return result;
    },
  };
}

function ensureIDs(
  state: EditorState,
  types: Set<string>,
  attrName: string,
  gen: () => string,
): Transaction | null {
  const tr = state.tr;
  let modified = false;
  const seen = new Set<string>();
  state.doc.descendants((node, pos) => {
    if (!types.has(node.type.name)) return;
    const current = node.attrs[attrName] as string | null;
    if (!current || seen.has(current)) {
      const fresh = gen();
      seen.add(fresh);
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attrName]: fresh });
      modified = true;
    } else {
      seen.add(current);
    }
  });
  if (!modified) return null;
  // Don't pollute the undo stack with internal id assignments.
  return tr.setMeta("addToHistory", false);
}

const uniqueIDKey = new PluginKey("pp-unique-id");

export function createUniqueID({
  nodes = DEFAULT_NODES,
  attrName = "id",
  generateID = defaultGenerateID,
}: UniqueIDOptions = {}) {
  const patches: Record<string, (s: NodeSpec) => NodeSpec> = {};
  for (const n of nodes) {
    patches[n] = (s) => withId(attrName, s);
  }
  const types = new Set(nodes);

  return Extension.create({
    name: "unique-id",
    patchNodes: patches,
    plugins: () => [
      new Plugin({
        key: uniqueIDKey,
        // Initial pass: assign IDs to nodes in the starting doc that lack
        // them. appendTransaction can't fire until something dispatches, so
        // we kick a transaction ourselves on mount.
        view(view) {
          const tr = ensureIDs(view.state, types, attrName, generateID);
          if (tr) {
            queueMicrotask(() => {
              if (view.isDestroyed) return;
              view.dispatch(tr);
            });
          }
          return {};
        },
        // Ongoing pass: catch new nodes and de-dupe IDs after paste.
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return null;
          return ensureIDs(newState, types, attrName, generateID);
        },
      }),
    ],
    meta: { label: "Unique IDs", group: "system" },
  });
}

export const UniqueID = createUniqueID();
