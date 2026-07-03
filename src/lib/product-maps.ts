import type { Prisma } from "@prisma/client";

import { assertDemoModeAllowed, hasDatabaseUrl } from "@/lib/env";
import type { ProductMapFootprint } from "@/lib/impact-scoring";
import { getPrisma } from "@/lib/prisma";
import { assessProductMapDeliveryReadiness, nextProductMapConfirmationDate } from "@/lib/product-map-assurance";
import { loadScoringRules } from "@/lib/scoring-rules";

const demoConfirmedAt = new Date("2026-05-27T00:00:00.000Z");

export const demoProductMap: ProductMapFootprint = {
  id: "demo-product-map-casp",
  organisationId: "demo-org",
  name: "EU CASP and payments footprint",
  topicWatchlist: loadScoringRules().topic_watchlist,
  licences: [
    { id: "demo-licence-casp", licenceType: "casp_micar", issuingAuthority: "bafin", status: "ACTIVE" },
    { id: "demo-licence-pi", licenceType: "payment_institution_psd", issuingAuthority: "bafin", status: "APPLIED" },
  ],
  productLines: [
    {
      id: "demo-line-crypto",
      name: "Crypto exchange and custody",
      activities: ["exchange_crypto_for_fiat", "custody_safekeeping_crypto", "transfer_services_crypto"],
      customerSegment: ["RETAIL", "PROFESSIONAL"],
      isCritical: true,
    },
    {
      id: "demo-line-payments",
      name: "Payment initiation",
      activities: ["payment_initiation", "account_information"],
      customerSegment: ["CORPORATE"],
      isCritical: false,
    },
  ],
  jurisdictions: [
    {
      id: "demo-jurisdiction-de",
      jurisdictionCode: "de",
      authority: "bafin",
      isHomeMember: true,
      isPassportedInto: false,
    },
    {
      id: "demo-jurisdiction-eu",
      jurisdictionCode: "eu",
      authority: "esma",
      isHomeMember: false,
      isPassportedInto: true,
    },
  ],
};

type DbProductMap = Prisma.ProductMapGetPayload<{
  include: {
    organisation: true;
    licences: true;
    productLines: true;
    jurisdictions: true;
  };
}>;

function mapDbProductMap(productMap: DbProductMap): ProductMapFootprint & {
  organisationName: string;
  updatedAt: string;
  confirmationRequired: boolean;
  lastConfirmedAt: string | null;
  nextConfirmationDueAt: string | null;
  confirmedByName: string | null;
} {
  return {
    id: productMap.id,
    organisationId: productMap.organisationId,
    organisationName: productMap.organisation.name,
    name: productMap.name,
    topicWatchlist: productMap.topicWatchlist,
    updatedAt: productMap.updatedAt.toISOString(),
    confirmationRequired: productMap.confirmationRequired,
    lastConfirmedAt: productMap.lastConfirmedAt?.toISOString() ?? null,
    nextConfirmationDueAt: productMap.nextConfirmationDueAt?.toISOString() ?? null,
    confirmedByName: productMap.confirmedByName,
    licences: productMap.licences.map((licence) => ({
      id: licence.id,
      licenceType: licence.licenceType,
      issuingAuthority: licence.issuingAuthority,
      licenceReference: licence.licenceReference,
      status: licence.status,
    })),
    productLines: productMap.productLines.map((line) => ({
      id: line.id,
      name: line.name,
      activities: line.activities,
      customerSegment: line.customerSegment,
      isCritical: line.isCritical,
    })),
    jurisdictions: productMap.jurisdictions.map((jurisdiction) => ({
      id: jurisdiction.id,
      jurisdictionCode: jurisdiction.jurisdictionCode,
      authority: jurisdiction.authority,
      isHomeMember: jurisdiction.isHomeMember,
      isPassportedInto: jurisdiction.isPassportedInto,
    })),
  };
}

export type ProductMapView = ReturnType<typeof mapDbProductMap>;

export async function listProductMaps(organisationId?: string): Promise<ProductMapView[]> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return [
      {
        ...demoProductMap,
        organisationName: "Demo organisation",
        updatedAt: new Date().toISOString(),
        confirmationRequired: false,
        lastConfirmedAt: demoConfirmedAt.toISOString(),
        nextConfirmationDueAt: nextProductMapConfirmationDate(demoConfirmedAt).toISOString(),
        confirmedByName: "Demo reviewer",
      },
    ];
  }

  const prisma = getPrisma();
  const productMaps = await prisma.productMap.findMany({
    where: { isActive: true, organisationId },
    orderBy: { updatedAt: "desc" },
    include: {
      organisation: true,
      licences: true,
      productLines: true,
      jurisdictions: true,
    },
  });

  return productMaps.map(mapDbProductMap);
}

export async function getProductMap(id: string, organisationId?: string): Promise<ProductMapView | null> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return id === demoProductMap.id
      ? {
          ...demoProductMap,
          organisationName: "Demo organisation",
          updatedAt: new Date().toISOString(),
          confirmationRequired: false,
          lastConfirmedAt: demoConfirmedAt.toISOString(),
          nextConfirmationDueAt: nextProductMapConfirmationDate(demoConfirmedAt).toISOString(),
          confirmedByName: "Demo reviewer",
        }
      : null;
  }

  const prisma = getPrisma();
  const productMap = await prisma.productMap.findFirst({
    where: { id, organisationId },
    include: {
      organisation: true,
      licences: true,
      productLines: true,
      jurisdictions: true,
    },
  });

  return productMap ? mapDbProductMap(productMap) : null;
}

export async function getProductMapDeliveryReadiness(organisationId?: string) {
  return assessProductMapDeliveryReadiness(await listProductMaps(organisationId));
}
