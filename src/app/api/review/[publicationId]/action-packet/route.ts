import { requireInternalOperator } from "@/lib/authz";
import { assertDemoModeAllowed, hasDatabaseUrl } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { getPublicationParagraphDiffs } from "@/lib/publications";
import { buildRegulatoryActionPacket, type RegulatoryActionProofSummary } from "@/lib/regulatory-action-packet";
import { getReviewItem } from "@/lib/review";
import { listSourceDiligence } from "@/lib/source-diligence";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ publicationId: string }> }) {
  const operator = await requireInternalOperator();
  const { publicationId } = await context.params;
  const organisationId = operator.mode === "clerk" ? (operator.organisationId ?? undefined) : undefined;
  const item = await getReviewItem(publicationId, organisationId);

  if (!item) {
    return Response.json({ error: "Review item not found." }, { status: 404 });
  }
  if (item.status !== "APPROVED") {
    return Response.json({ error: "Action packet JSON is exposed only for approved review items." }, { status: 409 });
  }

  const [diligence, proofPackets, paragraphDiffs] = await Promise.all([
    listSourceDiligence(),
    listProofPacketsForPublication(item.publication.id),
    getPublicationParagraphDiffs(item.publication.id),
  ]);

  return Response.json(
    buildRegulatoryActionPacket({
      reviewItem: item,
      sourceDiligence: diligence.find((record) => record.sourceCode === item.publication.sourceCode),
      alertProofPackets: proofPackets,
      paragraphDiffs,
    }),
  );
}

async function listProofPacketsForPublication(publicationId: string): Promise<RegulatoryActionProofSummary[]> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return [];
  }

  const packets = await getPrisma().alertProofPacket.findMany({
    where: {
      alert: {
        publicationId,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return packets.map((packet) => ({
    gateStatus: packet.gateStatus,
    sourceReviewState: packet.sourceReviewState,
    payloadDigest: packet.payloadDigest,
    reasons: packet.reasons,
    createdAt: packet.createdAt.toISOString(),
  }));
}
