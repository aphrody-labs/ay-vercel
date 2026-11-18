# ay-vercel

Unified Vercel and Vercel Labs monorepo, upstream fork auto-merge, agent skills registry, official MCP catalog, offline docs, and polyglot toolchain.

[![ci](https://github.com/aphrody-labs/ay-vercel/actions/workflows/ci.yml/badge.svg)](https://github.com/aphrody-labs/ay-vercel/actions/workflows/ci.yml)
[![sync](https://github.com/aphrody-labs/ay-vercel/actions/workflows/sync.yml/badge.svg)](https://github.com/aphrody-labs/ay-vercel/actions/workflows/sync.yml)
[![license](https://img.shields.io/github/license/aphrody-labs/ay-vercel)](LICENSE)

## Why

Tracking Vercel CLI, Next.js, AI SDK, Turborepo, Workflow SDK, Sandbox, Flags SDK, MCP servers, and dozens of official `vercel/*` and `vercel-labs/*` skills across scattered repositories leads to stale guidance and upstream drift. `ay-vercel` unifies every `aphrody-labs` Vercel fork as lightweight `160000` relative gitlinks (`../<name>.git`), mirrors official Vercel documentation and agent skills with SHA-256 digests, indexes the full MCP tool catalog, and runs pure Vercel tooling (`tsc-ts`, `scriptc`, `turbo`, `next`, `vercel`) alongside Rust (`vercel_runtime`), Python (`uv`), and C++23 (`Bazel`).

## Install

```sh
git clone https://github.com/aphrody-labs/ay-vercel.git
cd ay-vercel
bun install --frozen-lockfile
uv sync
```

## Usage

```sh
just --list
just skills-sync
just mcp-sync
just docs-sync
just sync
```

## Documentation

- [Documentation Index](docs/index.md)
- [Vercel & Vercel-Labs Architecture](docs/architecture.md)
- [Polyglot Toolchains (`tsc-ts`, `scriptc`, `turbo`, `next`, Rust, Python, Bazel)](docs/toolchains.md)
- [MCP Servers & Tool Catalog](docs/mcp-catalog.md)
- [Agent Skills Registry](docs/skills-catalog.md)

## Development

```sh
just check
just turbo-build
just cpp-check
bun tools/forks.ts --check
bun tools/submodules.ts --check
```

Selectively initialize any submodule group on demand without cloning all forks:

```sh
just submodules-init mcp skill-repos sdk/vercel
```

Contributions follow the [organization guide](https://github.com/aphrody-labs/.github/blob/main/CONTRIBUTING.md). Report vulnerabilities as described in the [security policy](https://github.com/aphrody-labs/.github/blob/main/SECURITY.md).

## License

Apache-2.0, see [LICENSE](LICENSE).
