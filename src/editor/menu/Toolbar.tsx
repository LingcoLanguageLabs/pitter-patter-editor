import { DotsThree } from "@phosphor-icons/react";
import * as RadixPopover from "@radix-ui/react-popover";
import {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Layout mode for handling extra toolbar items.
 * - "overflow" (default): excess items go into a "..." popover at the end.
 *   Like TinyMCE's `toolbar_mode: "floating"`. Single visual row.
 * - "wrap": classic flex-wrap, items reflow onto multiple rows.
 * - "scroll": horizontal scroll, single row, no overflow popover.
 *
 * Future: TinyMCE also has "sliding" (second row slides in on demand).
 */
export type ToolbarMode = "overflow" | "wrap" | "scroll";

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "fixed" | "floating";
  mode?: ToolbarMode;
  children: ReactNode;
}

const OVERFLOW_BUTTON_WIDTH = 40;

function findItems(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [role="button"]:not([disabled]), [tabindex="0"]:not([disabled])',
    ),
  );
}

function useToolbarNavigation(toolbarRef: React.RefObject<HTMLDivElement | null>) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const root = toolbarRef.current;
      if (!root) return;
      const target = e.target as HTMLElement;
      if (!root.contains(target)) return;
      const items = findItems(root);
      if (items.length === 0) return;
      const idx = items.indexOf(target);
      if (idx === -1) return;
      e.preventDefault();
      const next =
        e.key === "ArrowRight"
          ? (idx + 1) % items.length
          : (idx - 1 + items.length) % items.length;
      items[next]?.focus();
    },
    [toolbarRef],
  );

  useEffect(() => {
    const root = toolbarRef.current;
    if (!root) return;
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown, toolbarRef]);
}

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { variant = "fixed", mode, className, children, ...rest },
  forwardedRef,
) {
  // Bubble menus shouldn't overflow — they're already small and contextual.
  const effectiveMode: ToolbarMode =
    mode ?? (variant === "floating" ? "wrap" : "overflow");

  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const childArray = Children.toArray(children);
  const [visibleCount, setVisibleCount] = useState(childArray.length);

  useToolbarNavigation(containerRef);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const responsive = effectiveMode === "overflow";

  useLayoutEffect(() => {
    if (!responsive) {
      setVisibleCount(childArray.length);
      return;
    }
    const container = containerRef.current;
    const ghost = ghostRef.current;
    if (!container || !ghost) return;

    const measure = () => {
      const containerWidth = container.clientWidth;
      const ghostChildren = Array.from(ghost.children) as HTMLElement[];
      if (ghostChildren.length === 0) {
        setVisibleCount(0);
        return;
      }
      const widths = ghostChildren.map((el) => el.offsetWidth);
      const totalWidth = widths.reduce((a, b) => a + b, 0);
      if (totalWidth <= containerWidth) {
        setVisibleCount(childArray.length);
        return;
      }
      const budget = containerWidth - OVERFLOW_BUTTON_WIDTH;
      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const w = widths[i]!;
        if (used + w > budget) break;
        used += w;
        count++;
      }
      // Avoid trailing dividers in the visible row (looks weird).
      while (
        count > 0 &&
        ghostChildren[count - 1]?.classList.contains("pp-toolbar-divider")
      ) {
        count--;
      }
      setVisibleCount(Math.max(0, count));
    };

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(container);
    return () => obs.disconnect();
  }, [childArray.length, responsive]);

  const visibleChildren = responsive
    ? childArray.slice(0, visibleCount)
    : childArray;
  const overflowChildren = responsive ? childArray.slice(visibleCount) : [];
  const hasOverflow = overflowChildren.length > 0;

  return (
    <>
      <div
        ref={setRefs}
        role="toolbar"
        aria-label="Formatting"
        data-variant={variant}
        data-mode={effectiveMode}
        className={
          [
            "pp-toolbar",
            `pp-toolbar--mode-${effectiveMode}`,
            className,
          ]
            .filter(Boolean)
            .join(" ")
        }
        {...rest}
      >
        {visibleChildren}
        {hasOverflow && (
          <RadixPopover.Root>
            <RadixPopover.Trigger asChild>
              <button
                type="button"
                className="pp-menu-item pp-toolbar-overflow"
                aria-label="More formatting"
                title="More"
              >
                <DotsThree size={18} weight="bold" />
              </button>
            </RadixPopover.Trigger>
            <RadixPopover.Portal>
              <RadixPopover.Content
                className="pp-toolbar-overflow-content"
                side="bottom"
                align="end"
                sideOffset={6}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                {overflowChildren}
              </RadixPopover.Content>
            </RadixPopover.Portal>
          </RadixPopover.Root>
        )}
      </div>
      {responsive && (
        <div ref={ghostRef} className="pp-toolbar-ghost" aria-hidden="true">
          {children}
        </div>
      )}
    </>
  );
});

interface ToolbarGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const ToolbarGroup = forwardRef<HTMLDivElement, ToolbarGroupProps>(
  function ToolbarGroup({ className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        role="group"
        className={["pp-toolbar-group", className].filter(Boolean).join(" ")}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

export const ToolbarSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ToolbarSeparator({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation="vertical"
        className={["pp-toolbar-divider", className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  },
);
