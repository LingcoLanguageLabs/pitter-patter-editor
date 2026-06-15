/**
 * Page-builder top bar — mirrors Pagy's `.application_header`.
 *
 * Left:   sidebar-toggle, undo, redo
 * Center: device switch (desktop / mobile)
 * Right:  theme toggle (sun/moon), preview (play), open-in-new-tab, settings,
 *         Published pill
 */

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowSquareOut,
  Gear,
  Monitor,
  Moon,
  Play,
  Sidebar,
  Sun,
  DeviceMobile,
} from "@phosphor-icons/react";

import { usePageBuilderStore } from "./store";

export function TopBar() {
  const {
    panel,
    setPanel,
    mobile,
    setMobile,
    preview,
    setPreview,
    chromeTheme,
    toggleChromeTheme,
  } = usePageBuilderStore();
  const dark = chromeTheme === "dark";

  return (
    <header className="pb-topbar">
      {/* Left group: panel toggle + undo/redo are editing-only, so they're
          hidden while previewing ("experiencing the site"). The empty group
          element stays mounted so the 1fr grid cell — and thus the centering
          of the device switch — doesn't shift. */}
      <div className="pb-topbar-group">
        {!preview && (
          <>
            <IconButton
              aria-label={panel ? "Hide panel" : "Show panel"}
              onClick={() => setPanel(!panel)}
              active={panel}
            >
              <Sidebar size={20} weight="regular" />
            </IconButton>
            <IconButton aria-label="Undo">
              <ArrowCounterClockwise size={20} weight="regular" />
            </IconButton>
            <IconButton aria-label="Redo">
              <ArrowClockwise size={20} weight="regular" />
            </IconButton>
          </>
        )}
      </div>

      <div className="pb-topbar-group">
        <IconButton
          className="-device"
          aria-label="Desktop view"
          onClick={() => setMobile(false)}
          active={!mobile}
        >
          <Monitor size={20} weight="regular" />
        </IconButton>
        <IconButton
          className="-device"
          aria-label="Mobile view"
          onClick={() => setMobile(true)}
          active={mobile}
        >
          <DeviceMobile size={20} weight="regular" />
        </IconButton>
      </div>

      <div className="pb-topbar-group">
        <IconButton
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleChromeTheme}
        >
          {dark ? (
            <Moon size={20} weight="fill" />
          ) : (
            <Sun size={20} weight="regular" />
          )}
        </IconButton>
        <IconButton
          aria-label={preview ? "Exit preview" : "Preview"}
          onClick={() => setPreview(!preview)}
          active={preview}
        >
          <Play size={20} weight="fill" />
        </IconButton>
        <IconButton aria-label="Open in new tab">
          <ArrowSquareOut size={20} weight="regular" />
        </IconButton>
        <IconButton aria-label="Page settings">
          <Gear size={20} weight="regular" />
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
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`pb-icon-button${className ? ` ${className}` : ""}`}
      data-active={active || undefined}
      // Default the hover tooltip to the accessible label so every header
      // button gets one (matching the Pages panel's `title`s); an explicit
      // `title` in `rest` still wins via the spread below.
      title={rest.title ?? (rest["aria-label"] as string | undefined)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
