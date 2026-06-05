import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import { transformWithOxc } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepo = path.resolve(__dirname, "../../pitter-patter/packages");
const builtRoot = path.resolve(__dirname, "../node_modules/.cache/portal-deps");

// The portal-linked `*-client` packages can't be consumed from source: their
// tsconfigs have `references` arrays, and vite:oxc's tsconfig auto-discovery
// chokes on the referenced projects because PnP isn't active outside the
// editor root. None of these packages are on npm yet, so we pre-transpile
// their src trees to a local cache and alias to the built output.
const portalPackages = [
  "collab-client",
  "comments-client",
  "presence-client",
  "version-history-client",
] as const;

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else files.push(full);
  }
  return files;
}

async function buildPortalPackage(pkg: string) {
  const srcDir = path.join(monorepo, pkg, "src");
  const outDir = path.join(builtRoot, pkg);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const files = await walk(srcDir);
  for (const file of files) {
    const rel = path.relative(srcDir, file);
    const isTsx = file.endsWith(".tsx");
    const isTs = file.endsWith(".ts");
    if (!isTs && !isTsx) {
      const dest = path.join(outDir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(file, dest);
      continue;
    }
    const code = await fs.readFile(file, "utf8");
    const outFile = path.join(outDir, rel.replace(/\.tsx?$/, ".js"));
    const result = await transformWithOxc(code, file, {
      jsx: { runtime: "automatic", importSource: "react" },
      tsconfig: false,
      sourcemap: true,
      lang: isTsx ? "tsx" : "ts",
    } as Parameters<typeof transformWithOxc>[2]);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    const mapName = path.basename(outFile) + ".map";
    await fs.writeFile(outFile, `${result.code}\n//# sourceMappingURL=${mapName}\n`);
    if (result.map) await fs.writeFile(outFile + ".map", JSON.stringify(result.map));
  }
}

async function buildAllPortalPackages() {
  await Promise.all(portalPackages.map(buildPortalPackage));
}

// Force a single module instance per package. Yarn PnP + portal-linked
// workspaces resolve some packages through both the direct portal and
// a peer-dep "virtual" path, which makes Vite eval the module twice
// and produces duplicate `new PluginKey(name)` instances (visible as
// e.g. `presence$1` instead of `presence$`). Aliasing every pitter-
// patter package's bare specifier to one absolute file path forces a
// single instance. Use a regex anchored to the exact specifier so
// deeper imports like `@pitter-patter/presence-client/styles.css`
// still resolve through PnP.
const aliases = portalPackages.map((pkg) => ({
  find: new RegExp(`^@pitter-patter/${pkg}$`),
  replacement: path.join(builtRoot, pkg, "index.js"),
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
    await buildAllPortalPackages();

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
      "@handlewithcare/react-prosemirror",
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
