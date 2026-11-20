import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const buildDir = fileURLToPath(new URL("../build/", import.meta.url));
const outputFile = fileURLToPath(new URL("../snapstock-mcp.mcpb", import.meta.url));
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const manifest = {
  manifest_version: "0.3",
  name: "snapstock-mcp",
  display_name: "Snapstock Dividend Safety",
  version: pkg.version,
  description:
    "Dividend safety scores, red flags, and dividend history for 1,912 US-listed dividend payers.",
  long_description:
    "Read-only local MCP server for Snapstock's free dividend safety dataset. Six tools expose " +
    "0-10 scores, red flags, payout ratios, streaks, annual dividend history, ticker search, and " +
    "threshold screening. The bundle includes the 2026-11-15 snapshot; no API key and no network " +
    "calls. Scores are research aids, not investment advice. Data is CC BY 4.0; code is MIT.",
  author: {
    name: "Snapstock team",
    url: "https://learn.snapstock.app/"
  },
  repository: {
    type: "git",
    url: "https://github.com/sorndotdev/snapstock-mcp.git"
  },
  homepage: "https://learn.snapstock.app/data/dividend-safety/",
  documentation: "https://github.com/sorndotdev/snapstock-mcp#readme",
  support: "https://github.com/sorndotdev/snapstock-mcp/issues",
  license: "MIT",
  keywords: ["dividends", "dividend-safety", "finance", "stock-data", "investing"],
  server: {
    type: "node",
    entry_point: "server/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/server/index.js"]
    }
  }
};

await rm(buildDir, { recursive: true, force: true });
await mkdir(new URL("server/", `file://${buildDir}`), { recursive: true });
await mkdir(new URL("data/", `file://${buildDir}`), { recursive: true });

await build({
  entryPoints: [new URL("../src/index.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: new URL("server/index.js", `file://${buildDir}`).pathname,
  legalComments: "none",
  logLevel: "info"
});

await cp(
  new URL("../data/dividend-safety.csv", import.meta.url),
  new URL("data/dividend-safety.csv", `file://${buildDir}`)
);
await cp(new URL("../README.md", import.meta.url), new URL("README.md", `file://${buildDir}`));
await cp(new URL("../LICENSE", import.meta.url), new URL("LICENSE", `file://${buildDir}`));
await cp(
  new URL("../DATA-LICENSE.md", import.meta.url),
  new URL("DATA-LICENSE.md", `file://${buildDir}`)
);
await writeFile(
  new URL("package.json", `file://${buildDir}`),
  JSON.stringify({ name: pkg.name, version: pkg.version, type: "module", private: true }, null, 2) + "\n"
);
await writeFile(
  new URL("manifest.json", `file://${buildDir}`),
  JSON.stringify(manifest, null, 2) + "\n"
);

await rm(outputFile, { force: true });
execFileSync(
  new URL("../node_modules/.bin/mcpb", import.meta.url).pathname,
  ["pack", buildDir, outputFile],
  { stdio: "inherit" }
);

console.log(`Built ${outputFile}`);
