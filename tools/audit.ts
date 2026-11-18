#!/usr/bin/env bun
// Offline CI/dev audit: validates ay-vercel.toml, mcp/catalog.toml, apps/web/vercel.json,
// skills/REGISTRY.json, docs/vercel/MANIFEST.json, and /.well-known/agent-skills/index.json.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AyVercelManifestSchema,
  SkillsRegistrySchema,
  WellKnownSkillsIndexSchema,
  auditVercelJson,
  loadMcpCatalog,
} from "../packages/vercel-control-plane/src/index.ts";

const root = resolve(import.meta.dir, "..");
const errors: string[] = [];

try {
  AyVercelManifestSchema.parse(Bun.TOML.parse(await Bun.file(join(root, "ay-vercel.toml")).text()));
} catch (err) {
  errors.push(`ay-vercel.toml invalid: ${(err as Error).message}`);
}

try {
  loadMcpCatalog(await Bun.file(join(root, "mcp/catalog.toml")).text());
} catch (err) {
  errors.push(`mcp/catalog.toml invalid: ${(err as Error).message}`);
}

try {
  const vj = await Bun.file(join(root, "apps/web/vercel.json")).text();
  errors.push(...auditVercelJson(vj));
} catch (err) {
  errors.push(`apps/web/vercel.json invalid: ${(err as Error).message}`);
}

const idxPath = join(root, ".well-known/agent-skills/index.json");
if (!existsSync(idxPath)) {
  errors.push("Missing .well-known/agent-skills/index.json");
} else {
  try {
    const idx = WellKnownSkillsIndexSchema.parse(JSON.parse(readFileSync(idxPath, "utf8")));
    for (const s of idx.skills) {
      const f = join(root, s.url.replace(/^\//, ""));
      if (!existsSync(f)) {
        errors.push(`Skill index points to missing file: ${s.url}`);
        continue;
      }
      const sha = new Bun.CryptoHasher("sha256").update(new Uint8Array(readFileSync(f))).digest("hex");
      if (sha !== s.sha256) errors.push(`SHA-256 mismatch on ${s.url}`);
    }
  } catch (err) {
    errors.push(`.well-known/agent-skills/index.json invalid: ${(err as Error).message}`);
  }
}

const regPath = join(root, "skills/REGISTRY.json");
if (!existsSync(regPath)) {
  errors.push("Missing skills/REGISTRY.json");
} else {
  try {
    SkillsRegistrySchema.parse(JSON.parse(readFileSync(regPath, "utf8")));
  } catch (err) {
    errors.push(`skills/REGISTRY.json invalid: ${(err as Error).message}`);
  }
}

const docsManifestPath = join(root, "docs/vercel/MANIFEST.json");
if (!existsSync(docsManifestPath)) {
  errors.push("Missing docs/vercel/MANIFEST.json");
} else {
  try {
    const dm = JSON.parse(readFileSync(docsManifestPath, "utf8")) as {
      pages: Array<{ file: string; sha256: string }>;
    };
    for (const p of dm.pages) {
      const f = join(root, p.file);
      if (!existsSync(f)) {
        errors.push(`Docs manifest points to missing file: ${p.file}`);
        continue;
      }
      const sha = new Bun.CryptoHasher("sha256").update(new Uint8Array(readFileSync(f))).digest("hex");
      if (sha !== p.sha256) errors.push(`SHA-256 mismatch on ${p.file}`);
    }
  } catch (err) {
    errors.push(`docs/vercel/MANIFEST.json invalid: ${(err as Error).message}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`AUDIT FAIL: ${e}`);
  process.exit(1);
}
console.log(
  "Audit passed: ay-vercel.toml, mcp/catalog.toml, apps/web/vercel.json, skills index, registry, and docs manifest verified.",
);
