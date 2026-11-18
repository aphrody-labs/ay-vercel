#!/usr/bin/env bun
// Materializes forks.toml in ay-vercel: verifies/writes .gitmodules and 160000 gitlinks, and selectively shallow-clones requested submodules (--init).
import { dirname, resolve } from "node:path";
import { branchHead, ghCli, type Gh } from "./lib/gh.ts";
import { gitlinks, setGitlink } from "./lib/git.ts";
import { layoutProblems } from "./lib/inspect.ts";
import { loadManifest, renderGitmodules } from "./lib/manifest.ts";

export async function run(argv: string[], gh: Gh = ghCli()): Promise<number> {
  const manifestPath = resolve(argv.find((_, i) => argv[i - 1] === "--manifest") ?? "forks.toml");
  const root = dirname(manifestPath);
  const m = await loadManifest(manifestPath);
  const write = argv.includes("--write");
  const initIdx = argv.indexOf("--init");

  if (initIdx >= 0) {
    const targets = argv.slice(initIdx + 1).filter((a) => !a.startsWith("-"));
    if (!targets.length) {
      console.error("usage: bun tools/submodules.ts --init <path-or-group...>");
      return 2;
    }
    const matched = m.forks.filter((f) => targets.some((t) => f.path === t || f.group === t || f.name === t));
    if (!matched.length) {
      console.error(`no submodule matched: ${targets.join(", ")}`);
      return 2;
    }
    for (const f of matched) {
      const proc = Bun.spawnSync(
        ["git", "submodule", "update", "--init", "--depth=1", "--", f.path],
        { cwd: root, stdout: "inherit", stderr: "inherit" },
      );
      if (proc.exitCode !== 0) return proc.exitCode ?? 1;
    }
    return 0;
  }

  const gmPath = resolve(root, ".gitmodules");
  const want = renderGitmodules(m);
  const have = await Bun.file(gmPath).text().catch(() => "");
  const pins = await gitlinks(root);
  if (!write) {
    const problems = layoutProblems(m, have, pins);
    if (problems.length) {
      for (const p of problems) console.error(p);
      return 1;
    }
    console.log(`.gitmodules and ${pins.size} gitlink(s) match forks.toml`);
    return 0;
  }

  if (want !== have) await Bun.write(gmPath, want);
  const missing = m.forks.filter((f) => !pins.has(f.path));
  let idx = 0;
  const resolved: Array<{ path: string; sha: string }> = [];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (idx < missing.length) {
        const f = missing[idx++]!;
        const sha = await branchHead(gh, `${m.org}/${f.name}`, f.branch);
        if (!sha) throw new Error(`${m.org}/${f.name} has no branch ${f.branch}`);
        resolved.push({ path: f.path, sha });
      }
    }),
  );
  for (const r of resolved.sort((a, b) => a.path.localeCompare(b.path))) {
    await setGitlink(root, r.path, r.sha);
  }
  console.log(`pinned ${resolved.length} gitlink(s) across ${m.forks.length} forks`);
  return 0;
}

if (import.meta.main) {
  process.exit(await run(Bun.argv.slice(2)).catch((e) => (console.error((e as Error).message), 2)));
}
