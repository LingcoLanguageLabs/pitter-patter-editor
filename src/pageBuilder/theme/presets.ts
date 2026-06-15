/**
 * Theme presets for the Design panel's "Themes" grid. Ported from pagy's
 * `src/editor/theme/presets.ts` (`THEME_PRESETS`), trimmed to the fields our
 * `Theme` carries (colors / fonts / buttons / inputs — pagy's `cards` and
 * `headingSize` are dropped). Every font here exists in our catalog
 * (`FONTS_DEFAULT` / `FONTS_PRO`), and the button/input token strings match
 * the vocabulary the Buttons / Inputs panels write, so clicking a tile applies
 * a coherent, fully-rendered theme.
 */

import type { Theme } from "./css";

export const THEME_PRESETS: Theme[] = [
  {
    colors: { background: "#ffffff", neutral: "#1a1b20", primary: "#3a69f3", secondary: "#f0f0f2", tertiary: "#f7f8f8" },
    fonts: { base: "Inter", heading: "Inter", headingWeight: "500" },
    buttons: { radius: "", style: "" },
    inputs: { shape: "radius-medium", style: "solid" },
  },
  {
    colors: { background: "#ffffff", neutral: "#020826", primary: "#f25042", secondary: "#eaddcf", tertiary: "#f9f4ef" },
    fonts: { base: "Instrument Sans", heading: "Instrument Sans", headingWeight: "500" },
    buttons: { radius: "medium", style: "" },
    inputs: { shape: "radius-small", style: "outline" },
  },
  {
    colors: { background: "#ffffff", neutral: "#040348", primary: "#fd2282", secondary: "#330099", tertiary: "#ffb800" },
    fonts: { base: "Clash Grotesk", heading: "Clash Display", headingWeight: "600" },
    buttons: { radius: "medium", style: "thick" },
    inputs: { shape: "radius-medium", style: "outline" },
  },
  {
    colors: { background: "#ffffff", neutral: "#094775", primary: "#2e8eec", secondary: "#eaa7fd", tertiary: "#f6ebf8" },
    fonts: { base: "Space Grotesk", heading: "Syne", headingWeight: "700" },
    buttons: { radius: "small", style: "sharp" },
    inputs: { shape: "radius-small", style: "solid" },
  },
  {
    colors: { background: "#ffffff", neutral: "#303f52", primary: "#ed8063", secondary: "#aa455b", tertiary: "#e7d6c4" },
    fonts: { base: "Karla", heading: "Inconsolata", headingWeight: "500" },
    buttons: { radius: "none", style: "" },
    inputs: { shape: "radius-none", style: "solid" },
  },
  {
    colors: { background: "#ffffff", neutral: "#00214d", primary: "#00ebc7", secondary: "#ff5470", tertiary: "#fde24f" },
    fonts: { base: "Bricolage Grotesque", heading: "Bricolage Grotesque", headingWeight: "600" },
    buttons: { radius: "small", style: "brutal" },
    inputs: { shape: "radius-small", style: "outline" },
  },
  {
    colors: { background: "#ffffff", neutral: "#023c40", primary: "#794ef2", secondary: "#ff7356", tertiary: "#f7d3ad" },
    fonts: { base: "Instrument Sans", heading: "Instrument Serif", headingWeight: "400" },
    buttons: { radius: "", style: "shadow" },
    inputs: { shape: "radius-medium", style: "solid" },
  },
  {
    colors: { background: "#ffffff", neutral: "#424330", primary: "#f2b717", secondary: "#aa5939", tertiary: "#dfd5bb" },
    fonts: { base: "Mona Sans", heading: "Fraunces", headingWeight: "300" },
    buttons: { radius: "small", style: "shadow" },
    inputs: { shape: "radius-small", style: "solid" },
  },
  {
    colors: { background: "#ffffff", neutral: "#220011", primary: "#006868", secondary: "#eba180", tertiary: "#eaeacf" },
    fonts: { base: "Libre Franklin", heading: "Playfair Display", headingWeight: "700" },
    buttons: { radius: "", style: "thick" },
    inputs: { shape: "radius-medium", style: "solid" },
  },
  {
    colors: { background: "#ffffff", neutral: "#1d2d5f", primary: "#f65e5d", secondary: "#ffbc47", tertiary: "#40cee3" },
    fonts: { base: "Archivo", heading: "Pilcrow Rounded", headingWeight: "900" },
    buttons: { radius: "small", style: "shadow" },
    inputs: { shape: "radius-small", style: "solid" },
  },
  {
    colors: { background: "#ffffff", neutral: "#2d4059", primary: "#ea5455", secondary: "#f07b3f", tertiary: "#ffd460" },
    fonts: { base: "Space Grotesk", heading: "Grandstander", headingWeight: "800" },
    buttons: { radius: "small", style: "sharp" },
    inputs: { shape: "radius-small", style: "outline" },
  },
  {
    colors: { background: "#ffffff", neutral: "#000000", primary: "#28e8ae", secondary: "#6e29ff", tertiary: "#ededed" },
    fonts: { base: "iA Writer Mono", heading: "Departure Mono", headingWeight: "400" },
    buttons: { radius: "none", style: "soft" },
    inputs: { shape: "line", style: "outline" },
  },
  {
    colors: { background: "#fafafa", neutral: "#222222", primary: "#000000", secondary: "#eeeeee", tertiary: "#f5f5f5" },
    fonts: { base: "Jet Brains Mono", heading: "Jet Brains Mono", headingWeight: "600" },
    buttons: { radius: "small", style: "soft" },
    inputs: { shape: "line", style: "solid" },
  },
  {
    colors: { background: "#f5f4ee", neutral: "#224b9b", primary: "#f37b6a", secondary: "#eab3ca", tertiary: "#fdd64d" },
    fonts: { base: "Supreme", heading: "Chubbo", headingWeight: "700" },
    buttons: { radius: "", style: "" },
    inputs: { shape: "radius-large", style: "outline" },
  },
  {
    colors: { background: "#08089b", neutral: "#ffffff", primary: "#dd0dcc", secondary: "#0aa67a", tertiary: "#1919a9" },
    fonts: { base: "Inter", heading: "Libre Caslon Condensed", headingWeight: "500" },
    buttons: { radius: "", style: "thick" },
    inputs: { shape: "radius-medium", style: "outline" },
  },
  {
    colors: { background: "#850e35", neutral: "#ffffff", primary: "#ee6983", secondary: "#ffc4c4", tertiary: "#fff5e4" },
    fonts: { base: "Source Sans", heading: "Oswald", headingWeight: "700" },
    buttons: { radius: "medium", style: "" },
    inputs: { shape: "radius-medium", style: "outline" },
  },
  {
    colors: { background: "#16161a", neutral: "#ffffff", primary: "#7f5af0", secondary: "#2cb67d", tertiary: "#252733" },
    fonts: { base: "Inter", heading: "Jet Brains Mono", headingWeight: "600" },
    buttons: { radius: "", style: "thick" },
    inputs: { shape: "radius-medium", style: "solid" },
  },
  {
    colors: { background: "#0f0e17", neutral: "#ffffff", primary: "#ff8906", secondary: "#f25f4c", tertiary: "#e53170" },
    fonts: { base: "IBM Plex Sans", heading: "IBM Plex Sans", headingWeight: "500" },
    buttons: { radius: "none", style: "" },
    inputs: { shape: "radius-none", style: "outline" },
  },
];
