/**
 * The expression engine — the single, safe evaluator shared by `{{ }}` text
 * interpolation and the progress-bar value. NO `eval`/`Function`: a tiny
 * recursive-descent parser over a fixed grammar.
 *
 * Grammar:
 *   expr   = term (('+' | '-') term)*
 *   term   = factor (('*' | '/' | '%') factor)*
 *   factor = number | ident | call | '(' expr ')' | '-' factor
 *   call   = ident '(' (expr (',' expr)*)? ')'
 *   ident  = name ('.' name)*      e.g. score.earned, learner.first_name
 *
 * Variables resolve against a flat scope (dotted keys → string | number). A bare
 * identifier evaluates to its raw value (so `learner.first_name` yields the
 * string "Seth"); arithmetic coerces operands to numbers. Unknown names and
 * parse errors yield `undefined`, which interpolation renders as empty.
 */

export type VariableScope = Record<string, string | number>;

export type ExprValue = number | string | undefined;

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  round: ([x]) => Math.round(x ?? 0),
  floor: ([x]) => Math.floor(x ?? 0),
  ceil: ([x]) => Math.ceil(x ?? 0),
  abs: ([x]) => Math.abs(x ?? 0),
  min: (xs) => Math.min(...xs),
  max: (xs) => Math.max(...xs),
  clamp: ([x = 0, lo = 0, hi = 0]) => Math.min(Math.max(x, lo), hi),
};

// ── AST ────────────────────────────────────────────────────────────────
type Node =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "neg"; operand: Node }
  | { kind: "bin"; op: string; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] };

// ── Tokenizer ────────────────────────────────────────────────────────────
type Token =
  | { t: "num"; v: number }
  | { t: "ident"; v: string }
  | { t: "op"; v: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if ("+-*/%(),".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c) && !/[A-Za-z_]/.test(input[i - 1] ?? "")) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j++;
      const num = Number(input.slice(i, j));
      if (Number.isNaN(num)) throw new Error("bad number");
      tokens.push({ t: "num", v: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_.]/.test(input[j]!)) j++;
      tokens.push({ t: "ident", v: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`unexpected character: ${c}`);
  }
  return tokens;
}

// ── Parser (recursive descent) ─────────────────────────────────────────
function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  function parseExpr(): Node {
    let left = parseTerm();
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) {
      const op = String(eat()!.v);
      left = { kind: "bin", op, left, right: parseTerm() };
    }
    return left;
  }

  function parseTerm(): Node {
    let left = parseFactor();
    while (
      peek()?.t === "op" &&
      (peek()!.v === "*" || peek()!.v === "/" || peek()!.v === "%")
    ) {
      const op = String(eat()!.v);
      left = { kind: "bin", op, left, right: parseFactor() };
    }
    return left;
  }

  function parseFactor(): Node {
    const tok = peek();
    if (!tok) throw new Error("unexpected end");
    if (tok.t === "op" && tok.v === "-") {
      eat();
      return { kind: "neg", operand: parseFactor() };
    }
    if (tok.t === "op" && tok.v === "(") {
      eat();
      const inner = parseExpr();
      if (peek()?.v !== ")") throw new Error("expected )");
      eat();
      return inner;
    }
    if (tok.t === "num") {
      eat();
      return { kind: "num", value: tok.v };
    }
    if (tok.t === "ident") {
      eat();
      // Function call?
      if (peek()?.t === "op" && peek()!.v === "(") {
        eat();
        const args: Node[] = [];
        if (peek()?.v !== ")") {
          args.push(parseExpr());
          while (peek()?.v === ",") {
            eat();
            args.push(parseExpr());
          }
        }
        if (peek()?.v !== ")") throw new Error("expected )");
        eat();
        return { kind: "call", name: tok.v, args };
      }
      return { kind: "var", name: tok.v };
    }
    throw new Error("unexpected token");
  }

  const node = parseExpr();
  if (pos < tokens.length) throw new Error("trailing tokens");
  return node;
}

function toNumber(v: ExprValue): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? NaN : n;
  }
  return NaN;
}

function evalNode(node: Node, scope: VariableScope): ExprValue {
  switch (node.kind) {
    case "num":
      return node.value;
    case "var":
      return scope[node.name];
    case "neg":
      return -toNumber(evalNode(node.operand, scope));
    case "bin": {
      const l = toNumber(evalNode(node.left, scope));
      const r = toNumber(evalNode(node.right, scope));
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? NaN : l / r;
        case "%":
          return r === 0 ? NaN : l % r;
      }
      return NaN;
    }
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) return undefined;
      return fn(node.args.map((a) => toNumber(evalNode(a, scope))));
    }
  }
}

/** Evaluate an expression against a scope. Returns a string (bare string var),
 *  a number, or undefined (unknown var / parse error / NaN). */
export function evaluateExpression(
  expr: string,
  scope: VariableScope,
): ExprValue {
  const trimmed = expr.trim();
  if (!trimmed) return undefined;
  let result: ExprValue;
  try {
    result = evalNode(parse(tokenize(trimmed)), scope);
  } catch {
    return undefined;
  }
  if (typeof result === "number" && Number.isNaN(result)) return undefined;
  return result;
}

/** Evaluate to a number (for the progress bar). Non-numeric / errors → 0. */
export function evaluateNumber(expr: string, scope: VariableScope): number {
  const v = evaluateExpression(expr, scope);
  const n = toNumber(v);
  return Number.isNaN(n) ? 0 : n;
}

/** Format an evaluated value for display in interpolated text. undefined → "";
 *  whole numbers print plain, fractions round to 2 places. */
export function formatValue(v: ExprValue): string {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}
