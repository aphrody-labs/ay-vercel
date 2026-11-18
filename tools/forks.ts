#!/usr/bin/env bun
// Audits forks.toml against live aphrody-labs repositories, creates/hardens missing forks (--ensure), and hardens existing forks (--harden).
import { resolve } from "node:path";
import { ghCli } from "./lib/gh.ts";
import { loadManifest, type Fork } from "./lib/manifest.ts";

const argv = Bun.argv.slice(2);
const manifestPath = resolve(argv.find((_, i) => argv[i - 1] === "--manifest") ?? "forks.toml");
const ensure = argv.includes("--ensure");
const harden = argv.includes("--harden") || ensure;
const checkOnly = argv.includes("--check");
const m = await loadManifest(manifestPath);

if (checkOnly) {
  console.log(`forks.toml valid: ${m.forks.length} forks across ${Object.keys(m.groups).length} groups`);
  process.exit(0);
}

const tokenProc = Bun.spawnSync(["gh", "auth", "token"], { stdout: "pipe", stderr: "pipe" });
if (tokenProc.exitCode !== 0 && !Bun.env.GH_TOKEN && !Bun.env.GITHUB_TOKEN) {
  console.error("gh auth token unavailable");
  process.exit(1);
}

const gh = ghCli();

async function hardenFork(f: Fork): Promise<void> {
  await gh.request("PATCH", `repos/${m.org}/${f.name}`, {
    has_issues: false,
    has_wiki: false,
    has_projects: false,
  });
  await gh.request("PUT", `repos/${m.org}/${f.name}/actions/permissions`, {
    enabled: false,
  });
}

const present: Array<{ fork: Fork; json: Record<string, any> }> = [];
const missing: Fork[] = [];
let idx = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (idx < m.forks.length) {
      const f = m.forks[idx++]!;
      const r = await gh.request("GET", `repos/${m.org}/${f.name}`);
      if (r.status === 404) {
        missing.push(f);
      } else if (r.status === 200) {
        present.push({ fork: f, json: (r.json ?? {}) as Record<string, any> });
      } else {
        console.error(`unexpected HTTP ${r.status} for ${m.org}/${f.name}`);
        process.exit(1);
      }
    }
  }),
);

console.log(`${m.forks.length} forks in manifest, ${present.length} present, ${missing.length} missing`);
if (!ensure && !harden) process.exit(missing.length ? 1 : 0);

let hardenedExisting = 0;
if (harden) {
  for (const { fork: f, json } of present) {
    if (json.has_issues || json.has_wiki || json.has_projects) {
      await hardenFork(f);
      hardenedExisting++;
    }
  }
  if (hardenedExisting) console.log(`hardened ${hardenedExisting} existing fork(s)`);
}

if (!ensure) process.exit(missing.length ? 1 : 0);

let failed = 0;
for (const f of missing) {
  let ok = false;
  let lastErr = "";
  for (let attempt = 0; attempt < 5 && !ok; attempt++) {
    const res = await gh.request("POST", `repos/${f.upstream}/forks`, {
      organization: m.org,
      name: f.name,
      default_branch_only: true,
    });
    if (res.status === 200 || res.status === 201 || res.status === 202) {
      ok = true;
      break;
    }
    const p = Bun.spawnSync(
      ["gh", "repo", "fork", f.upstream, "--org", m.org, "--fork-name", f.name, "--clone=false"],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (p.exitCode === 0) {
      ok = true;
      break;
    }
    const check = await gh.request("GET", `repos/${m.org}/${f.name}`);
    if (check.status === 200) {
      ok = true;
      break;
    }
    lastErr = p.stderr.toString().trim().slice(0, 140) || `HTTP ${res.status}`;
    if (/too quickly|being forked|rate limit/i.test(lastErr)) {
      await Bun.sleep(20_000 * (attempt + 1));
    } else {
      break;
    }
  }
  if (!ok) {
    failed++;
    console.error(`FAILED ${f.upstream} -> ${m.org}/${f.name}: ${lastErr}`);
    continue;
  }
  // Wait briefly for GitHub async fork creation before patching repo/actions settings.
  for (let w = 0; w < 6; w++) {
    const check = await gh.request("GET", `repos/${m.org}/${f.name}`);
    if (check.status === 200) break;
    await Bun.sleep(1500);
  }
  await hardenFork(f);
  console.log(`forked & hardened ${f.upstream} -> ${m.org}/${f.name}`);
  await Bun.sleep(3000);
}

process.exit(failed ? 1 : 0);
