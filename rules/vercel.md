# Vercel Platform & Toolchain Rules (ay-vercel only)

These rules govern `aphrody-labs/ay-vercel` exclusively and stay scoped inside this repository.

## 1. Dependencies & Runtime Stack

- Prefer official Vercel packages (`vercel`, `@vercel/sdk`, `next`, `turbo`, `tsc-ts`, `scriptc`, `ai`, `flags`, `workflow`, `chat`, `@vercel/sandbox`, `@vercel/blob`, `@vercel/global-config`, `@vercel/otel`, `@vercel/analytics`, `@vercel/speed-insights`, `satori`, `swr`, `streamdown`, `mcp-handler`, `mcp-to-ai-sdk`, `agent-browser`, `just-bash`, `portless`, `v0-sdk`, `micro`, `serve-handler`).
- Replace deprecated `@vercel/edge-config` with `@vercel/global-config`.
- Replace custom serverless HTTP adapters with `next` route handlers, `mcp-handler`, or `micro`/`serve-handler`.

## 2. Typechecking, Native Compilation & Monorepo Execution

- Validate TypeScript with `tsc-ts` (`bun x tsc-ts -p tsconfig.json`) and `tsc --noEmit`.
- Use `scriptc` (`vercel-labs/scriptc`) for compiling standalone native TypeScript utilities (`packages/vercel-native`).
- Coordinate package builds and checks via `turbo` (`turbo.json`).

## 3. Fluid Compute & Serverless Safety

- Set `"fluid": true` in `vercel.json` and define explicit `functions.*.maxDuration` (`<= 60` default, never above `300` without justification) and `memory` bounds.
- Never hardcode secrets or Vercel OIDC tokens in tracked files; use `vercel env pull` or git-ignored `ay-vercel.local.toml`.

## 4. Upstream Sync & Auto-Merge

- All `vercel/*` and `vercel-labs/*` forks live under `aphrody-labs/*` and register in `forks.toml` with relative `../<name>.git` paths in `.gitmodules`.
- Keep issues, wikis, projects, and inherited Actions disabled on mirror forks; keep upstream merges automated via `tools/sync.ts --apply` and `.github/workflows/sync.yml` + `auto-merge.yml`.
