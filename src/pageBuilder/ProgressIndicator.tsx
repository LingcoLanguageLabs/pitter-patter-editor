/**
 * The progress indicator's inner markup — shared by the builder NodeView and the
 * runtime walker so the bar/ring looks identical in both. It reads its own
 * `value`/`max` expressions and evaluates them against the variable scope in
 * context (sample values in the editor, live values on the published site), so
 * neither caller duplicates the evaluation. The grid wrapper + color slot live
 * on the caller's outer element (it carries the shuffle layout); this renders
 * only the indicator body.
 */

import { evaluateNumber } from "./variables/expression";
import { useVariableScope } from "./variables/scope";

const str = (v: unknown, fallback = ""): string =>
  v == null || v === "" ? fallback : String(v);

export function ProgressIndicator({
  attrs,
}: {
  attrs: Record<string, unknown>;
}) {
  const scope = useVariableScope();
  const value = evaluateNumber(str(attrs["value"], "score.percent"), scope);
  const max = evaluateNumber(str(attrs["max"], "100"), scope) || 100;
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const display = str(attrs["display"], "bar");
  const showValue = attrs["showValue"] !== false;
  const label = str(attrs["label"]);
  const valueText = `${Math.round(pct)}%`;

  if (display === "ring") {
    // A 36-radius circle; dashoffset reveals the filled arc.
    const r = 36;
    const c = 2 * Math.PI * r;
    return (
      <div className="pb-progress-ring">
        <svg className="pb-progress-ring-svg" viewBox="0 0 80 80" aria-hidden>
          <circle className="pb-progress-ring-track" cx="40" cy="40" r={r} />
          <circle
            className="pb-progress-ring-fill"
            cx="40"
            cy="40"
            r={r}
            style={{
              strokeDasharray: c,
              strokeDashoffset: c * (1 - pct / 100),
            }}
          />
        </svg>
        {showValue && <span className="pb-progress-ring-value">{valueText}</span>}
        {label && <span className="pb-progress-ring-label">{label}</span>}
      </div>
    );
  }

  return (
    <div className="pb-progress-bar">
      {(label || showValue) && (
        <div className="pb-progress-bar-head">
          {label && <span className="pb-progress-bar-label">{label}</span>}
          {showValue && (
            <span className="pb-progress-bar-value">{valueText}</span>
          )}
        </div>
      )}
      <div className="pb-progress-bar-track">
        <div className="pb-progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
