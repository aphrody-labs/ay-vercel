// Native-compilable summary utility targeting Vercel Labs `scriptc`.

export interface StackEntry {
  layer: string;
  packageName: string;
}

export const VERCEL_NATIVE_STACK: StackEntry[] = [
  { layer: "typechecker", packageName: "tsc-ts" },
  { layer: "native-compiler", packageName: "scriptc" },
  { layer: "monorepo", packageName: "turbo" },
  { layer: "framework", packageName: "next" },
  { layer: "ai", packageName: "ai" },
  { layer: "mcp", packageName: "mcp-handler" },
  { layer: "cli", packageName: "vercel" },
];

export function formatStackSummary(entries: StackEntry[]): string {
  const lines: string[] = ["ay-vercel native stack:"];
  for (const entry of entries) {
    lines.push("  - " + entry.layer + ": " + entry.packageName);
  }
  return lines.join("\n");
}

console.log(formatStackSummary(VERCEL_NATIVE_STACK));
