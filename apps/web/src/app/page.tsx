const MAIN_STYLE = {
  fontFamily: "system-ui, sans-serif",
  padding: "2rem",
  maxWidth: "72rem",
  margin: "0 auto",
} as const;

export default function HomePage() {
  return (
    <main style={MAIN_STYLE}>
      <h1>ay-vercel</h1>
      <p>
        Unified Vercel &amp; Vercel-Labs ecosystem hub for Aphrody Labs: upstream forks, agent skills,
        official MCP server catalog, Turborepo builds, Next.js App Router, and scriptc native compilation.
      </p>
      <ul>
        <li><a href="/api/health">Fluid Compute &amp; Flags Health</a></li>
        <li><a href="/api/mcp">Streamable HTTP MCP Endpoint</a></li>
      </ul>
    </main>
  );
}
