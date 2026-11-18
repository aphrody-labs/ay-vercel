set windows-shell := ["pwsh", "-NoLogo", "-NoProfile", "-Command"]

export RUSTFLAGS := env("RUSTFLAGS", if os() == "windows" { "-C target-cpu=native" } else { "" })

just := just_executable()

# List available ay-vercel recipes
default:
    @{{ just }} --list

# Run full polyglot verification (privacy gate, forks/submodules, tsc-ts/Bun/Turbo, skills/MCP/docs audit, Python, Rust)
check: private-gate forks-check submodules-check bun-check vercel-audit py-check rust-check

# Verify forks.toml manifest schema and group structure
forks-check:
    bun tools/forks.ts --check

# Create and harden any missing aphrody-labs Vercel/Vercel-Labs forks
forks-ensure:
    bun tools/forks.ts --ensure

# Harden all existing mirror forks (disable issues/wiki/projects/actions)
forks-harden:
    bun tools/forks.ts --harden

# Merge upstream across all aphrody-labs forks and update 160000 gitlinks + ledger
sync:
    bun tools/sync.ts --apply

# Verify .gitmodules and 160000 gitlinks match forks.toml
submodules-check:
    bun tools/submodules.ts --check

# Selectively shallow-checkout submodules by path, group, or fork name
submodules-init +paths:
    bun tools/submodules.ts --init {{ paths }}

# Fetch and merge all official Vercel & Vercel-Labs skills into skills/ and .well-known/agent-skills/index.json
skills-sync:
    bun tools/skills-sync.ts --fetch

# Index and verify Vercel MCP configs and cached tool schemas
mcp-sync:
    bun tools/mcp-sync.ts

# Mirror official Vercel documentation pages into docs/vercel/
docs-sync:
    bun tools/docs-sync.ts

# Run tsc, tsc-ts (Vercel Labs native TS compiler), and Bun test suite
bun-check:
    bun x tsc --noEmit
    bun x tsc-ts -p tsconfig.json
    bun test packages tools

# Build workspace packages with Turborepo and compile native binary with scriptc
turbo-build:
    bun x turbo run typecheck
    bun run --cwd packages/vercel-native build

# Audit ay-vercel.toml, MCP catalog, vercel.json, skills SHA-256 index, and docs manifest
vercel-audit:
    bun tools/audit.ts --strict
    bun tools/skills-sync.ts --check
    bun tools/mcp-sync.ts --check
    bun tools/docs-sync.ts --check

# Run Rust fmt, clippy (-D warnings), and workspace unit tests
rust-check:
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets -- -D warnings
    cargo test --workspace

# Run Python Ruff lint/format checks and pytest suite via uv
py-check:
    uv run ruff check python
    uv run ruff format --check python
    uv run pytest

# Run C++23 Abseil + GoogleTest suite with Bazel 9
cpp-check:
    bazelisk test //cpp/...

# Ensure zero private tokens, IDs, emails, or local paths in tracked files
private-gate:
    bun tools/private-gate.ts

# Clean ephemeral build and cache artifacts
clean:
    bun -e "import { rmSync } from 'node:fs'; for (const d of ['target', '.turbo', '.pytest_cache', '.ruff_cache', 'apps/web/.next', 'packages/vercel-native/dist']) rmSync(d, { recursive: true, force: true });"
