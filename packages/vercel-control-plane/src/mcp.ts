import { z } from "zod";

export const McpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  transport: z.enum(["http", "stdio"]),
  url: z.string().url().optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).default([]),
  auth: z.enum(["oauth-cimd", "none", "bearer"]),
  upstream: z.string().min(3),
  fork: z.string().min(3),
  description: z.string().min(1),
});

export const McpPackageSchema = z.object({
  id: z.string().min(1),
  package: z.string().min(1).optional(),
  upstream: z.string().min(3),
  fork: z.string().min(3),
  description: z.string().min(1),
});

export const McpCatalogSchema = z.object({
  server: z.array(McpServerSchema).min(1),
  sdk: z.array(McpPackageSchema).default([]),
  starter: z.array(McpPackageSchema).default([]),
});

export type McpCatalog = z.infer<typeof McpCatalogSchema>;

export function loadMcpCatalog(tomlText: string): McpCatalog {
  return McpCatalogSchema.parse(Bun.TOML.parse(tomlText));
}
