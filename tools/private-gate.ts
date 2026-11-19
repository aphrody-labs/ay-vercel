#!/usr/bin/env bun
// Privacy & secret gate for tracked files in ay-vercel (STANDARD.md section 2).
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface Leak {
  file: string;
  line: number;
  why: string;
}

const SKIP =
  /(^|\/)(bun\.lock|Cargo\.lock|uv\.lock|node_modules|target)(\/|$)|\/(test|fixtures)\/|\.(test\.ts|svg|png|jpg|woff2?|wasm|lock)$/;
const IPV4 =
  /\b(?!127\.|0\.0\.0\.0|1\.1\.1\.1|1\.0\.0\.1|8\.8\.8\.8|8\.8\.4\.4|255\.|10\.0\.0\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/;

const DEFAULT_PATTERNS: [string, RegExp][] = [
  ["Windows user profile path", /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/],
  ["POSIX home directory path", /(^|[\s"'`(=])\/home\/[a-z][a-z0-9_-]{1,}\//],
  ["Private API token / secret prefix", /\b(?:ghp_|gho_|github_pat_|vcp_[A-Za-z0-9]{12,}|vercel_oidc_|sk-[A-Za-z0-9]{20,})\S*/],
  [
    "Non-placeholder email address",
    /(?<![\w.+-])(?!(?:contact|security|noreply)@(?:aphrody\.com|aphrody\.app|vercel\.com)\b)[\w.+-]+@(?!users\.noreply\.github\.com|github\.com:|vercel\.com|example\.com|example\.org|yourdomain\.com|company\.com|app\.com)[\w-]+\.(com|net|org|fr|io|dev)\b/i,
  ],
];

const MIRRORED_DOCS = /^(?:skills\/(?!ay-vercel-)[^/]+|docs\/vercel|crates\/(?!vercel-|next-bun)[^/]+)\//;

export function scanFiles(files: Map<string, string>, extraLiterals: string[] = []): Leak[] {
  const leaks: Leak[] = [];
  const literalRes = extraLiterals
    .filter((s) => s.length >= 6 && !s.startsWith("<"))
    .map((s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

  for (const [file, text] of files) {
    if (SKIP.test(file) || file === "tools/private-gate.ts") continue;
    const isMirroredDoc = MIRRORED_DOCS.test(file);
    text.split(/\r?\n/).forEach((line, idx) => {
      for (const [why, re] of DEFAULT_PATTERNS) {
        if (isMirroredDoc && (why === "Non-placeholder email address" || why === "POSIX home directory path")) continue;
        if (re.test(line)) leaks.push({ file, line: idx + 1, why });
      }
      for (const re of literalRes) {
        if (re.test(line)) leaks.push({ file, line: idx + 1, why: "ay-vercel.local.toml private value" });
      }
      if (isMirroredDoc) return;
      const ip = IPV4.exec(line);
      if (
        ip &&
        !/version|v\d|\d+\.\d+\.\d+\.\d+[-.]\d|rustc|clang|llvm|Chrome/i.test(line) &&
        ip.slice(1).every((n) => Number(n) <= 255)
      ) {
        leaks.push({ file, line: idx + 1, why: "Non-reserved IPv4 address" });
      }
    });
  }
  return leaks;
}

export function loadLocalLiterals(root: string): string[] {
  const localFile = join(root, "ay-vercel.local.toml");
  if (!existsSync(localFile)) return [];
  try {
    const parsed = Bun.TOML.parse(readFileSync(localFile, "utf8")) as Record<string, unknown>;
    const vals: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === "string") vals.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(parsed.vercel);
    return vals;
  } catch {
    return [];
  }
}

export async function readWorkingTreeFiles(root: string): Promise<Map<string, string>> {
  const proc = Bun.spawn(["git", "-C", root, "ls-files", "-co", "--exclude-standard", "-z"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const names = (await new Response(proc.stdout).text()).split("\0").filter(Boolean);
  const files = new Map<string, string>();
  for (const name of names) {
    const full = join(root, name);
    if (SKIP.test(name) || !existsSync(full)) continue;
    const text = await Bun.file(full).text().catch(() => "");
    if (!text.includes("\0")) files.set(name, text);
  }
  return files;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const files = await readWorkingTreeFiles(root);
  const extra = loadLocalLiterals(root);
  const leaks = scanFiles(files, extra);
  for (const l of leaks.slice(0, 60)) console.error(`${l.file}:${l.line}: ${l.why}`);
  console.log(
    leaks.length
      ? `${leaks.length} private leak(s) detected`
      : `private-gate OK (${files.size} tracked/unignored files scanned, 0 leaks)`,
  );
  process.exit(leaks.length ? 1 : 0);
}
