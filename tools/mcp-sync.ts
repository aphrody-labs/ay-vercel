#!/usr/bin/env bun
// Validates and indexes Vercel MCP configurations and tool schemas without leaking local paths.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadMcpCatalog } from "../packages/vercel-control-plane/src/index.ts";

const root = resolve(import.meta.dir, "..");
const outPath = join(root, "mcp/vercel-tools-index.json");

export interface VercelMcpToolMeta {
  name: string;
  description: string;
}

function discoverCachedTools(): VercelMcpToolMeta[] {
  const home = Bun.env.USERPROFILE ?? Bun.env.HOME ?? "";
  const cacheDir = join(home, ".gemini", "antigravity-cli", "mcp", "vercel");
  if (!existsSync(cacheDir)) return [];
  const tools: VercelMcpToolMeta[] = [];
  for (const entry of readdirSync(cacheDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(cacheDir, entry.name), "utf8")) as {
        name?: string;
        description?: string;
      };
      if (parsed.name) {
        tools.push({
          name: parsed.name,
          description: (parsed.description ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
        });
      }
    } catch {
      // Ignore malformed cache entries.
    }
  }
  return tools;
}

if (import.meta.main) {
  const catalog = loadMcpCatalog(await Bun.file(join(root, "mcp/catalog.toml")).text());
  const mcpJson = JSON.parse(await Bun.file(join(root, ".mcp.json")).text()) as {
    mcpServers?: Record<string, unknown>;
  };
  if (!mcpJson.mcpServers?.vercel || !mcpJson.mcpServers?.["next-devtools"]) {
    throw new Error(".mcp.json must define both 'vercel' and 'next-devtools' servers");
  }
  const checkOnly = Bun.argv.includes("--check");
  if (checkOnly) {
    if (!existsSync(outPath)) throw new Error("Missing mcp/vercel-tools-index.json");
    const existing = JSON.parse(readFileSync(outPath, "utf8")) as { count: number; tools: VercelMcpToolMeta[] };
    if (existing.count !== existing.tools.length) {
      throw new Error("mcp/vercel-tools-index.json count mismatch");
    }
    console.log(`mcp-sync check OK (${catalog.server.length} servers, ${catalog.sdk.length} SDKs, ${existing.count} tools indexed)`);
    process.exit(0);
  }

  const tools = discoverCachedTools();
  const payload = tools.length
    ? {
        server: "https://mcp.vercel.com",
        generated_at: new Date().toISOString(),
        count: tools.length,
        tools,
      }
    : existsSync(outPath)
      ? JSON.parse(readFileSync(outPath, "utf8"))
      : { server: "https://mcp.vercel.com", generated_at: new Date().toISOString(), count: 0, tools: [] };

  await Bun.write(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Synced mcp/vercel-tools-index.json (${payload.count} tools, ${catalog.server.length} MCP servers)`);
}
