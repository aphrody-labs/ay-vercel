import { branchHead, mergeUpstream, type Gh } from "./gh.ts";
import { inspectOne, type ForkStatus } from "./inspect.ts";
import type { Fork, Manifest } from "./manifest.ts";

export type SyncStatus =
  | "current"
  | "pin"
  | "fast-forward"
  | "merged"
  | "conflict"
  | "diverged"
  | "error";

export interface LedgerEntry {
  ts: string;
  fork: string;
  repo: string;
  upstream: string;
  branch: string;
  old: string | null;
  new: string | null;
  merged: number;
  ahead: number | null;
  behind: number | null;
  status: SyncStatus;
  message?: string;
}

export interface Outcome {
  entry: LedgerEntry;
  bump: string | null;
  merges: boolean;
}

export interface SyncOptions {
  apply: boolean;
  now: () => Date;
}

const sameState = (a: LedgerEntry, b: LedgerEntry) =>
  a.status === b.status &&
  a.old === b.old &&
  a.new === b.new &&
  a.ahead === b.ahead &&
  a.behind === b.behind;

export function isRepeat(e: LedgerEntry, previous: LedgerEntry[]): boolean {
  const last = [...previous].reverse().find((p) => p.fork === e.fork);
  return !!last && sameState(last, e);
}

export async function syncOne(
  gh: Gh,
  org: string,
  f: Fork,
  pins: Map<string, string>,
  opt: SyncOptions,
): Promise<Outcome> {
  const st: ForkStatus = await inspectOne(gh, org, f, pins);
  const base = {
    ts: opt.now().toISOString(),
    fork: f.path,
    repo: `${org}/${f.name}`,
    upstream: f.upstream,
    branch: f.branch,
    old: st.pinned,
    ahead: st.div?.ahead ?? null,
    behind: st.div?.behind ?? null,
  };
  const done = (
    status: SyncStatus,
    newSha: string | null,
    merged = 0,
    merges = false,
    message?: string,
  ): Outcome => {
    const entry: LedgerEntry = {
      ...base,
      new: newSha ?? st.pinned,
      merged,
      status,
      ...(message ? { message } : {}),
    };
    return { entry, bump: newSha && newSha !== st.pinned ? newSha : null, merges };
  };

  if (st.problems.length || !st.div || !st.head) {
    return done("error", null, 0, false, st.problems.join("; "));
  }
  const { ahead, behind } = st.div;

  if (behind === 0) return st.pinned === st.head ? done("current", st.head) : done("pin", st.head);

  if (ahead > 0 && f.policy === "ff-only") {
    return done(
      "diverged",
      st.head,
      0,
      false,
      `fork is ${ahead} ahead and ${behind} behind; policy ff-only does not merge`,
    );
  }
  if (!opt.apply) {
    return done(
      ahead > 0 ? "merged" : "fast-forward",
      st.head,
      behind,
      true,
      "dry run: merge-upstream not called",
    );
  }

  const r = await mergeUpstream(gh, base.repo, f.branch);
  if (r.kind === "conflict") return done("conflict", st.head, 0, true, r.message);
  if (r.kind === "error") {
    return done("error", st.head, 0, true, `merge-upstream HTTP ${r.status}: ${r.message}`);
  }
  const head = await branchHead(gh, base.repo, f.branch);
  if (!head) return done("error", null, 0, true, `branch ${f.branch} vanished after merge-upstream`);
  if (r.mergeType === "none") return done(st.pinned === head ? "current" : "pin", head, 0, true, r.message);
  return done(r.mergeType === "fast-forward" ? "fast-forward" : "merged", head, behind, true, r.message);
}

export async function syncAll(
  gh: Gh,
  m: Manifest,
  pins: Map<string, string>,
  opt: SyncOptions,
  only?: Set<string>,
  concurrency = 6,
): Promise<Outcome[]> {
  const list = m.forks.filter((f) => !only || only.has(f.name) || only.has(f.path));
  const out = new Array<Outcome>(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await syncOne(gh, m.org, list[i]!, pins, opt);
      }
    }),
  );
  return out;
}

export function ledgerWorthy(outcomes: Outcome[], previous: LedgerEntry[]): LedgerEntry[] {
  return outcomes.map((o) => o.entry).filter((e) => e.status !== "current" && !isRepeat(e, previous));
}

export const ledgerFile = (dir: string, now: Date) => `${dir}/${now.toISOString().slice(0, 7)}.jsonl`;

export function parseLedger(text: string): LedgerEntry[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LedgerEntry);
}

export const renderLedger = (entries: LedgerEntry[]) =>
  entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");
