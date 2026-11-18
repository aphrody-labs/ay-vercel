import { flag } from "flags/next";

export const agenticDocsEnabled = flag<boolean>({
  key: "agentic-docs-enabled",
  description: "Expose machine-readable skills and MCP catalog routes",
  defaultValue: true,
  decide: () => true,
});
