/**
 * Site navigation context + the shared button/link "action" resolver.
 *
 * Lives in its own module so BOTH the block walker (`renderNode`, buttons) and
 * the mark walker (`renderMarks`, text links) can read it without an import
 * cycle. The provider is mounted by `<SiteRenderer>`, which owns the deck +
 * section navigation; consumers only run actions.
 */

import { createContext, useContext, type ReactNode } from "react";

export interface SiteNav {
  /** Go to a specific deck page by id. */
  navigate: (pageId: string) => void;
  /** Step the deck relative to the current page (-1 prev, +1 next). */
  navigateBy: (delta: number) => void;
  /** Whether a relative step exists (false on the first/last page) — drives the
   *  disabled state of prev/next actions. */
  canNavigateBy: (delta: number) => boolean;
  /** Scroll to a section by its `htmlId`, switching to its page first if the
   *  section lives on a different page (only the active page is mounted). */
  goToSection: (sectionId: string) => void;
}

const SiteNavContext = createContext<SiteNav | null>(null);

export function SiteNavProvider({
  nav,
  children,
}: {
  nav: SiteNav;
  children: ReactNode;
}) {
  return (
    <SiteNavContext.Provider value={nav}>{children}</SiteNavContext.Provider>
  );
}

export function useSiteNav(): SiteNav | null {
  return useContext(SiteNavContext);
}

export interface ResolvedAction {
  action: string;
  /** Real link target for the URL action; "#" for nav actions. */
  href: string;
  /** True for a prev/next action that dead-ends at the deck edge. */
  disabled: boolean;
  /** Click handler for nav actions (preventDefault + move); undefined for URL,
   *  which navigates natively. */
  onClick?: (e: { preventDefault: () => void }) => void;
}

/** Resolve a button/link's action attrs into href + click behavior, shared by
 *  `SiteButton` and the runtime text link so the two behave identically. */
export function useNavAction(attrs: Record<string, unknown>): ResolvedAction {
  const nav = useSiteNav();
  const action =
    (typeof attrs["action"] === "string" && (attrs["action"] as string)) ||
    "url";
  const href = action === "url" ? (attrs["href"] as string) || "#" : "#";
  const disabled =
    (action === "prevPage" && !nav?.canNavigateBy(-1)) ||
    (action === "nextPage" && !nav?.canNavigateBy(1));
  const onClick =
    action === "url"
      ? undefined
      : (e: { preventDefault: () => void }) => {
          e.preventDefault();
          if (!nav || disabled) return;
          if (action === "page") {
            const id = String(attrs["pageId"] ?? "");
            if (id) nav.navigate(id);
          } else if (action === "prevPage") {
            nav.navigateBy(-1);
          } else if (action === "nextPage") {
            nav.navigateBy(1);
          } else if (action === "section") {
            const id = String(attrs["sectionId"] ?? "");
            if (id) nav.goToSection(id);
          }
        };
  return { action, href, disabled, onClick };
}
