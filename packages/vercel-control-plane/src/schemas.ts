import { z } from "zod";

export const VercelFinOpsPolicySchema = z.object({
  hobby_included_fast_data_transfer_gb: z.number().nonnegative(),
  hobby_included_edge_requests: z.number().int().positive(),
  hobby_included_function_invocations: z.number().int().positive(),
  hobby_included_active_cpu_hours: z.number().nonnegative(),
  hobby_included_provisioned_memory_gb_hours: z.number().nonnegative(),
  pro_base_seat_usd: z.number().nonnegative(),
  pro_included_fast_data_transfer_gb: z.number().nonnegative(),
  pro_included_edge_requests: z.number().int().positive(),
  pro_extra_data_transfer_per_gb_usd: z.number().nonnegative(),
  pro_extra_edge_requests_per_million_usd: z.number().nonnegative(),
  pro_active_cpu_per_hour_usd: z.number().nonnegative(),
  pro_provisioned_memory_per_gb_hour_usd: z.number().nonnegative(),
  default_max_duration_seconds: z.number().int().min(1).max(900),
  default_memory_mb: z.number().int().min(128).max(4096),
});

export const VercelProjectContractSchema = z.object({
  name: z.string().min(1),
  framework: z.string().min(1),
  production_url: z.string().url().optional(),
  node_version: z.string().regex(/^\d+\.x$/),
  fluid_compute: z.boolean().default(true),
});

export const AyVercelManifestSchema = z.object({
  product: z.object({
    name: z.string().min(1),
    repo: z.string().min(1),
    fork_org: z.string().min(1),
    upstream_orgs: z.array(z.string().min(1)).min(1),
    description: z.string().min(1),
  }),
  plans: z.object({
    tier: z.enum(["hobby", "pro", "enterprise"]),
    fluid_compute: z.boolean(),
    bun_runtime: z.boolean(),
    agentic_infra: z.boolean(),
  }),
  finops: VercelFinOpsPolicySchema,
  team: z.object({
    slug: z.string().min(1),
    default_node_version: z.string().regex(/^\d+\.x$/),
  }),
  project: z.array(VercelProjectContractSchema).default([]),
  sync: z.object({
    schedule_cron: z.string().min(5),
    branch: z.string().min(1),
    auto_merge: z.boolean(),
    merge_method: z.enum(["squash", "rebase", "merge"]),
    labels: z.array(z.string().min(1)).min(1),
  }),
  docs: z.object({
    sitemap_url: z.string().url(),
    taxonomy_url: z.string().url(),
    graph_url: z.string().url(),
    local_dir: z.string().min(1),
  }),
  skills: z.object({
    local_dir: z.string().min(1),
    well_known_index: z.string().min(1),
    registry_file: z.string().min(1),
    sources: z.array(z.string().min(3)).min(1),
  }),
});

export type AyVercelManifest = z.infer<typeof AyVercelManifestSchema>;

export const VercelJsonSchema = z.object({
  $schema: z.string().optional(),
  framework: z.string().optional(),
  bunVersion: z.string().optional(),
  fluid: z.boolean().optional(),
  crons: z
    .array(
      z.object({
        path: z.string().startsWith("/"),
        schedule: z.string().min(5),
      }),
    )
    .optional(),
  functions: z
    .record(
      z.string(),
      z.object({
        runtime: z.string().optional(),
        memory: z.number().int().min(128).max(4096).optional(),
        maxDuration: z.number().int().min(1).max(900).optional(),
      }),
    )
    .optional(),
});

export function auditVercelJson(raw: string): string[] {
  const cfg = VercelJsonSchema.parse(JSON.parse(raw));
  const issues: string[] = [];
  if (cfg.fluid === false) {
    issues.push("fluid compute should remain enabled unless a legacy runtime disables it");
  }
  for (const [glob, fn] of Object.entries(cfg.functions ?? {})) {
    if (fn.maxDuration && fn.maxDuration > 300) {
      issues.push(`${glob}: maxDuration=${fn.maxDuration}s exceeds 300s Fluid Compute Hobby/default guard`);
    }
  }
  return issues;
}
