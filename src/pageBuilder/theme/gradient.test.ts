import { describe, expect, it } from "vitest";

import {
  colorAt,
  gradientToCss,
  isGradient,
  normalizeColor,
  parseGradient,
  stopsToBarCss,
} from "./gradient";

/* ── normalizeColor: every CSS colour form I can think of ──────────── */

describe("normalizeColor — hex", () => {
  it("3-digit", () => expect(normalizeColor("#f00")).toBe("#ff0000"));
  it("6-digit", () => expect(normalizeColor("#ff0000")).toBe("#ff0000"));
  it("uppercase normalises to lowercase", () =>
    expect(normalizeColor("#FF0000")).toBe("#ff0000"));
  it("6-digit other", () => expect(normalizeColor("#62bfad")).toBe("#62bfad"));
  it("4-digit with alpha", () => expect(normalizeColor("#ff000088")?.length).toBe(9));
  it("8-digit with alpha", () => expect(normalizeColor("#ff000080")).toBe("#ff000080"));
  it("opaque 8-digit collapses to 6", () =>
    expect(normalizeColor("#ff0000ff")).toBe("#ff0000"));
  it("surrounding whitespace is trimmed", () =>
    expect(normalizeColor("  #ff0000  ")).toBe("#ff0000"));
});

describe("normalizeColor — rgb()/rgba() legacy (comma)", () => {
  it("rgb", () => expect(normalizeColor("rgb(255, 0, 0)")).toBe("#ff0000"));
  it("rgb no spaces", () => expect(normalizeColor("rgb(255,0,0)")).toBe("#ff0000"));
  it("rgba 0.5 → 8-digit", () =>
    expect(normalizeColor("rgba(255, 0, 0, 0.5)")).toBe("#ff000080"));
  it("rgba 1 → 6-digit", () =>
    expect(normalizeColor("rgba(0, 0, 0, 1)")).toBe("#000000"));
  it("the user's example stops", () => {
    expect(normalizeColor("rgb(244, 238, 228)")).toBe("#f4eee4");
    expect(normalizeColor("rgb(250, 248, 244)")).toBe("#faf8f4");
  });
});

describe("normalizeColor — rgb() modern (space, slash-alpha, percent)", () => {
  it("space-separated", () => expect(normalizeColor("rgb(255 0 0)")).toBe("#ff0000"));
  it("slash alpha as decimal", () =>
    expect(normalizeColor("rgb(255 0 0 / 0.5)")).toBe("#ff000080"));
  it("slash alpha as percent", () =>
    expect(normalizeColor("rgb(255 0 0 / 50%)")).toBe("#ff000080"));
  it("percent channels", () =>
    expect(normalizeColor("rgb(100% 0% 0%)")).toBe("#ff0000"));
  it("modern rgba name", () =>
    expect(normalizeColor("rgba(0 0 0 / 100%)")).toBe("#000000"));
});

describe("normalizeColor — hsl()/hsla()", () => {
  it("legacy hsl", () => expect(normalizeColor("hsl(0, 100%, 50%)")).toBe("#ff0000"));
  it("legacy hsla", () =>
    expect(normalizeColor("hsla(0, 100%, 50%, 0.5)")).toBe("#ff000080"));
  it("modern space hsl", () => expect(normalizeColor("hsl(0 100% 50%)")).toBe("#ff0000"));
  it("modern hsl deg + slash alpha", () =>
    expect(normalizeColor("hsl(0deg 100% 50% / 50%)")).toBe("#ff000080"));
  it("green via hue", () => expect(normalizeColor("hsl(120 100% 50%)")).toBe("#00ff00"));
  it("hue in turn", () => expect(normalizeColor("hsl(0.5turn 100% 50%)")).toBe("#00ffff"));
});

describe("normalizeColor — named & keywords", () => {
  it("red", () => expect(normalizeColor("red")).toBe("#ff0000"));
  it("white", () => expect(normalizeColor("white")).toBe("#ffffff"));
  it("black", () => expect(normalizeColor("black")).toBe("#000000"));
  it("rebeccapurple", () => expect(normalizeColor("rebeccapurple")).toBe("#663399"));
  it("case-insensitive name", () => expect(normalizeColor("ReD")).toBe("#ff0000"));
  it("transparent", () => expect(normalizeColor("transparent")).toBe("#00000000"));
});

describe("normalizeColor — invalid input → null", () => {
  it("empty", () => expect(normalizeColor("")).toBeNull());
  it("whitespace only", () => expect(normalizeColor("   ")).toBeNull());
  it("bare hash", () => expect(normalizeColor("#")).toBeNull());
  it("garbage", () => expect(normalizeColor("notacolor")).toBeNull());
  it("too few rgb components", () => expect(normalizeColor("rgb(1, 2)")).toBeNull());
  it("a gradient is not a colour", () =>
    expect(normalizeColor("linear-gradient(#fff, #000)")).toBeNull());
});

/* ── isGradient ────────────────────────────────────────────────────── */

describe("isGradient", () => {
  it.each([
    "linear-gradient(90deg, #fff, #000)",
    "radial-gradient(at 50% 50%, #fff, #000)",
    "conic-gradient(from 0deg, #fff, #000)",
  ])("true for %s", (v) => expect(isGradient(v)).toBe(true));

  it.each(["#ffffff", "rgb(0,0,0)", "red", "", null, undefined])(
    "false for %s",
    (v) => expect(isGradient(v)).toBe(false),
  );
});

/* ── parseGradient + gradientToCss ─────────────────────────────────── */

describe("parseGradient — the user's radial example round-trips", () => {
  const input =
    "radial-gradient(120% 80% at 80% 0%, rgb(244, 238, 228) 0%, rgb(250, 248, 244) 60%)";
  const spec = parseGradient(input)!;

  it("parses", () => expect(spec).not.toBeNull());
  it("type", () => expect(spec.type).toBe("radial"));
  it("preserves the radial size", () => expect(spec.size).toBe("120% 80%"));
  it("position", () => expect([spec.posX, spec.posY]).toEqual([80, 0]));
  it("stops (normalised to hex)", () =>
    expect(spec.stops).toEqual([
      { color: "#f4eee4", pos: 0 },
      { color: "#faf8f4", pos: 60 },
    ]));
  it("serialises back to canonical CSS", () =>
    expect(gradientToCss(spec)).toBe(
      "radial-gradient(120% 80% at 80% 0%, #f4eee4 0%, #faf8f4 60%)",
    ));
  it("tolerates a trailing semicolon", () =>
    expect(parseGradient(input + ";")).toEqual(spec));
});

describe("parseGradient — linear", () => {
  it("explicit angle", () => {
    const s = parseGradient("linear-gradient(135deg, #ff0000 0%, #0000ff 100%)")!;
    expect(s.type).toBe("linear");
    expect(s.angle).toBe(135);
    expect(gradientToCss(s)).toBe("linear-gradient(135deg, #ff0000 0%, #0000ff 100%)");
  });
  it("`to right` maps to 90deg", () => {
    const s = parseGradient("linear-gradient(to right, #fff, #000)")!;
    expect(s.angle).toBe(90);
    // no explicit stop positions → evenly distributed
    expect(s.stops.map((x) => x.pos)).toEqual([0, 100]);
  });
  it("`to top left` maps to 315deg", () =>
    expect(parseGradient("linear-gradient(to top left, #fff, #000)")!.angle).toBe(315));
  it("no angle defaults to 180deg", () => {
    const s = parseGradient("linear-gradient(#ffffff, #000000)")!;
    expect(s.angle).toBe(180);
    expect(gradientToCss(s)).toBe("linear-gradient(180deg, #ffffff 0%, #000000 100%)");
  });
  it("three stops", () => {
    const s = parseGradient("linear-gradient(90deg, red 0%, lime 50%, blue 100%)")!;
    expect(s.stops).toEqual([
      { color: "#ff0000", pos: 0 },
      { color: "#00ff00", pos: 50 },
      { color: "#0000ff", pos: 100 },
    ]);
  });
  it("preserves a translucent stop", () => {
    const s = parseGradient("linear-gradient(90deg, rgba(0,0,0,0) 0%, #000 100%)")!;
    expect(s.stops[0]!.color).toBe("#00000000");
  });
  it("modern rgb stops with slash-alpha", () => {
    const s = parseGradient("linear-gradient(90deg, rgb(255 0 0 / 50%) 0%, #0000ff 100%)")!;
    expect(s.stops[0]!.color).toBe("#ff000080");
  });
});

describe("parseGradient — conic", () => {
  it("from-angle + position round-trips", () => {
    const s = parseGradient("conic-gradient(from 90deg at 25% 75%, #ff0000, #0000ff)")!;
    expect(s.type).toBe("conic");
    expect(s.angle).toBe(90);
    expect([s.posX, s.posY]).toEqual([25, 75]);
    expect(gradientToCss(s)).toBe(
      "conic-gradient(from 90deg at 25% 75%, #ff0000 0%, #0000ff 100%)",
    );
  });
});

describe("parseGradient — rejects non-gradients & malformed", () => {
  it.each(["#ffffff", "red", "rgb(0,0,0)", "", "not-a-gradient(x)"])(
    "null for %s",
    (v) => expect(parseGradient(v)).toBeNull(),
  );
  it("a single stop is not a gradient", () =>
    expect(parseGradient("linear-gradient(#fff)")).toBeNull());
});

/* ── stopsToBarCss & colorAt ───────────────────────────────────────── */

describe("stopsToBarCss", () => {
  it("ramps left→right regardless of the gradient's real angle", () => {
    expect(
      stopsToBarCss([
        { color: "#000000", pos: 0 },
        { color: "#ffffff", pos: 100 },
      ]),
    ).toBe("linear-gradient(90deg, #000000 0%, #ffffff 100%)");
  });
  it("sorts stops by position", () => {
    expect(
      stopsToBarCss([
        { color: "#ffffff", pos: 100 },
        { color: "#000000", pos: 0 },
      ]),
    ).toBe("linear-gradient(90deg, #000000 0%, #ffffff 100%)");
  });
});

describe("colorAt", () => {
  const stops = [
    { color: "#000000", pos: 0 },
    { color: "#ffffff", pos: 100 },
  ];
  it("returns the endpoint colour at the ends", () => {
    expect(colorAt(stops, 0)).toBe("#000000");
    expect(colorAt(stops, 100)).toBe("#ffffff");
  });
  it("interpolates to a mid-grey at 50%", () => {
    const mid = colorAt(stops, 50);
    expect(mid).toMatch(/^#[0-9a-f]{6}$/);
    // halfway between black and white in RGB space
    expect(mid).toBe("#808080");
  });
});
