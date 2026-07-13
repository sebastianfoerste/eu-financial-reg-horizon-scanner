import { NextResponse } from "next/server";

import { requireOperator } from "@/lib/authz";
import {
  loadPersistedResearchWorkspace,
  mutateResearchWorkspace,
  ReviewConflictError,
} from "@/lib/collaboration-persistence";

export async function GET() {
  return NextResponse.json(await loadPersistedResearchWorkspace(await requireOperator()));
}

export async function POST(request: Request) {
  try {
    const operator = await requireOperator();
    return NextResponse.json(await mutateResearchWorkspace({ ...await request.json(), operator }));
  } catch (error) {
    const status = error instanceof ReviewConflictError ? 409 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research mutation failed" },
      { status },
    );
  }
}
