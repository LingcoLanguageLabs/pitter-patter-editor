import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "fixed" | "floating";
  children: ReactNode;
}

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
  { variant = "fixed", className, children, ...rest },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement>(null);
  useToolbarNavigation(localRef);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  return (
    <div
      ref={setRefs}
      role="toolbar"
      aria-label="Formatting"
      data-variant={variant}
      className={["pp-toolbar", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
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
