/**
 * Global-bar visibility.
 *
 * The doc-level header / footer (the site-wide masters) live ONCE, before /
 * after the deck, and render around every page. But each page can opt out:
 * detach it (its own override renders instead) or hide it (a title page). Since
 * the master is a single node rendered once, this plugin reconciles it with the
 * ACTIVE page's choice:
 *
 *   • active page inherits the master  → master shown (no decoration)
 *   • active page overrides / hides it → master gets `pb-global-bar-hidden`
 *     (display:none) so we never see both the master and the page's own bar
 *   • active page HID it (no override) → a restore ghost is mounted at the
 *     page edge so the hidden bar can be brought back
 *
 * Rebuilt on doc change AND on active-page switch (a meta-only transaction, so
 * we diff the active id ourselves — `sectionChromePlugin`'s docChanged-only
 * gate isn't enough here). Placed AFTER `activePagePlugin` in the plugin list
 * so `getActivePageId(newState)` reads the just-applied active id.
 */

import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { widget } from "@handlewithcare/react-prosemirror";

import { getActivePageId, pageList } from "./activePagePlugin";
import { FooterRestoreGhost, HeaderRestoreGhost } from "./GlobalBarRestore";
import { globalBar, resolvePageBarScope } from "./headerFooter";

interface GlobalBarState {
  deco: DecorationSet;
  activeId: string | null;
}

const globalBarKey = new PluginKey<GlobalBarState>("pb-global-bar");

const KINDS = ["header", "footer"] as const;

function build(state: EditorState): DecorationSet {
  const { doc } = state;
  const activeId = getActivePageId(state);
  const page = pageList(doc).find((p) => p.id === activeId) ?? null;
  const decos: Decoration[] = [];

  for (const kind of KINDS) {
    const master = globalBar(doc, kind);
    if (!master) continue;
    const scope = page ? resolvePageBarScope(doc, page.node, kind) : "global";
    if (scope === "global") continue; // master applies — leave it visible

    // The active page doesn't use the master → hide it (so an override doesn't
    // double up with it, and a hidden bar truly disappears).
    decos.push(
      Decoration.node(master.pos, master.pos + master.node.nodeSize, {
        class: "pb-global-bar-hidden",
      }),
    );

    // Hidden-with-no-override → drop a restore ghost at the page edge.
    if (scope === "hidden" && page) {
      if (kind === "header") {
        decos.push(
          widget(page.pos + 1, HeaderRestoreGhost, {
            side: -1,
            key: `global-restore-header-${page.id}`,
            ignoreSelection: true,
          }),
        );
      } else {
        decos.push(
          widget(page.pos + page.node.nodeSize - 1, FooterRestoreGhost, {
            side: 1,
            key: `global-restore-footer-${page.id}`,
            ignoreSelection: true,
          }),
        );
      }
    }
  }
  return DecorationSet.create(doc, decos);
}

export function globalBarPlugin() {
  return new Plugin<GlobalBarState>({
    key: globalBarKey,
    state: {
      init: (_config, state) => ({ deco: build(state), activeId: getActivePageId(state) }),
      apply(tr, value, _old, newState) {
        const activeId = getActivePageId(newState);
        if (tr.docChanged || activeId !== value.activeId) {
          return { deco: build(newState), activeId };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        return globalBarKey.getState(state)?.deco;
      },
    },
  });
}
