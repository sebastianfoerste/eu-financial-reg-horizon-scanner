import { applyAgentArtifact } from "@/lib/agents/runner";
import { getActiveOrganisationId, requireInternalOperator } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const operator = await requireInternalOperator();
  const organisationId = await getActiveOrganisationId();
  const params = await context.params;
  const result = await applyAgentArtifact({
    artifactId: params.id,
    reviewedById: operator.userId,
    organisationId,
  });
  return Response.json(result);
}
