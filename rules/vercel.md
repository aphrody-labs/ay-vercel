# Vercel Platform, Rust + Bun Extraction & AOT Rules (`ay-vercel` only)

These rules govern `aphrody-labs/ay-vercel` exclusively and stay scoped inside this repository.

## 1. Unified Rust + Bun Workspace & Exact `crates.io` Naming

- Maintain **one single root `Cargo.toml` workspace** at the repository root — never split Rust code into disconnected sub-workspaces.
- Use **exact upstream `crates.io`-grade crate names and prefixes** (`vercel-*`, `vercel_runtime*`, `next-*`, `turbopack*`, `turbo-*`, `turborepo-*`), never `ay-vercel-*` prefixes.
- Every crate in `crates/` must carry complete `crates.io` publication metadata (`description`, `license`, `repository`, `edition = "2024"`, `keywords`, `categories`) and `#![forbid(unsafe_code)]` (unless explicitly isolated in an upstream FFI shim crate), with `unwrap_used = "deny"` and `expect_used = "deny"` outside tests.
- Optimize extracted Vercel, Next.js, Turbopack, and Turborepo code paths for **Rust + Bun** (replacing Node.js subprocesses, N-API bottlenecks, and legacy npm wrappers with native Rust crates and Bun APIs).

## 2. Maximum LTO, XLTO & AOT Optimization

- Root `Cargo.toml` must provide:
  - `[profile.release]`: `opt-level = 3`, `lto = "fat"`, `codegen-units = 1`, `strip = "symbols"`, `panic = "abort"`.
  - `[profile.release-xlto]`: inherits `release` for cross-language LTO (`clang` + `lld` + `-Clinker-plugin-lto` + `-Zshare-generics=y`).
- Compile standalone TypeScript tools AOT via `scriptc` (`vercel-labs/scriptc`) and `bun build --compile --bytecode`.
- Execute heavy Rust LTO/AOT builds on `fr1` (`fleet`), coordinating via `relay` (`session_list` / `session_register`) before touching `/srv/xbuild`.

## 3. Dependencies, Canary Tracking & Fluid Compute

- Track upstream `next` `canary` (`bun pm view next dist-tags`) with `minimumReleaseAgeExcludes` scoped to `next` and `@next/*`.
- Prefer official Vercel packages (`vercel`, `@vercel/sdk`, `next`, `turbo`, `tsc-ts`, `scriptc`, `ai`, `flags`, `workflow`, `chat`, `@vercel/sandbox`, `@vercel/blob`, `@vercel/global-config`, `@vercel/otel`, `@vercel/analytics`, `@vercel/speed-insights`, `satori`, `swr`, `streamdown`, `mcp-handler`, `mcp-to-ai-sdk`, `agent-browser`, `just-bash`, `portless`, `v0-sdk`, `micro`, `serve-handler`).
- Replace deprecated `@vercel/edge-config` with `@vercel/global-config`.
- Set `"fluid": true` in `vercel.json` and bound `functions.*.maxDuration <= 60`s (ceiling `300`s) and `memory = 1024` MB.

## 4. Upstream Sync & Auto-Merge

- All `vercel/*` and `vercel-labs/*` forks live under `aphrody-labs/*` and register in `forks.toml` with relative `../<name>.git` paths in `.gitmodules` (`skill-repos/*` isolates skill repositories from merged `skills/*` trees).
- Keep issues, wikis, projects, and inherited Actions disabled on mirror forks; automate upstream merges via `tools/sync.ts --apply` and `.github/workflows/sync.yml` + `auto-merge.yml`.

## 5. Planning, Deep Web/GitHub Research & Real-Browser Verification

- Plan architecture, crate boundaries, and edge cases before editing.
- Search the web and synthesize upstream GitHub issues, PRs, commits, release notes, blogs, articles, and official Vercel docs before assuming APIs or versions.
- Inspect live Vercel sites/changelogs and verify `apps/web` rendering, routes (`/`, `/api/health`, `/api/mcp`), and runtime console/network health in a real Chromium browser via `agent-browser` (`bun x agent-browser`).
- Refactor, eliminate workarounds, and improve code quality and performance after every verification pass.
