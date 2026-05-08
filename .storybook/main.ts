import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepo = path.resolve(__dirname, "../../pitter-patter/packages");

// Force a single module instance per package. Yarn PnP + portal-linked
// workspaces resolve some packages through both the direct portal and
// a peer-dep "virtual" path, which makes Vite eval the module twice
// and produces duplicate `new PluginKey(name)` instances (visible as
// e.g. `presence$1` instead of `presence$`). Aliasing every pitter-
// patter package's bare specifier to one absolute file path forces a
// single instance. Use a regex anchored to the exact specifier so
// deeper imports like `@pitter-patter/presence-client/styles.css`
// still resolve through PnP.
const aliases = [
  "collab-client",
  "comments-client",
  "presence-client",
  "version-history-client",
  "refs",
].map((pkg) => ({
  find: new RegExp(`^@pitter-patter/${pkg}$`),
  replacement: path.join(monorepo, pkg, "src/index.ts"),
}));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    reactDocgen: false,
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    const existing = config.resolve.alias;
    const existingArray = Array.isArray(existing)
      ? existing
      : existing
        ? Object.entries(existing).map(([find, replacement]) => ({
            find,
            replacement: replacement as string,
          }))
        : [];
    config.resolve.alias = [...existingArray, ...aliases];
    config.resolve.dedupe = [
      ...(config.resolve.dedupe ?? []),
      "@stepwisehq/prosemirror-collab-commit",
      "prosemirror-state",
      "prosemirror-model",
      "prosemirror-view",
      "prosemirror-transform",
    ];
    return config;
  },
};

export default config;
