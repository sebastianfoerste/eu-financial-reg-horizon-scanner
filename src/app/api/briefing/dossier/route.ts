import { NextResponse } from "next/server";

import { listAlerts } from "@/lib/alerts";
import { getActiveOrganisationId } from "@/lib/authz";
import { buildBriefingDossier } from "@/lib/briefing-dossier";
import { buildPilotBriefing } from "@/lib/pilot-briefing";
import { getProductMapDeliveryReadiness, listProductMaps } from "@/lib/product-maps";
import { listPublications } from "@/lib/publications";
import { listReviewQueue } from "@/lib/review";
import { listSourceDiligence } from "@/lib/source-diligence";
import { summarizeSourceFreshness } from "@/lib/source-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const organisationId = await getActiveOrganisationId();
  const [publications, reviewItems, alerts, sourceDiligence, productMapReadiness, productMaps] =
    await Promise.all([
      listPublications({}, organisationId),
      listReviewQueue(organisationId),
      listAlerts(organisationId),
      listSourceDiligence(),
      getProductMapDeliveryReadiness(organisationId),
      listProductMaps(organisationId),
    ]);
  const sourceFreshness = summarizeSourceFreshness(sourceDiligence);
  const briefing = buildPilotBriefing({
    publications,
    reviewItems,
    alerts,
    sourceFreshness,
    productMapReadiness,
    productMaps,
  });

  return NextResponse.json(
    buildBriefingDossier({ briefing, sourceFreshness, productMapReadiness }),
    {
      headers: {
        "Content-Disposition": "attachment; filename=regulatory-briefing-dossier.json",
      },
    },
  );
}
