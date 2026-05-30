import { z } from "zod";

import { isAgentKind } from "@/lib/agents/policy";
import { runAgent } from "@/lib/agents/runner";
import { getActiveOrganisationId, requireInternalOperator } from "@/lib/authz";

export const dynamic = "force-dynamic";

const RunAgentSchema = z.object({
  kind: z.string().refine(isAgentKind, "Unknown agent kind"),
  publicationId: z.string().optional().nullable(),
  limit: z.number().int().positive().max(50).optional(),
});

export async function POST(request: Request) {
  const operator = await requireInternalOperator();
  const organisationId = await getActiveOrganisationId();
  const body = RunAgentSchema.parse(await request.json());
  const result = await runAgent({
    kind: body.kind,
    trigger: "api",
    organisationId,
    triggeredByUserId: operator.userId,
    publicationId: body.publicationId ?? null,
    limit: body.limit,
  });

  return Response.json(result);
}
