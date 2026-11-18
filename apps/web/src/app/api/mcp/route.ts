import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ay_vercel_status",
      {
        title: "ay-vercel Platform Status",
        description: "Return the ay-vercel platform summary and endpoint metadata",
        inputSchema: z.object({
          section: z.enum(["all", "skills", "mcp", "forks"]).default("all"),
        }),
      },
      async ({ section }) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              product: "ay-vercel",
              org: "aphrody-labs",
              section,
              officialMcp: "https://mcp.vercel.com",
            }),
          },
        ],
      }),
    );
  },
  {
    serverInfo: {
      name: "ay-vercel-mcp",
      version: "0.1.0",
    },
    verboseLogs: false,
  },
);

export { handler as GET, handler as POST };
