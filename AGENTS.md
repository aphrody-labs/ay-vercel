# AGENTS.md — `aphrody-labs/ay-vercel`

## Scope & Boundaries

- Authoritative unified Vercel & Vercel-Labs superproject (`forks.toml` -> `aphrody-labs/*` relative submodules with `../<name>.git` and `160000` gitlinks).
- **Vercel-only rules & dependencies**: keep Vercel dependencies (`next`, `turbo`, `tsc-ts`, `scriptc`, `vercel`, `@vercel/sdk`, `ai`, `flags`, `workflow`, `chat`, `@vercel/sandbox`, `@vercel/blob`, `@vercel/global-config`, `@vercel/otel`, `@vercel/analytics`, `@vercel/speed-insights`, `satori`, `swr`, `streamdown`, `mcp-handler`, `mcp-to-ai-sdk`, `agent-browser`, `just-bash`, `portless`, `v0-sdk`, `micro`, `serve-handler`) and Vercel rules scoped exclusively inside `ay-vercel`.
- Privacy gate: never commit literal tokens, Team IDs, Project IDs, emails, or machine home paths (`bun tools/private-gate.ts` must report `0` leaks). Store local state strictly in git-ignored `ay-vercel.local.toml` and `.private/`.

## Vercel Engineering Rules (`rules/vercel.md`)

1. **Compiler & Build Discipline**:
   - Typecheck with Vercel Labs `tsc-ts` (`bun run typecheck:tsc-ts`) alongside `tsc`.
   - Compile portable standalone native binaries/Wasm with `scriptc` (`packages/vercel-native`).
   - Orchestrate JS/TS builds and caching with `turbo` (`turbo.json`).
   - Use Next.js 16 App Router (`apps/web`) with `typedRoutes: true`, `cacheComponents: true`, `partialPrefetching: true`, and `vercel.json` `fluid: true`.
2. **Fluid Compute & Cost Guardrails**:
   - Keep `fluid: true` enabled and bound API route `maxDuration <= 60`s (ceiling `300`s) and `memory = 1024` MB unless workload profiling justifies higher limits.
   - Instrument serverless routes with `@vercel/otel`, `@vercel/analytics`, and `@vercel/speed-insights`.
3. **Agent Skills & MCP Discipline**:
   - Sync upstream skills via `bun tools/skills-sync.ts --fetch` and verify SHA-256 digests in `.well-known/agent-skills/index.json` + `skills/REGISTRY.json`.
   - Verify `.mcp.json` (`https://mcp.vercel.com` + `next-devtools-mcp`) and `mcp/catalog.toml` via `bun tools/mcp-sync.ts --check`.
4. **Rust, Python, and C++ Discipline**:
   - **Rust**: official `vercel_runtime` crate, `#![forbid(unsafe_code)]`, zero `.unwrap()`/`.expect()` outside tests, no `mod.rs`.
   - **Python 3.13**: `vercel`, `pydantic` v2, `httpx`, managed via `uv` and checked with `ruff` + `pytest`.
   - **C++23 / Bazel 9**: `rules_cc`, `abseil-cpp`, `googletest`.

## Verification

```sh
just check
```
