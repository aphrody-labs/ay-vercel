import { NextResponse } from "next/server";
import { agenticDocsEnabled } from "@/flags";

export async function GET() {
  const docsEnabled = await agenticDocsEnabled();
  return NextResponse.json({
    ok: true,
    service: "ay-vercel",
    fluidCompute: true,
    docsEnabled,
  });
}
