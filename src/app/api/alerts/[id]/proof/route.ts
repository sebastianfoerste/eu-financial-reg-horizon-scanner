import { assertOrganisationAccess, requireOperator } from "@/lib/authz";
import { assertDemoModeAllowed, hasDatabaseUrl } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const operator = await requireOperator();

  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return Response.json({
      alertId: params.id,
      proofPackets: [],
      mode: "demo",
      reviewNotice: "Demo mode has no persisted alert proof history.",
    });
  }

  const alert = await getPrisma().alert.findUniqueOrThrow({
    where: { id: params.id },
    select: {
      id: true,
      organisationId: true,
      proofPackets: {
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });
  assertOrganisationAccess(operator, alert.organisationId);

  return Response.json({
    alertId: alert.id,
    proofPackets: alert.proofPackets,
    reviewNotice: "Proof history stores source metadata and payload digests only. It is not a delivery approval by itself.",
  });
}
