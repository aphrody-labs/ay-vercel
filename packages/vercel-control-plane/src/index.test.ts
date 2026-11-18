import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  AyVercelManifestSchema,
  auditVercelJson,
  estimateProMonthlyCost,
  loadMcpCatalog,
} from "./index.ts";

const root = resolve(import.meta.dir, "../../..");

describe("@aphrody/vercel-control-plane", () => {
  test("validates ay-vercel.toml and Fluid Compute FinOps estimator", async () => {
    const raw = Bun.TOML.parse(await Bun.file(resolve(root, "ay-vercel.toml")).text());
    const manifest = AyVercelManifestSchema.parse(raw);
    expect(manifest.product.name).toBe("ay-vercel");
    expect(manifest.product.fork_org).toBe("aphrody-labs");
    expect(manifest.sync.auto_merge).toBe(true);
    expect(manifest.project.length).toBeGreaterThanOrEqual(3);

    const low = estimateProMonthlyCost(manifest, {
      fastDataTransferGb: 400,
      edgeRequests: 5_000_000,
      activeCpuHours: 10,
      provisionedMemoryGbHours: 200,
    });
    const high = estimateProMonthlyCost(manifest, {
      fastDataTransferGb: 2_500,
      edgeRequests: 30_000_000,
      activeCpuHours: 80,
      provisionedMemoryGbHours: 900,
    });
    expect(high.totalUsd).toBeGreaterThan(low.totalUsd);
    expect(low.dataTransferOverageUsd).toBe(0);
  });

  test("validates mcp/catalog.toml official Vercel MCP servers and SDKs", async () => {
    const catalog = loadMcpCatalog(await Bun.file(resolve(root, "mcp/catalog.toml")).text());
    expect(catalog.server.some((s) => s.id === "vercel" && s.url === "https://mcp.vercel.com")).toBe(
      true,
    );
    expect(catalog.server.some((s) => s.id === "next-devtools")).toBe(true);
    expect(catalog.sdk.some((s) => s.id === "mcp-handler")).toBe(true);
  });

  test("audits apps/web/vercel.json Fluid Compute config", async () => {
    const raw = await Bun.file(resolve(root, "apps/web/vercel.json")).text();
    expect(auditVercelJson(raw)).toEqual([]);
  });
});
