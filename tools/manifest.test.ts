import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseManifest, renderGitmodules } from "./lib/manifest.ts";
import { scanFiles } from "./private-gate.ts";

const root = resolve(import.meta.dir, "..");

describe("ay-vercel manifests & gates", () => {
  test("forks.toml renders relative ../<name>.git .gitmodules URLs", () => {
    const raw = readFileSync(resolve(root, "forks.toml"), "utf8");
    const m = parseManifest(raw);
    expect(m.forks.length).toBeGreaterThanOrEqual(270);
    const gm = renderGitmodules(m);
    expect(gm).toContain("url = ../next.js.git");
    expect(gm).toContain("url = ../vercel-plugin.git");
    expect(gm).toContain("url = ../next-devtools-mcp.git");
    expect(gm).toContain("url = ../vercel-ui.git");
    expect(gm).toContain("url = ../tsc-ts.git");
    expect(gm).toContain("url = ../scriptc.git");
  });

  test("private-gate detects leaked tokens, home paths, emails, and IPs", () => {
    const leaks = scanFiles(
      new Map([
        [
          "sample.txt",
          "host = 203.111.22.33\npath = /home/alice/key\nemail = alice@example.com\ntoken = ghp_1234567890abcdef123456",
        ],
      ]),
    );
    expect(leaks.length).toBeGreaterThanOrEqual(3);
  });
});
