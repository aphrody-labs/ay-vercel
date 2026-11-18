import { describe, expect, test } from "bun:test";
import { parseManifest } from "./manifest.ts";
import { ledgerWorthy, syncOne } from "./sync.ts";
import type { Gh } from "./gh.ts";

describe("syncOne & ledgerWorthy", () => {
  test("records fast-forward and pin updates cleanly", async () => {
    const manifest = parseManifest(`
[meta]
org = "aphrody-labs"
consumer = "aphrody-labs"

[groups]
sdk = "Vercel SDKs"

[[fork]]
path = "sdk/vercel"
upstream = "vercel/vercel"
branch = "main"
role = "sdk"
`);
    const oldSha = "a".repeat(40);
    const newSha = "b".repeat(40);
    let headCall = 0;
    const gh: Gh = {
      async request(method: string, path: string) {
        if (method === "GET" && path === "repos/aphrody-labs/vercel") {
          return {
            status: 200,
            json: {
              full_name: "aphrody-labs/vercel",
              default_branch: "main",
              fork: true,
              archived: false,
              parent: { full_name: "vercel/vercel" },
            },
          };
        }
        if (method === "GET" && path === "repos/aphrody-labs/vercel/branches/main") {
          headCall++;
          return { status: 200, json: { commit: { sha: headCall === 1 ? oldSha : newSha } } };
        }
        if (method === "GET" && path.startsWith("repos/aphrody-labs/vercel/compare/")) {
          return { status: 200, json: { ahead_by: 0, behind_by: 3 } };
        }
        if (method === "POST" && path === "repos/aphrody-labs/vercel/merge-upstream") {
          return {
            status: 200,
            json: {
              merge_type: "fast-forward",
              base_branch: "main",
              message: "Successfully fetched and fast-forwarded from upstream vercel:main.",
            },
          };
        }
        throw new Error(`unexpected ${method} ${path}`);
      },
    };

    const out = await syncOne(gh, "aphrody-labs", manifest.forks[0]!, new Map([["sdk/vercel", oldSha]]), {
      apply: true,
      now: () => new Date("2026-11-18T00:00:00Z"),
    });
    expect(out.entry.status).toBe("fast-forward");
    expect(out.bump).toBe(newSha);
    expect(ledgerWorthy([out], []).length).toBe(1);
    expect(ledgerWorthy([out], [out.entry]).length).toBe(0);
  });
});
