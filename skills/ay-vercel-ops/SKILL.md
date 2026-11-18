---
name: ay-vercel-ops
description: Manage the ay-vercel superproject, upstream fork synchronization across vercel and vercel-labs, agent skills indexing, MCP catalog verification, and tsc-ts/scriptc/Turborepo/Next.js builds.
---

# ay-vercel Operations

Use `just` and `bun` recipes inside `ay-vercel`:

- `just check`: run privacy gate, fork/submodule validation, `tsc`, `tsc-ts`, Bun tests, Vercel audit, Ruff/pytest, and Cargo workspace checks.
- `just turbo-build`: run Turborepo workspace typecheck and `scriptc` native binary compilation.
- `just skills-sync`: fetch all upstream `vercel/*` and `vercel-labs/*` skills and regenerate `.well-known/agent-skills/index.json` + `skills/REGISTRY.json`.
- `just mcp-sync`: validate `.mcp.json`, `mcp/catalog.toml`, and `mcp/vercel-tools-index.json`.
- `just docs-sync`: mirror official Vercel documentation pages into `docs/vercel/` via `vercel docs inspect`.
- `just sync`: run `POST /repos/aphrody-labs/<fork>/merge-upstream`, bump `160000` gitlinks, and update `ledger/`.
