---
name: ay-vercel-ops
description: Operate the ay-vercel Rust + Bun superproject — unified crates.io-grade Cargo workspace (vercel-*, next-*, turbopack-*, turborepo-*) with max LTO/XLTO/AOT, upstream fork sync, skills/MCP/docs mirrors, and real-browser verification via agent-browser.
---

# ay-vercel Operations

## 1. Research, Planning & Browser Verification Loop

1. Check upstream `canary` tags, GitHub issues/PRs/commits, and official docs before editing:
   - `bun pm view next dist-tags`
   - `gh issue list --repo vercel/next.js --limit 10` / `gh pr list --repo vercel/next.js --limit 10`
   - `gh pr list --repo vercel/turborepo --limit 10` / `gh pr list --repo vercel/vercel --limit 10`
2. Inspect live Vercel sites or verify local `apps/web` in a real Chromium browser via `agent-browser`:
   - `bun x agent-browser open https://vercel.com/changelog`
   - Start `apps/web` (`bun run --cwd apps/web start -p 3100`) and verify `/`, `/api/health`, and `/api/mcp` with `bun x agent-browser`.

## 2. Unified Cargo Workspace (`crates.io` Exact Naming & LTO/AOT)

- Single root `Cargo.toml` workspace with exact upstream prefixes (`vercel-*`, `next-*`, `turbopack-*`, `turbo-*`, `turborepo-*`).
- Local fast check: `just rust-check`
- Max LTO / AOT release build (run heavy graphs on `fr1`):
  - `cargo build --workspace --profile release` (`lto = "fat"`, `codegen-units = 1`, `opt-level = 3`, `strip = "symbols"`, `panic = "abort"`)
  - `cargo build --workspace --profile release-xlto`

## 3. Monorepo & Sync Recipes

- `just check`: privacy gate, fork/submodule check, `tsc`, `tsc-ts`, Bun tests, Vercel audit, Ruff/pytest, and unified Cargo workspace checks.
- `just turbo-build`: Turborepo typecheck + `scriptc` native AOT compilation + Next.js canary production build.
- `just skills-sync`: fetch upstream `vercel/*` & `vercel-labs/*` skills and regenerate `.well-known/agent-skills/index.json` + `skills/REGISTRY.json`.
- `just mcp-sync`: validate `.mcp.json`, `mcp/catalog.toml`, and `mcp/vercel-tools-index.json`.
- `just docs-sync`: mirror official Vercel documentation pages into `docs/vercel/`.
- `just sync`: merge upstream across all 273 `aphrody-labs/*` forks, update `160000` gitlinks, and record `ledger/`.
