#!/usr/bin/env bun
// Mirrors core official Vercel documentation pages via `vercel docs inspect` / vercel.com into docs/vercel/.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const outDir = join(root, "docs/vercel");

export const DOC_PAGES = [
  "getting-started-with-vercel",
  "agent-resources",
  "agent-resources/vercel-plugin",
  "agent-resources/vercel-mcp",
  "agent-resources/vercel-mcp/tools",
  "agent-resources/skills",
  "cli",
  "cli/mcp",
  "cli/skills",
  "cli/setup",
  "cli/deploy",
  "cli/env",
  "cli/docs",
  "mcp",
  "mcp/deploy-mcp-servers-to-vercel",
  "functions",
  "fluid-compute",
  "sandbox",
  "ai-gateway",
  "workflow",
  "flags",
  "vercel-ci",
] as const;

export interface DocManifestEntry {
  page: string;
  file: string;
  sha256: string;
  bytes: number;
}

function sha256Hex(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

function stripCliBanner(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^Vercel CLI [^\n]*\n/, "")
    .trimStart();
}

async function fetchDocPage(page: string): Promise<string> {
  const proc = Bun.spawn(["vercel", "docs", "inspect", page], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code === 0 && out.trim().length > 40) return stripCliBanner(out);
  const res = await fetch(`https://vercel.com/docs/${page}.md`);
  if (!res.ok) throw new Error(`failed to fetch doc ${page}: ${err.trim() || res.status}`);
  return stripCliBanner(await res.text());
}

if (import.meta.main) {
  const checkOnly = Bun.argv.includes("--check");
  const manifestPath = join(outDir, "MANIFEST.json");

  if (checkOnly) {
    if (!existsSync(manifestPath)) throw new Error("Missing docs/vercel/MANIFEST.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { pages: DocManifestEntry[] };
    for (const p of manifest.pages) {
      const full = join(root, p.file);
      if (!existsSync(full)) throw new Error(`Missing doc file ${p.file}`);
      if (sha256Hex(readFileSync(full, "utf8")) !== p.sha256) {
        throw new Error(`SHA-256 mismatch on ${p.file}`);
      }
    }
    console.log(`docs-sync check OK (${manifest.pages.length} official Vercel docs pages verified)`);
    process.exit(0);
  }

  mkdirSync(outDir, { recursive: true });
  const taxRes = await fetch("https://vercel.com/docs/taxonomy.json");
  if (taxRes.ok) {
    await Bun.write(join(outDir, "taxonomy.json"), await taxRes.text());
  }

  const entries: DocManifestEntry[] = [];
  for (const page of DOC_PAGES) {
    try {
      const content = await fetchDocPage(page);
      const rel = `docs/vercel/${page}.md`;
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      await Bun.write(full, content.endsWith("\n") ? content : content + "\n");
      const finalRaw = readFileSync(full, "utf8");
      entries.push({
        page,
        file: rel,
        sha256: sha256Hex(finalRaw),
        bytes: new TextEncoder().encode(finalRaw).byteLength,
      });
      console.log(`synced ${rel} (${Math.round(finalRaw.length / 1024)} KB)`);
    } catch (err) {
      console.error(`WARN doc ${page}: ${(err as Error).message}`);
    }
  }

  await Bun.write(
    manifestPath,
    JSON.stringify({ generated_at: new Date().toISOString(), total: entries.length, pages: entries }, null, 2) + "\n",
  );
  console.log(`Generated docs/vercel/MANIFEST.json (${entries.length} pages)`);
}
