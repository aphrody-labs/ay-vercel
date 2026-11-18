#!/usr/bin/env bun
// Fetches and merges all canonical Vercel & Vercel-Labs agent skills into skills/,
// maintains skills/REGISTRY.json, and generates .well-known/agent-skills/index.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const skillsDir = join(root, "skills");
const wellKnownDir = join(root, ".well-known/agent-skills");

export interface SkillIndexEntry {
  name: string;
  description: string;
  url: string;
  sha256: string;
  bytes: number;
}

export interface SkillProvenanceEntry {
  name: string;
  description: string;
  category: string;
  source_repo: string;
  source_path: string;
  local_path: string;
  sha256: string;
  bytes: number;
}

interface SkillSourceSpec {
  repo: string;
  category: string;
  /** Exact path prefixes inside the repo containing `<skill>/SKILL.md` or direct `SKILL.md`. */
  prefixes: string[];
  /** Optional explicit skill folder rename when root `SKILL.md`. */
  rootSkillName?: string;
}

export const SKILL_SOURCES: SkillSourceSpec[] = [
  { repo: "vercel/vercel-plugin", category: "platform", prefixes: ["skills/"] },
  { repo: "vercel-labs/agent-skills", category: "react-nextjs", prefixes: ["skills/"] },
  { repo: "vercel-labs/skills", category: "utility", prefixes: ["skills/"] },
  { repo: "vercel/vercel", category: "cli", prefixes: ["skills/"] },
  { repo: "vercel/next.js", category: "nextjs", prefixes: ["skills/"] },
  { repo: "vercel/ai", category: "ai-sdk", prefixes: ["skills/"] },
  { repo: "vercel/ai-elements", category: "ai-sdk", prefixes: ["skills/"] },
  { repo: "vercel/streamdown", category: "ai-sdk", prefixes: ["skills/"] },
  { repo: "vercel/turborepo", category: "monorepo", prefixes: ["skills/"] },
  { repo: "vercel/sandbox", category: "compute", prefixes: ["skills/"] },
  { repo: "vercel/workflow", category: "workflow", prefixes: ["skills/"] },
  { repo: "vercel/flags", category: "flags", prefixes: ["skills/"] },
  { repo: "vercel/chat", category: "chat-sdk", prefixes: ["skills/"] },
  { repo: "vercel/eve", category: "agents", prefixes: ["skills/"] },
  { repo: "vercel/microfrontends", category: "frameworks", prefixes: ["skills/"] },
  { repo: "vercel/next-forge", category: "frameworks", prefixes: ["skills/"] },
  { repo: "vercel/components.build", category: "ui", prefixes: ["skills/"] },
  { repo: "vercel/marketplace-skills", category: "marketplace", prefixes: ["skills/"] },
  { repo: "vercel/vercel-deploy-claude-code-plugin", category: "deploy", prefixes: ["skills/"] },
  { repo: "vercel/ci", category: "ci", prefixes: ["skills/"] },
  { repo: "vercel-labs/next-maintainer-skills", category: "nextjs", prefixes: ["skills/"] },
  { repo: "vercel-labs/migration-skills", category: "migration", prefixes: [""] },
  { repo: "vercel-labs/agentic-commerce-skills", category: "commerce", prefixes: [""] },
  { repo: "vercel-labs/vercel-kb-skills", category: "migration", prefixes: ["skills/"] },
  { repo: "vercel-labs/vercel-byoc", category: "infra", prefixes: ["skills/"] },
  { repo: "vercel-labs/vercel-deploy-codex-skill", category: "deploy", prefixes: ["skills/"] },
  { repo: "vercel-labs/slack-agent-skill", category: "agents", prefixes: [""], rootSkillName: "slack-agent-skill" },
  { repo: "vercel-labs/skill-remotion-geist", category: "design", prefixes: ["skills/"] },
  { repo: "vercel-labs/skill-geist-learning-labs", category: "design", prefixes: ["skills/"] },
  { repo: "vercel-labs/academy-skills", category: "academy", prefixes: ["skills/"] },
  { repo: "vercel-labs/agent-browser", category: "browser", prefixes: ["skill-data/"], rootSkillName: "agent-browser-core" },
  { repo: "vercel-labs/agent-desktop", category: "desktop", prefixes: ["skills/"] },
  { repo: "vercel-labs/ai-cli", category: "ai-sdk", prefixes: ["skills/"] },
  { repo: "vercel-labs/ai-python", category: "python", prefixes: ["skills/"] },
  { repo: "vercel-labs/autoship", category: "release", prefixes: ["skills/"] },
  { repo: "vercel-labs/before-and-after", category: "qa", prefixes: ["skill/"], rootSkillName: "before-and-after" },
  { repo: "vercel-labs/deepsec", category: "security", prefixes: ["packages/deepsec/"], rootSkillName: "deepsec" },
  { repo: "vercel-labs/dev3000", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/email-agent", category: "agents", prefixes: ["skills/"] },
  { repo: "vercel-labs/emulate", category: "testing", prefixes: ["skills/"] },
  { repo: "vercel-labs/error", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/fast-link", category: "nextjs", prefixes: ["skills/"] },
  { repo: "vercel-labs/issue-graph", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/json-render", category: "ui", prefixes: ["skills/"] },
  { repo: "vercel-labs/just-bash", category: "sandbox", prefixes: ["packages/just-bash-executor/"], rootSkillName: "just-bash-executor" },
  { repo: "vercel-labs/konsistent", category: "quality", prefixes: ["skills/"] },
  { repo: "vercel-labs/native", category: "native", prefixes: ["skills/"] },
  { repo: "vercel-labs/nostics", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/opensrc", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/phase", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/portless", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/screen-relay", category: "desktop", prefixes: ["skills/"] },
  { repo: "vercel-labs/trackcn", category: "devtools", prefixes: ["skills/"] },
  { repo: "vercel-labs/tw-blocks", category: "ui", prefixes: ["SKILLS/"] },
  { repo: "vercel-labs/ui", category: "ui", prefixes: ["packages/core/skills/"] },
  { repo: "vercel-labs/vgpu", category: "gpu", prefixes: ["skills/"] },
  { repo: "vercel-labs/webreel", category: "media", prefixes: ["skills/"] },
  { repo: "vercel-labs/zerolang", category: "compiler", prefixes: ["skills/"] },
];

export function parseFrontmatter(md: string): { name?: string; description?: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return {};
  try {
    const parsed = Bun.YAML.parse(m[1]!) as Record<string, unknown>;
    return {
      name: typeof parsed?.name === "string" ? parsed.name.trim() : undefined,
      description: typeof parsed?.description === "string" ? parsed.description.trim() : undefined,
    };
  } catch {
    const out: Record<string, string> = {};
    for (const line of m[1]!.split(/\r?\n/)) {
      const kv = /^([a-zA-Z0-9_-]+):\s*(.+)$/.exec(line.trim());
      if (kv) out[kv[1]!] = kv[2]!.replace(/^["']|["']$/g, "");
    }
    return out;
  }
}

export function sanitizeSkillText(raw: string): string {
  return raw
    .replaceAll("\r\n", "\n")
    .replace(/~\/\.claude\b/g, "~/.agents")
    .replace(/\$HOME\/\.claude\b/g, "$HOME/.agents")
    .replace(/%USERPROFILE%[/\\]\.claude\b/g, "%USERPROFILE%\\.agents");
}

function sha256Hex(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

async function ghJson<T>(path: string): Promise<T> {
  const proc = Bun.spawn(["gh", "api", path], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`gh api ${path}: ${err.trim().split("\n")[0]}`);
  return JSON.parse(out) as T;
}

async function fetchRaw(repo: string, sha: string, path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return sanitizeSkillText(await res.text());
    if (res.status === 404 || attempt === 3) throw new Error(`HTTP ${res.status} for ${url}`);
    await Bun.sleep(400 * (attempt + 1));
  }
  throw new Error(`unreachable`);
}

function deriveSkillName(path: string, spec: SkillSourceSpec, fmName?: string): string {
  if (fmName && /^[a-z0-9][a-z0-9._-]*$/i.test(fmName)) {
    return fmName.toLowerCase();
  }
  const parts = path.split("/");
  if (parts.length === 1 && spec.rootSkillName) return spec.rootSkillName;
  const parent = parts.at(-2) ?? spec.rootSkillName ?? spec.repo.split("/")[1]!;
  if ((parent === "skill" || parent === "core") && spec.rootSkillName) return spec.rootSkillName;
  return parent.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

async function syncFromUpstream(dryRun: boolean): Promise<SkillProvenanceEntry[]> {
  const collected = new Map<string, { spec: SkillSourceSpec; path: string; sha: string; content: string; name: string; description: string }>();

  for (const spec of SKILL_SOURCES) {
    let headSha = "";
    let tree: Array<{ path: string; type: string; size?: number }> = [];
    try {
      const head = await ghJson<{ sha: string }>(`repos/${spec.repo}/commits/HEAD`);
      headSha = head.sha;
      const tr = await ghJson<{ tree: Array<{ path: string; type: string; size?: number }> }>(
        `repos/${spec.repo}/git/trees/${headSha}?recursive=1`,
      );
      tree = tr.tree;
    } catch (err) {
      console.error(`WARN skip ${spec.repo}: ${(err as Error).message}`);
      continue;
    }

    const candidates = tree.filter((entry) => {
      if (entry.type !== "blob") return false;
      if (!/(^|\/)SKILL\.md$/i.test(entry.path)) return false;
      if (/\/(upstream|tests?|fixtures?|evals?|node_modules)\//i.test(entry.path)) return false;
      return spec.prefixes.some((p) => (p === "" ? !entry.path.includes("/") || entry.path.endsWith("/SKILL.md") : entry.path.startsWith(p)));
    });

    for (const c of candidates) {
      try {
        const content = await fetchRaw(spec.repo, headSha, c.path);
        const fm = parseFrontmatter(content);
        const name = deriveSkillName(c.path, spec, fm.name);
        if (!collected.has(name)) {
          collected.set(name, {
            spec,
            path: c.path,
            sha: headSha,
            content,
            name,
            description: (fm.description ?? `Vercel ${name} agent skill`).replace(/\s+/g, " ").trim(),
          });
        }
      } catch (err) {
        console.error(`WARN fetch ${spec.repo}/${c.path}: ${(err as Error).message}`);
      }
    }
    console.log(`scanned ${spec.repo}: ${candidates.length} skill(s) (total unique=${collected.size})`);
  }

  const provenance: SkillProvenanceEntry[] = [];
  if (!dryRun) {
    for (const item of [...collected.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const targetDir = join(skillsDir, item.name);
      mkdirSync(targetDir, { recursive: true });
      const targetFile = join(targetDir, "SKILL.md");
      await Bun.write(targetFile, item.content);
      provenance.push({
        name: item.name,
        description: item.description,
        category: item.spec.category,
        source_repo: item.spec.repo,
        source_path: item.path,
        local_path: `skills/${item.name}/SKILL.md`,
        sha256: sha256Hex(item.content),
        bytes: new TextEncoder().encode(item.content).byteLength,
      });
    }
  }
  return provenance;
}

export function buildSkillsIndex(
  dir: string,
  baseUrl = "/skills",
): { $schema: string; generated_at: string; skills: SkillIndexEntry[] } {
  const entries: SkillIndexEntry[] = [];
  if (!existsSync(dir)) {
    return {
      $schema: "https://cloudflare.github.io/agent-skills-discovery-rfc/schema.json",
      generated_at: new Date().toISOString(),
      skills: entries,
    };
  }
  for (const d of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!d.isDirectory()) continue;
    const mdPath = join(dir, d.name, "SKILL.md");
    if (!existsSync(mdPath)) continue;
    const raw = readFileSync(mdPath, "utf8");
    const fm = parseFrontmatter(raw);
    entries.push({
      name: fm.name ?? d.name,
      description: (fm.description ?? `Vercel ${d.name} skill`).replace(/\s+/g, " ").trim(),
      url: `${baseUrl}/${d.name}/SKILL.md`,
      sha256: sha256Hex(raw),
      bytes: new TextEncoder().encode(raw).byteLength,
    });
  }
  return {
    $schema: "https://cloudflare.github.io/agent-skills-discovery-rfc/schema.json",
    generated_at: new Date().toISOString(),
    skills: entries,
  };
}

if (import.meta.main) {
  const fetchMode = Bun.argv.includes("--fetch");
  const dryRun = Bun.argv.includes("--dry-run");
  const checkOnly = Bun.argv.includes("--check");

  if (checkOnly) {
    const idx = await Bun.file(join(wellKnownDir, "index.json")).json() as { skills: SkillIndexEntry[] };
    for (const s of idx.skills) {
      const p = join(root, s.url.replace(/^\//, ""));
      if (!existsSync(p)) throw new Error(`missing skill file ${s.url}`);
      const sha = sha256Hex(readFileSync(p, "utf8"));
      if (sha !== s.sha256) throw new Error(`sha256 mismatch on ${s.url}`);
    }
    console.log(`skills-sync check OK (${idx.skills.length} skills verified)`);
    process.exit(0);
  }

  let provenance: SkillProvenanceEntry[] = [];
  if (fetchMode) {
    provenance = await syncFromUpstream(dryRun);
  }

  if (!dryRun) {
    const index = buildSkillsIndex(skillsDir);
    await Bun.write(join(wellKnownDir, "index.json"), JSON.stringify(index, null, 2) + "\n");

    const regPath = join(skillsDir, "REGISTRY.json");
    const prevReg = existsSync(regPath)
      ? (JSON.parse(readFileSync(regPath, "utf8")) as { skills?: SkillProvenanceEntry[] }).skills ?? []
      : [];
    const byName = new Map<string, SkillProvenanceEntry>(prevReg.map((r) => [r.name, r]));
    for (const p of provenance) byName.set(p.name, p);
    for (const s of index.skills) {
      if (!byName.has(s.name)) {
        byName.set(s.name, {
          name: s.name,
          description: s.description,
          category: "ay-vercel",
          source_repo: "aphrody-labs/ay-vercel",
          source_path: s.url.replace(/^\//, ""),
          local_path: s.url.replace(/^\//, ""),
          sha256: s.sha256,
          bytes: s.bytes,
        });
      }
    }
    const sorted = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    await Bun.write(
      regPath,
      JSON.stringify({ generated_at: new Date().toISOString(), total: sorted.length, skills: sorted }, null, 2) + "\n",
    );
    console.log(`Generated .well-known/agent-skills/index.json (${index.skills.length} skills) and skills/REGISTRY.json (${sorted.length} entries)`);
  }
}
