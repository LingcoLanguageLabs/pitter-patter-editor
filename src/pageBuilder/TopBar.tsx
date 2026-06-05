/**
 * Page-builder top bar — mirrors Pagy's `.application_header`.
 *
 * Left:   sidebar-toggle, undo, redo
 * Center: device switch (desktop / mobile)
 * Right:  preview (play), open-in-new-tab, settings, Published pill
 */

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowSquareOut,
  Gear,
  Monitor,
  Play,
  Sidebar,
  DeviceMobile,
} from "@phosphor-icons/react";

import { usePageBuilderStore } from "./store";

export function TopBar() {
  const { panel, setPanel, mobile, setMobile } = usePageBuilderStore();

  return (
    <header className="pb-topbar">
      <div className="pb-topbar-group">
        <IconButton
          aria-label={panel ? "Hide panel" : "Show panel"}
          onClick={() => setPanel(!panel)}
          active={panel}
        >
          <Sidebar size={18} weight="regular" />
        </IconButton>
        <IconButton aria-label="Undo">
          <ArrowCounterClockwise size={16} weight="regular" />
        </IconButton>
        <IconButton aria-label="Redo">
          <ArrowClockwise size={16} weight="regular" />
        </IconButton>
      </div>

      <div className="pb-topbar-group">
        <IconButton
          aria-label="Desktop view"
          onClick={() => setMobile(false)}
          active={!mobile}
        >
          <Monitor size={18} weight="regular" />
        </IconButton>
        <IconButton
          aria-label="Mobile view"
          onClick={() => setMobile(true)}
          active={mobile}
        >
          <DeviceMobile size={18} weight="regular" />
        </IconButton>
      </div>

      <div className="pb-topbar-group">
        <IconButton aria-label="Preview">
          <Play size={16} weight="fill" />
        </IconButton>
        <IconButton aria-label="Open in new tab">
          <ArrowSquareOut size={16} weight="regular" />
        </IconButton>
        <IconButton aria-label="Page settings">
          <Gear size={16} weight="regular" />
        </IconButton>
        <button type="button" className="pb-published-pill">
          Published
        </button>
      </div>
    </header>
  );
}

function IconButton({
  children,
  active,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className="pb-icon-button"
      data-active={active || undefined}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
