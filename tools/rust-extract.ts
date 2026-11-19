#!/usr/bin/env bun
// Extract and de-workspace official Vercel, Next.js, Turbopack, and Turborepo Rust crates
// into a single unified crates.io-ready Cargo workspace under crates/*.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface UpstreamCrate {
  pkgName: string;
  folderName: string;
  srcDir: string;
  toml: Record<string, any>;
  wsDeps: Record<string, any>;
  wsPkg: Record<string, any>;
  originRepo: string;
}

const NEXT_SEEDS = [
  "next-code-frame",
  "next-taskless",
  "turbo-tasks",
  "turbo-tasks-backend",
  "turbo-persistence",
  "turbo-tasks-bytes",
  "turbo-rcstr",
  "turbo-frozenmap",
  "turbo-prehash",
  "turbo-dyn-eq-hash",
  "turbo-tasks-malloc",
];

const TURBO_SEEDS = [
  "turborepo-ai-agents",
  "turborepo-ci",
  "turborepo-dirs",
  "turborepo-errors",
  "turborepo-fixed-map",
  "turborepo-graph-utils",
  "turborepo-json-rewrite",
  "turborepo-lockfile-hash",
  "turborepo-log",
  "turborepo-package-manager",
  "turbopath",
  "turborepo-platform",
  "turborepo-repository",
  "turborepo-task-id",
  "turborepo-trace-core",
  "turborepo-trace-lang-js",
  "turborepo-trace-lang-rust",
  "turborepo-trace-lockfile",
  "turborepo-unescape",
];

function loadUpstreamPool(root: string, repoRel: string, subdirs: string[], originRepo: string) {
  const repoDir = join(root, repoRel);
  const rootToml = Bun.TOML.parse(readFileSync(join(repoDir, "Cargo.toml"), "utf8")) as Record<string, any>;
  const wsDeps = (rootToml.workspace?.dependencies ?? {}) as Record<string, any>;
  const wsPkg = (rootToml.workspace?.package ?? {}) as Record<string, any>;
  const map = new Map<string, UpstreamCrate>();

  for (const sub of subdirs) {
    const base = join(repoDir, sub);
    if (!existsSync(base)) continue;
    for (const ent of readdirSync(base, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const cargoPath = join(base, ent.name, "Cargo.toml");
      if (!existsSync(cargoPath)) continue;
      const toml = Bun.TOML.parse(readFileSync(cargoPath, "utf8")) as Record<string, any>;
      const pkgName = toml.package?.name as string | undefined;
      if (!pkgName) continue;
      map.set(pkgName, {
        pkgName,
        folderName: ent.name,
        srcDir: join(base, ent.name),
        toml,
        wsDeps,
        wsPkg,
        originRepo,
      });
    }
  }
  return map;
}

function collectClosure(seeds: string[], pool: Map<string, UpstreamCrate>): UpstreamCrate[] {
  const seen = new Map<string, UpstreamCrate>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    const crate = pool.get(cur);
    if (!crate) throw new Error(`Missing upstream crate in closure: ${cur}`);
    seen.set(cur, crate);

    for (const sec of ["dependencies", "build-dependencies"]) {
      const deps = (crate.toml[sec] ?? {}) as Record<string, any>;
      for (const [depKey, spec] of Object.entries(deps)) {
        const pkg = typeof spec === "object" && spec?.package ? String(spec.package) : depKey;
        if (pool.has(pkg) && !seen.has(pkg)) queue.push(pkg);
      }
    }
    if (crate.toml.target && typeof crate.toml.target === "object") {
      for (const tCfg of Object.values(crate.toml.target as Record<string, any>)) {
        for (const sec of ["dependencies", "build-dependencies"]) {
          const deps = (tCfg?.[sec] ?? {}) as Record<string, any>;
          for (const [depKey, spec] of Object.entries(deps)) {
            const pkg = typeof spec === "object" && spec?.package ? String(spec.package) : depKey;
            if (pool.has(pkg) && !seen.has(pkg)) queue.push(pkg);
          }
        }
      }
    }
  }
  return [...seen.values()];
}

function tomlValue(v: any): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return `[${v.map(tomlValue).join(", ")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v)
      .filter(([, val]) => val !== undefined)
      .map(([k, val]) => `${/^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k)} = ${tomlValue(val)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(String(v));
}

function resolveDepSpec(
  depKey: string,
  rawSpec: any,
  wsDeps: Record<string, any>,
  extractedByPkg: Map<string, UpstreamCrate>,
): any {
  const pkgName = typeof rawSpec === "object" && rawSpec?.package ? String(rawSpec.package) : depKey;
  const localTarget = extractedByPkg.get(pkgName);

  if (typeof rawSpec === "string") {
    if (localTarget) {
      return { path: `../${localTarget.folderName}`, version: localTarget.toml.package?.version ?? "0.1.0" };
    }
    return rawSpec;
  }

  const spec = { ...rawSpec };
  if (spec.workspace) {
    delete spec.workspace;
    const base = wsDeps[depKey] ?? wsDeps[pkgName];
    if (base === undefined) {
      throw new Error(`Cannot resolve workspace dep '${depKey}' (pkg '${pkgName}')`);
    }
    if (typeof base === "string") {
      spec.version = base;
    } else if (base && typeof base === "object") {
      const merged: Record<string, any> = { ...base };
      delete merged.path;
      if (Array.isArray(base.features) && Array.isArray(spec.features)) {
        merged.features = [...new Set([...base.features, ...spec.features])];
      } else if (Array.isArray(spec.features)) {
        merged.features = spec.features;
      }
      if (spec.optional !== undefined) merged.optional = spec.optional;
      if (spec["default-features"] !== undefined) merged["default-features"] = spec["default-features"];
      if (spec.package !== undefined) merged.package = spec.package;
      Object.assign(spec, merged);
    }
  }

  if (localTarget) {
    delete spec.git;
    delete spec.branch;
    delete spec.rev;
    spec.path = `../${localTarget.folderName}`;
    spec.version = localTarget.toml.package?.version ?? "0.1.0";
  } else if (spec.path) {
    throw new Error(`Unextracted path dependency '${depKey}' -> ${spec.path}`);
  }

  return spec;
}

function renderExtractedCargoToml(
  crate: UpstreamCrate,
  extractedByPkg: Map<string, UpstreamCrate>,
): string {
  const pkg = crate.toml.package ?? {};
  const version = typeof pkg.version === "string" ? pkg.version : (crate.wsPkg.version ?? "0.1.0");
  const license = typeof pkg.license === "string" ? pkg.license : (crate.wsPkg.license ?? "Apache-2.0");
  const desc =
    typeof pkg.description === "string" && pkg.description !== "TBD" && pkg.description.trim().length > 0
      ? pkg.description
      : `${crate.pkgName} extracted from ${crate.originRepo} for the unified Rust + Bun Vercel workspace`;

  const lines: string[] = [
    "# Generated by `bun tools/rust-extract.ts` — crates.io-ready unified workspace member.",
    "[package]",
    `name = ${JSON.stringify(crate.pkgName)}`,
    `version = ${JSON.stringify(version)}`,
    `edition = "2024"`,
    `license = ${JSON.stringify(license)}`,
    `description = ${JSON.stringify(desc)}`,
    `repository = "https://github.com/aphrody-labs/ay-vercel"`,
    `autobenches = false`,
    `autotests = false`,
  ];
  if (typeof pkg.links === "string") lines.push(`links = ${JSON.stringify(pkg.links)}`);
  if (typeof pkg.build === "string") lines.push(`build = ${JSON.stringify(pkg.build)}`);
  if (pkg.build === false) lines.push(`build = false`);

  if (crate.toml.lib) {
    const lib = { ...crate.toml.lib, bench: false };
    lines.push("", "[lib]");
    for (const [k, v] of Object.entries(lib)) {
      lines.push(`${k} = ${tomlValue(v)}`);
    }
  }

  if (Array.isArray(crate.toml.bin)) {
    for (const b of crate.toml.bin) {
      lines.push("", "[[bin]]");
      for (const [k, v] of Object.entries(b)) {
        if (k === "bench") continue;
        lines.push(`${k} = ${tomlValue(v)}`);
      }
      lines.push("bench = false");
    }
  }

  if (crate.toml.features && Object.keys(crate.toml.features).length > 0) {
    lines.push("", "[features]");
    for (const [k, v] of Object.entries(crate.toml.features)) {
      lines.push(`${/^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k)} = ${tomlValue(v)}`);
    }
  }

  for (const sec of ["dependencies", "build-dependencies"]) {
    const rawDeps = crate.toml[sec] as Record<string, any> | undefined;
    if (!rawDeps || Object.keys(rawDeps).length === 0) continue;
    lines.push("", `[${sec}]`);
    for (const [depKey, rawSpec] of Object.entries(rawDeps)) {
      const resolved = resolveDepSpec(depKey, rawSpec, crate.wsDeps, extractedByPkg);
      const keyFmt = /^[A-Za-z0-9_-]+$/.test(depKey) ? depKey : JSON.stringify(depKey);
      lines.push(`${keyFmt} = ${tomlValue(resolved)}`);
    }
  }

  if (crate.toml.target && typeof crate.toml.target === "object") {
    for (const [targetExpr, tCfg] of Object.entries(crate.toml.target as Record<string, any>)) {
      for (const sec of ["dependencies", "build-dependencies"]) {
        const rawDeps = tCfg?.[sec] as Record<string, any> | undefined;
        if (!rawDeps || Object.keys(rawDeps).length === 0) continue;
        lines.push("", `[target.${JSON.stringify(targetExpr)}.${sec}]`);
        for (const [depKey, rawSpec] of Object.entries(rawDeps)) {
          const resolved = resolveDepSpec(depKey, rawSpec, crate.wsDeps, extractedByPkg);
          const keyFmt = /^[A-Za-z0-9_-]+$/.test(depKey) ? depKey : JSON.stringify(depKey);
          lines.push(`${keyFmt} = ${tomlValue(resolved)}`);
        }
      }
    }
  }

  lines.push("", "[lints]", "workspace = true", "");
  return lines.join("\n");
}

function copyCrateTree(srcDir: string, dstDir: string) {
  rmSync(dstDir, { recursive: true, force: true });
  mkdirSync(dstDir, { recursive: true });
  for (const ent of readdirSync(srcDir, { withFileTypes: true })) {
    if (ent.name === "Cargo.toml" || ent.name === "target" || ent.name === "benches" || ent.name === "fuzz") {
      continue;
    }
    // Skip external integration `tests/` dirs in upstream crates that rely on monorepo-wide fixtures
    if (ent.name === "tests") continue;
    cpSync(join(srcDir, ent.name), join(dstDir, ent.name), { recursive: true });
  }
}

const root = resolve(import.meta.dir, "..");
const nextPool = loadUpstreamPool(root, "frameworks/next.js", ["crates", "turbopack/crates"], "vercel/next.js");
const turboPool = loadUpstreamPool(root, "sdk/turborepo", ["crates"], "vercel/turborepo");
const vercelPool = loadUpstreamPool(root, "sdk/vercel", ["crates"], "vercel/vercel");

const extracted: UpstreamCrate[] = [
  ...collectClosure(["vercel_runtime"], vercelPool),
  ...collectClosure(NEXT_SEEDS, nextPool),
  ...collectClosure(TURBO_SEEDS, turboPool),
];

const extractedByPkg = new Map<string, UpstreamCrate>();
for (const c of extracted) {
  if (extractedByPkg.has(c.pkgName)) {
    throw new Error(`Duplicate package name across upstreams: ${c.pkgName}`);
  }
  extractedByPkg.set(c.pkgName, c);
}

const cratesRoot = join(root, "crates");
mkdirSync(cratesRoot, { recursive: true });

// Remove legacy ay-vercel-* crates if present
for (const legacy of ["ay-vercel-manifest", "ay-vercel-skills", "ay-vercel-function", "ay-vercel-next"]) {
  rmSync(join(cratesRoot, legacy), { recursive: true, force: true });
}

for (const c of extracted) {
  const dst = join(cratesRoot, c.folderName);
  copyCrateTree(c.srcDir, dst);
  writeFileSync(join(dst, "Cargo.toml"), renderExtractedCargoToml(c, extractedByPkg));
}

console.log(
  `Extracted ${extracted.length} official crates into crates/* (${extracted.map((c) => c.pkgName).sort().join(", ")})`,
);
