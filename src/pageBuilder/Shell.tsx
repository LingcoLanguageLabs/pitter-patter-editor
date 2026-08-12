/**
 * Top-level page-builder shell.
 *
 * Flex column: topbar pinned at the top, `.pb-shell-body` flexes to
 * fill below. Inside the body, `<LeftPanel />` is an absolutely-
 * positioned floating card that layers over the always-full-width
 * `<Canvas />`. The "panel pushes canvas right" effect is achieved
 * by animating the shell-body's `padding-left` based on
 * `data-panel="open"` (see `page-builder.css`'s rules under
 * "Layout"). This mirrors pagy.co's `.application` / `.panel` /
 * `.frame` setup *without* the `transform: translate` pagy uses on
 * its frame — that transform breaks shuffle's drag math when on an
 * ancestor of the editor.
 */

import { useEffect } from "react";

import { AddSectionModal } from "./AddSectionModal";
import { Canvas } from "./Canvas";
import { PageBuilderEditor } from "./Editor";
import { LeftPanel } from "./LeftPanel";
import { PagePreview } from "./PagePreview";
import { PageSnapshotFactory } from "./PageSnapshotFactory";
import type { InitialDocBuilder } from "./schema";
import { ThemeStyle } from "./ThemeStyle";
import { TopBar } from "./TopBar";
import { usePageBuilderStore } from "./store";

import "./page-builder.css";

export interface ShellProps {
  /** Which sample site is active on first mount. Defaults to the first
   *  catalog entry; the site picker switches between all sites at runtime. */
  initialSiteId?: string;
  /** Extra canvas overlays, forwarded to the editor. */
  overlays?: React.ReactNode;
}

export function Shell({ initialSiteId, overlays }: ShellProps) {
  const panel = usePageBuilderStore((s) => s.panel);
  const preview = usePageBuilderStore((s) => s.preview);
  const chromeTheme = usePageBuilderStore((s) => s.chromeTheme);
  const sites = usePageBuilderStore((s) => s.sites);
  const activeSiteId = usePageBuilderStore((s) => s.activeSiteId);
  const setActiveSite = usePageBuilderStore((s) => s.setActiveSite);
  // `siteEpoch` bumps on reset; mixing it into the editor key forces a fresh
  // mount even when `activeSiteId` is unchanged.
  const siteEpoch = usePageBuilderStore((s) => s.siteEpoch);

  // A story can pin which site loads first; apply it once on mount (the store
  // is a singleton shared across stories, so this resets to the pinned site).
  useEffect(() => {
    if (initialSiteId) setActiveSite(initialSiteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive light/dark of the editor chrome via a `<html data-pb-theme>` attribute
  // rather than a class on `.pb-shell`, so the `document.body`-portaled popovers
  // (block picker, link/section/block settings, text toolbar) inherit it too.
  // Only `--pb-*` tokens flip; the `.site` canvas content keeps its own theme.
  useEffect(() => {
    document.documentElement.dataset.pbTheme = chromeTheme;
  }, [chromeTheme]);

  const activeSite = sites.find((s) => s.id === activeSiteId) ?? sites[0]!;

  // Seed the editor from this site's cached doc if present, else its starter
  // `buildDoc`. Read non-reactively: the cache is only consumed at mount (the
  // editor remounts on `key` change), and `cacheActiveDoc` updates it on every
  // edit — subscribing would re-render the Shell on each keystroke for nothing.
  // A corrupt / stale cached doc (e.g. after a schema change) falls back to the
  // starter rather than crashing the mount.
  const cachedDoc = usePageBuilderStore.getState().docCache[activeSite.id];
  const initialDoc: InitialDocBuilder = cachedDoc
    ? (schema) => {
        try {
          return schema.nodeFromJSON(cachedDoc);
        } catch {
          return activeSite.buildDoc(schema);
        }
      }
    : activeSite.buildDoc;

  return (
    <div className="pb-shell" data-panel={panel ? "open" : "closed"}>
      <ThemeStyle />
      <TopBar />
      <div className="pb-shell-body">
        {/* LeftPanel is always mounted — `motion.aside` animates its
            `x` between `16` (open) and `-100%` (closed) so the panel
            slides off-screen rather than unmounting. */}
        <LeftPanel />
        <Canvas>
          {/* Keyed by the active site so switching sites re-mounts the editor
              with the new document — the heavy plugin stack initialises once in
              a `useMemo([])`, so a fresh doc means a fresh instance. */}
          <PageBuilderEditor
            key={`${activeSite.id}#${siteEpoch}`}
            initialDoc={initialDoc}
            overlays={overlays}
          />
        </Canvas>
        {/* Preview overlay — covers the canvas (and panel) below the TopBar
            with a read-only, interactive render of the site. The editor stays
            mounted underneath so toggling back is instant. Mounted only while
            previewing so it re-snapshots the doc each time it opens. */}
        {preview && <PagePreview />}
      </div>
      {/* "Add a section" template picker. Self-gates on `sectionModalOpen`
          and portals to `document.body`; the per-section "+ Add section"
          chrome opens it with the target insert position. */}
      <AddSectionModal />
      {/* Hidden off-screen renderer that keeps every slide's thumbnail fresh.
          Sits outside the canvas (and the main ProseMirror) since it mounts
          its own editor instances. */}
      <PageSnapshotFactory />
    </div>
  );
}
