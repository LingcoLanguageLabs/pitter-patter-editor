import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import { transformWithOxc } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepo = path.resolve(__dirname, "../../pitter-patter/packages");
const builtRoot = path.resolve(__dirname, "../node_modules/.cache/portal-deps");

// oxc transpiles `foo.ts` → `foo.js` on disk but leaves the import specifier
// text untouched, so an `export ... from "./plugin.ts"` ends up pointing at a
// file that no longer exists. The monorepo relies on tsc's
// `rewriteRelativeImportExtensions` to fix this at emit time; since we bypass
// tsc here, mirror that behaviour and rewrite relative .ts/.tsx specifiers
// (in `import`/`export ... from` and dynamic `import()`) to .js.
function rewriteRelativeTsExtensions(code: string): string {
  return code.replace(
    /((?:\bfrom|\bimport)\s*\(?\s*)(["'])(\.{1,2}\/[^"']*?)\.tsx?(["'])/g,
    (_match, prefix, open, spec, close) => `${prefix}${open}${spec}.js${close}`,
  );
}

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
    const outCode = rewriteRelativeTsExtensions(result.code);
    await fs.writeFile(outFile, `${outCode}\n//# sourceMappingURL=${mapName}\n`);
    if (result.map) await fs.writeFile(outFile + ".map", JSON.stringify(result.map));
  }
}

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
