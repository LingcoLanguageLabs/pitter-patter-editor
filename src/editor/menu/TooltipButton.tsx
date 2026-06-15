import type { ButtonHTMLAttributes } from "react";

import { Tooltip } from "./Tooltip";

interface TooltipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tooltip text — also used as the default `aria-label` so icon-only
   *  buttons stay accessible. Pass `aria-label` to override. */
  label: string;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * An icon-only button wrapped in the project's Radix `Tooltip`. Replaces
 * the native `title` bubble for buttons whose meaning lives entirely in
 * their icon. Requires a `TooltipProvider` ancestor (per the codebase
 * convention — see `Toolbar`, `BubbleMenu`, etc.).
 *
 * `type` defaults to `"button"` and `aria-label` defaults to `label`;
 * both are overridable via the spread (e.g. `type="submit"`).
 */
export function TooltipButton({
  label,
  shortcut,
  side,
  children,
  ...rest
}: TooltipButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={side}>
      <button type="button" aria-label={label} {...rest}>
        {children}
      </button>
    </Tooltip>
  );
}
