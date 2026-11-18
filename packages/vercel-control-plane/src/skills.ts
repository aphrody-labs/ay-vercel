import { z } from "zod";

export const SkillIndexEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
});

export const WellKnownSkillsIndexSchema = z.object({
  $schema: z.string().url(),
  generated_at: z.string().min(10),
  skills: z.array(SkillIndexEntrySchema),
});

export const SkillProvenanceEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  source_repo: z.string().min(3),
  source_path: z.string().min(1),
  local_path: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
});

export const SkillsRegistrySchema = z.object({
  generated_at: z.string().min(10),
  total: z.number().int().nonnegative(),
  skills: z.array(SkillProvenanceEntrySchema),
});

export type WellKnownSkillsIndex = z.infer<typeof WellKnownSkillsIndexSchema>;
export type SkillsRegistry = z.infer<typeof SkillsRegistrySchema>;
