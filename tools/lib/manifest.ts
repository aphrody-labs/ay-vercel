// forks.toml loader and validator for ay-vercel. Pure: no network, no git.
import { TOML } from "bun";

export const ROLES = [
  "frameworks",
  "sdk",
  "skills",
  "mcp",
  "docs",
  "agents",
  "ui",
  "runtime",
  "rust",
  "net",
  "python",
  "templates",
  "security",
  "consumer",
] as const;
export type Role = (typeof ROLES)[number];

export type Policy = "merge" | "ff-only";

export interface Fork {
  path: string;
  name: string;
  upstream: string;
  branch: string;
  defaultBranch: string;
  group: string;
  role: Role;
  policy: Policy;
  note?: string;
}

export interface Manifest {
  org: string;
  consumer: string;
  groups: Record<string, string>;
  forks: Fork[];
  notForked: { upstream: string; reason: string }[];
}

type Raw = Record<string, unknown>;

function str(o: Raw, k: string, where: string): string {
  const v = o[k];
  if (typeof v !== "string" || v === "") {
    throw new Error(`${where}: "${k}" must be a non-empty string`);
  }
  return v;
}

export function parseManifest(text: string): Manifest {
  const doc = TOML.parse(text) as Raw;
  const meta = (doc.meta ?? {}) as Raw;
  const org = str(meta, "org", "[meta]");
  const consumer = meta.consumer === undefined ? org : str(meta, "consumer", "[meta]");
  const groups = (doc.groups ?? {}) as Record<string, string>;
  const forks: Fork[] = [];
  for (const [i, e] of ((doc.fork ?? []) as Raw[]).entries()) {
    const where = `[[fork]] #${i + 1} (${String(e.path ?? "?")})`;
    const path = str(e, "path", where);
    const role = str(e, "role", where) as Role;
    if (!ROLES.includes(role)) throw new Error(`${where}: unknown role "${role}"`);
    const branch = str(e, "branch", where);
    const policy = (e.policy ?? "merge") as Policy;
    if (policy !== "merge" && policy !== "ff-only") {
      throw new Error(`${where}: unknown policy "${policy}"`);
    }
    const upstream = str(e, "upstream", where);
    if (!/^[\w.-]+\/[\w.-]+$/.test(upstream)) {
      throw new Error(`${where}: upstream must be owner/repo`);
    }
    const parts = path.split("/");
    const [group, leaf] = parts;
    if (!group || !leaf || parts.length !== 2) {
      throw new Error(`${where}: path must be <group>/<name>`);
    }
    forks.push({
      path,
      name: typeof e.name === "string" ? e.name : leaf,
      upstream,
      branch,
      defaultBranch: typeof e.default_branch === "string" ? e.default_branch : branch,
      group,
      role,
      policy,
      note: typeof e.note === "string" ? e.note : undefined,
    });
  }
  const notForked = ((doc.not_forked ?? []) as Raw[]).map((e, i) => ({
    upstream: str(e, "upstream", `[[not_forked]] #${i + 1}`),
    reason: str(e, "reason", `[[not_forked]] #${i + 1}`),
  }));
  const m: Manifest = { org, consumer, groups, forks, notForked };
  const problems = validate(m);
  if (problems.length) throw new Error(`forks.toml is invalid:\n- ${problems.join("\n- ")}`);
  return m;
}

export function validate(m: Manifest): string[] {
  const out: string[] = [];
  const seen = (what: string, vals: string[]) => {
    for (const v of new Set(vals.filter((x, i) => vals.indexOf(x) !== i))) {
      out.push(`duplicate ${what}: ${v}`);
    }
  };
  seen("path", m.forks.map((f) => f.path));
  seen("fork name", m.forks.map((f) => f.name.toLowerCase()));
  seen("upstream", m.forks.map((f) => f.upstream.toLowerCase()));
  for (const f of m.forks) {
    if (!(f.group in m.groups)) out.push(`${f.path}: group "${f.group}" is not declared under [groups]`);
    if (f.path !== `${f.group}/${f.name}`) out.push(`${f.path}: path must be ${f.group}/${f.name}`);
  }
  return out;
}

export async function loadManifest(file: string): Promise<Manifest> {
  return parseManifest(await Bun.file(file).text());
}

export function renderGitmodules(m: Manifest): string {
  const base = m.consumer === m.org ? ".." : `../../${m.org}`;
  return m.forks
    .map((f) => `[submodule "${f.path}"]\n\tpath = ${f.path}\n\turl = ${base}/${f.name}.git\n`)
    .join("");
}
