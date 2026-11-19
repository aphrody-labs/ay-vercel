# AGENTS.md — `aphrody-labs/ay-vercel`

## Scope & Boundaries

- Authoritative unified Vercel & Vercel-Labs monorepo (`forks.toml` -> `aphrody-labs/*` relative submodules with `../<name>.git` and `160000` gitlinks), optimized end-to-end for **Rust + Bun**.
- **Vercel-only rules & dependencies**: keep all Vercel dependencies (`next`, `turbo`, `tsc-ts`, `scriptc`, `vercel`, `@vercel/sdk`, `ai`, `flags`, `workflow`, `chat`, `@vercel/sandbox`, `@vercel/blob`, `@vercel/global-config`, `@vercel/otel`, `@vercel/analytics`, `@vercel/speed-insights`, `satori`, `swr`, `streamdown`, `mcp-handler`, `mcp-to-ai-sdk`, `agent-browser`, `just-bash`, `portless`, `v0-sdk`, `micro`, `serve-handler`) and Vercel engineering rules scoped exclusively inside `ay-vercel`.
- Privacy gate: never commit literal tokens, Team IDs, Project IDs, emails, or machine home paths (`bun tools/private-gate.ts` must report `0` leaks). Store local state strictly in git-ignored `ay-vercel.local.toml` and `.private/`.

## Unified Rust + Bun Architecture (`crates.io` Grade, Max LTO/AOT)

1. **Single Unified Cargo & Bun Monorepo**:
   - Consolidate all extracted Rust crates and Bun-optimized TypeScript packages from `vercel/next.js`, `vercel/turborepo`, and `vercel/vercel` into **one root `Cargo.toml` workspace** (zero fragmented sub-workspaces) and one root Bun/Turborepo workspace.
   - **Exact Upstream Prefixing (`crates.io` Ready)**: every Rust crate uses exact upstream prefixes (`vercel-*`, `vercel_runtime*`, `next-*`, `turbopack*`, `turbo-*`, `turborepo-*`) with complete publishable `crates.io` metadata (`version`, `edition = "2024"`, `license`, `description`, `repository`, `readme`, `keywords`, `categories`) — never custom `ay-vercel-*` crate prefixes.
2. **Maximum LTO / XLTO / AOT Compilation**:
   - Root `[profile.release]` enforces `lto = "fat"`, `codegen-units = 1`, `opt-level = 3`, `strip = "symbols"`, and `panic = "abort"` (for standalone AOT binaries; `[profile.release-ffi]` / `release-xlto` keeps `unwind` only where FFI requires it).
   - `[profile.release-xlto]` enables cross-language LLVM LTO (`rustc -Clinker-plugin-lto`, Clang `-flto`, `lld`, `-Zshare-generics=y`).
   - Compile TypeScript CLI/runtime entrypoints AOT with `scriptc` (`packages/vercel-native`) and `bun build --compile --bytecode`.
   - Run heavy multi-crate `turbopack` / `next-*` / `turborepo-*` builds on `fr1` (`fleet`), never blocking the workstation.
3. **Compiler, Next.js Canary & Fluid Compute Discipline**:
   - Track upstream `canary` (`next` canary dist-tag) and typecheck with Vercel Labs `tsc-ts` alongside `tsc`.
   - Use Next.js App Router (`apps/web`) with `typedRoutes: true`, `cacheComponents: true`, `partialPrefetching: true`, and `vercel.json` `fluid: true` (`maxDuration <= 60`s, `memory = 1024` MB).
4. **Agent Skills & MCP Discipline**:
   - Sync upstream skills via `bun tools/skills-sync.ts --fetch` and verify SHA-256 digests in `.well-known/agent-skills/index.json` + `skills/REGISTRY.json`.
   - Verify `.mcp.json` (`https://mcp.vercel.com` + `next-devtools-mcp`) and `mcp/catalog.toml` via `bun tools/mcp-sync.ts --check`.
5. **Mandatory Planning, Deep Web/GitHub Research & Real-Browser Verification**:
   - Always plan before editing; search the web and inspect upstream GitHub issues, PRs, commits, discussions, blogs, articles, and official Vercel docs.
   - Inspect live Vercel sites and verify all local UI/API surfaces (`apps/web` routes, DOM, console, network) in a real Chromium browser via `agent-browser` (`bun x agent-browser`), then refactor and self-improve.

## Verification

```sh
just check
```
