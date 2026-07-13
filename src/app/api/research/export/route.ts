import { NextResponse } from "next/server";

import { requireOperator } from "@/lib/authz";
import { loadApprovedBriefExport } from "@/lib/legora-persistence";

export async function GET(request: Request) {
  try {
    const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "markdown";
    const result = await loadApprovedBriefExport(await requireOperator(), format);
    const body = typeof result.body === "string"
      ? result.body
      : new Uint8Array(result.body).buffer;
    return new Response(body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename=reviewed-regulatory-brief.${format === "docx" ? "docx" : "md"}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Brief export failed" },
      { status: 409 },
    );
  }
}
