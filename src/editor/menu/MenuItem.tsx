import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Tooltip } from "./Tooltip";

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
  tooltip?: ReactNode;
  shortcut?: string;
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { active, children, className, tooltip, shortcut, title, ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type="button"
      data-active={active || undefined}
      className={["pp-menu-item", className].filter(Boolean).join(" ")}
      {...rest}
      onMouseDown={(e) => {
        e.preventDefault();
        rest.onMouseDown?.(e);
      }}
    >
      {children}
    </button>
  );

  const label = tooltip ?? title;
  if (!label) return button;
  return (
    <Tooltip label={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
});
