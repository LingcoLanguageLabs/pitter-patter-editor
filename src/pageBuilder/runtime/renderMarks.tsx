/**
 * Renders a text node's marks → React, matching each mark's schema `toDOM`
 * so site text is styled identically to the editor. Marks wrap from the
 * innermost out, in document order.
 *
 * Mark set (page-builder schema): `strong`, `em`, `underline` (<u>),
 * `strike` (<s>), `code`, `link` (pagy's pp-link), `textColor` (pp-text -X),
 * `tooltip` (Radix gloss popover), `language` (`lang` attr).
 * See `schema.ts` (link/textColor/tooltip/language) and `editor/extensions/*`
 * (the rest).
 */

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

import { evaluateExpression, formatValue } from "../variables/expression";
import { useVariableScope } from "../variables/scope";
import type { JsonNode } from "./shuffleLayout";
import { useNavAction } from "./siteNav";

type MarkJson = NonNullable<JsonNode["marks"]>[number];

function wrap(mark: MarkJson, child: ReactNode, key: number): ReactNode {
  const a = mark.attrs ?? {};
  switch (mark.type) {
    case "strong":
      return <strong key={key}>{child}</strong>;
    case "em":
      return <em key={key}>{child}</em>;
    case "underline":
      return <u key={key}>{child}</u>;
    case "strike":
      return <s key={key}>{child}</s>;
    case "code":
      return <code key={key}>{child}</code>;
    case "link":
      return (
        <SiteLink key={key} attrs={a}>
          {child}
        </SiteLink>
      );
    case "textColor":
      return (
        <span key={key} className={`pp-text -${a["color"] as string}`} data-text-color={a["color"] as string}>
          {child}
        </span>
      );
    case "highlight":
      return (
        <mark
          key={key}
          className={`pp-highlight -${a["color"] as string}`}
          data-highlight={a["color"] as string}
        >
          {child}
        </mark>
      );
    case "tooltip":
      return (
        <TooltipMark key={key} content={(a["content"] as string) || ""}>
          {child}
        </TooltipMark>
      );
    case "language": {
      const lang = (a["lang"] as string) || "";
      return (
        <span key={key} className="pp-lang" lang={lang || undefined} data-lang={lang}>
          {child}
        </span>
      );
    }
    default:
      return child;
  }
}

/** The `link` mark's runtime form. A URL link navigates natively; the deck /
 *  section actions hand off to `SiteNavProvider` exactly like a button (shared
 *  `useNavAction`), and a prev/next link dead-ending at the deck edge renders
 *  disabled — same as the button. */
function SiteLink({
  attrs,
  children,
}: {
  attrs: Record<string, unknown>;
  children: ReactNode;
}) {
  const variant = attrs["variant"] as string;
  const newTab = !!attrs["newTab"];
  const { action, href, disabled, onClick } = useNavAction(attrs);
  // "Hide" disabled behavior: a prev/next link that dead-ends at the deck edge
  // omits its linked text run entirely (the button does the same). Returning the
  // children bare would leave dead text; we want it gone, so render nothing.
  if (disabled && attrs["whenDisabled"] === "hide") return null;
  return (
    <a
      href={href}
      className={`pp-link${variant === "minimal" ? " -minimal" : ""}`}
      {...(action !== "url" ? { "data-action": action } : {})}
      {...(disabled ? { "aria-disabled": true } : {})}
      {...(newTab && action === "url"
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

/** A glossed term — the `tooltip` mark's runtime form. The dotted-underlined
 *  term is the Radix tooltip trigger; hovering or focusing it reveals
 *  `content` in the same `.pp-tooltip` bubble the editor chrome uses. Each
 *  term carries its own `Provider` so it works anywhere the walker renders
 *  (published site, preview, thumbnail) without a tree-wide provider. An empty
 *  gloss (a just-created mark mid-edit) renders as plain text. */
function TooltipMark({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  if (!content) return <>{children}</>;
  return (
    <RadixTooltip.Provider delayDuration={150} skipDelayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <span className="pp-tooltip-term" tabIndex={0}>
            {children}
          </span>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className="pp-tooltip" side="top" sideOffset={6}>
            <span>{content}</span>
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

/** Replace every `{{ expression }}` in a text run with its evaluated value
 *  (unknown / errored expressions → empty). The single interpolation point,
 *  shared by the block walker and item inline text via {@link RenderText}. */
function interpolateText(text: string, scope: Record<string, string | number>) {
  if (!text.includes("{{")) return text;
  return text.replace(/\{\{([^}]*)\}\}/g, (_, expr) =>
    formatValue(evaluateExpression(expr, scope)),
  );
}

/** Render a text node → React: interpolate `{{ }}` against the live variable
 *  scope, then wrap in its marks (innermost first → outermost last). A component
 *  (not a plain function) so it can read the scope; outside a scope provider it
 *  falls back to sample values. */
export function RenderText({ node }: { node: JsonNode }): ReactNode {
  const scope = useVariableScope();
  let el: ReactNode = interpolateText(node.text ?? "", scope);
  const marks = node.marks ?? [];
  for (let i = 0; i < marks.length; i++) {
    el = wrap(marks[i], el, i);
  }
  return <>{el}</>;
}
