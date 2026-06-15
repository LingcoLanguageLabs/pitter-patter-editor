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

import { Canvas } from "./Canvas";
import { PageBuilderEditor, type PageBuilderEditorProps } from "./Editor";
import { LeftPanel } from "./LeftPanel";
import { PagePreview } from "./PagePreview";
import { PageSnapshotFactory } from "./PageSnapshotFactory";
import { ThemeStyle } from "./ThemeStyle";
import { TopBar } from "./TopBar";
import { usePageBuilderStore } from "./store";

import "./page-builder.css";

export type ShellProps = PageBuilderEditorProps;

export function Shell(props: ShellProps) {
  const panel = usePageBuilderStore((s) => s.panel);
  const preview = usePageBuilderStore((s) => s.preview);
  const chromeTheme = usePageBuilderStore((s) => s.chromeTheme);

  // Drive light/dark of the editor chrome via a `<html data-pb-theme>` attribute
  // rather than a class on `.pb-shell`, so the `document.body`-portaled popovers
  // (block picker, link/section/block settings, text toolbar) inherit it too.
  // Only `--pb-*` tokens flip; the `.site` canvas content keeps its own theme.
  useEffect(() => {
    document.documentElement.dataset.pbTheme = chromeTheme;
  }, [chromeTheme]);

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
          <PageBuilderEditor
            initialDoc={props.initialDoc}
            overlays={props.overlays}
          />
        </Canvas>
        {/* Preview overlay — covers the canvas (and panel) below the TopBar
            with a read-only, interactive render of the site. The editor stays
            mounted underneath so toggling back is instant. Mounted only while
            previewing so it re-snapshots the doc each time it opens. */}
        {preview && <PagePreview />}
      </div>
      {/* Hidden off-screen renderer that keeps every slide's thumbnail fresh.
          Sits outside the canvas (and the main ProseMirror) since it mounts
          its own editor instances. */}
      <PageSnapshotFactory />
    </div>
  );
}
