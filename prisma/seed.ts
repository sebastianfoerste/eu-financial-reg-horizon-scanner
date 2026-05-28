import { getTierOneAdapters } from "@/lib/ingestion/adapters";
import { syncSources, syncTaxonomyConfig, upsertCanonicalPublication } from "@/lib/ingestion/store";
import type { CanonicalPublication } from "@/lib/ingestion/types";
import { recalculateImpactScores } from "@/lib/impact-recalculation";
import { mockPublications } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";
import { seedDefaultSavedViews } from "@/lib/saved-views";
import { loadScoringRules } from "@/lib/scoring-rules";

async function main() {
  const prisma = getPrisma();
  const seededConfirmationAt = new Date("2026-05-27T00:00:00.000Z");
  const seededConfirmationDueAt = new Date("2026-08-27T00:00:00.000Z");
  await syncTaxonomyConfig();
  await syncSources(getTierOneAdapters());
  await seedDefaultSavedViews();

  const organisation = await prisma.organisation.upsert({
    where: { id: "org_design_partner" },
    update: {
      name: "Design Partner CASP",
      tier: "BOUTIQUE",
    },
    create: {
      id: "org_design_partner",
      name: "Design Partner CASP",
      legalName: "Design Partner CASP GmbH",
      registeredSeat: "Berlin, Germany",
      tier: "BOUTIQUE",
    },
  });

  const fixtureUser = await prisma.user.upsert({
    where: { id: "user_design_partner_reviewer" },
    update: {
      email: "reviewer@example.test",
      name: "Pilot Reviewer",
      isInternalOperator: true,
    },
    create: {
      id: "user_design_partner_reviewer",
      email: "reviewer@example.test",
      name: "Pilot Reviewer",
      authProvider: "fixture",
      isInternalOperator: true,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organisationId: {
        userId: fixtureUser.id,
        organisationId: organisation.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      userId: fixtureUser.id,
      organisationId: organisation.id,
      role: "OWNER",
    },
  });

  const productMap = await prisma.productMap.upsert({
    where: { id: "pm_design_partner_main" },
    update: {
      name: "EU crypto and payments footprint",
      isActive: true,
      topicWatchlist: loadScoringRules().topic_watchlist,
      confirmationRequired: false,
      lastConfirmedAt: seededConfirmationAt,
      nextConfirmationDueAt: seededConfirmationDueAt,
      confirmedByName: "Pilot Reviewer",
    },
    create: {
      id: "pm_design_partner_main",
      organisationId: organisation.id,
      name: "EU crypto and payments footprint",
      topicWatchlist: loadScoringRules().topic_watchlist,
      confirmationRequired: false,
      lastConfirmedAt: seededConfirmationAt,
      nextConfirmationDueAt: seededConfirmationDueAt,
      confirmedByName: "Pilot Reviewer",
      notes: "Seeded MVP product map for local impact-score previews.",
    },
  });

  await prisma.licence.upsert({
    where: { id: "lic_design_partner_casp" },
    update: {
      licenceType: "casp_micar",
      issuingAuthority: "bafin",
    },
    create: {
      id: "lic_design_partner_casp",
      productMapId: productMap.id,
      licenceType: "casp_micar",
      issuingAuthority: "bafin",
      status: "ACTIVE",
    },
  });

  await prisma.productLine.upsert({
    where: { id: "pl_design_partner_exchange" },
    update: {
      name: "Crypto exchange and custody",
      activities: ["exchange_crypto_for_fiat", "custody_safekeeping_crypto"],
      customerSegment: ["RETAIL", "PROFESSIONAL"],
    },
    create: {
      id: "pl_design_partner_exchange",
      productMapId: productMap.id,
      name: "Crypto exchange and custody",
      activities: ["exchange_crypto_for_fiat", "custody_safekeeping_crypto"],
      customerSegment: ["RETAIL", "PROFESSIONAL"],
      isCritical: true,
    },
  });

  await prisma.productMapJurisdiction.upsert({
    where: {
      productMapId_jurisdictionCode: {
        productMapId: productMap.id,
        jurisdictionCode: "de",
      },
    },
    update: {
      authority: "bafin",
      isHomeMember: true,
      isPassportedInto: false,
    },
    create: {
      productMapId: productMap.id,
      jurisdictionCode: "de",
      authority: "bafin",
      isHomeMember: true,
      isPassportedInto: false,
    },
  });

  await prisma.productMapJurisdiction.upsert({
    where: {
      productMapId_jurisdictionCode: {
        productMapId: productMap.id,
        jurisdictionCode: "eu",
      },
    },
    update: {
      authority: "esma",
      isHomeMember: false,
      isPassportedInto: true,
    },
    create: {
      productMapId: productMap.id,
      jurisdictionCode: "eu",
      authority: "esma",
      isHomeMember: false,
      isPassportedInto: true,
    },
  });

  for (const publication of mockPublications) {
    const saved = await upsertCanonicalPublication({
      sourceCode: publication.sourceCode,
      sourceUrl: publication.sourceUrl,
      canonicalUrl: publication.sourceUrl,
      externalId: publication.id,
      title: publication.title,
      publishedAt: publication.publishedAt ? new Date(publication.publishedAt) : null,
      fetchedAt: new Date(publication.fetchedAt),
      language: publication.language,
      publicationType: publication.publicationType,
      rawHash: publication.rawHash,
      bodyText: publication.bodyText,
      sourceMetadataJson: { seed: true },
    } satisfies CanonicalPublication);

    const savedPublication = await prisma.publication.findUnique({
      where: { id: saved.publicationId },
    });

    if (!savedPublication) continue;

    await prisma.reviewQueueItem.upsert({
      where: { publicationId: savedPublication.id },
      update: {
        status: publication.id === "pub-esma-qa-2845" ? "APPROVED" : "PENDING",
        reviewerName: publication.id === "pub-esma-qa-2845" ? "Sebastian" : null,
        decisionReason: publication.id === "pub-esma-qa-2845" ? "Seeded pilot-approved review item." : null,
        decidedAt: publication.id === "pub-esma-qa-2845" ? new Date() : null,
      },
      create: {
        publicationId: savedPublication.id,
        status: publication.id === "pub-esma-qa-2845" ? "APPROVED" : "PENDING",
        priority: publication.impactScore,
        reviewerName: publication.id === "pub-esma-qa-2845" ? "Sebastian" : null,
        decisionReason: publication.id === "pub-esma-qa-2845" ? "Seeded pilot-approved review item." : null,
        decidedAt: publication.id === "pub-esma-qa-2845" ? new Date() : null,
      },
    });

    await prisma.impactScore.upsert({
      where: {
        publicationId_productMapId: {
          publicationId: savedPublication.id,
          productMapId: productMap.id,
        },
      },
      update: {
        organisationId: organisation.id,
        score: publication.impactScore,
        bucket: publication.impactBucket,
        rationale: publication.summary,
        matchedLicences: publication.tags.licenceTypes,
        matchedActivities: publication.tags.activities,
        matchedJurisdictions: publication.tags.jurisdictions,
        ruleVersion: "mvp-seed-v0",
      },
      create: {
        publicationId: savedPublication.id,
        organisationId: organisation.id,
        productMapId: productMap.id,
        score: publication.impactScore,
        bucket: publication.impactBucket,
        rationale: publication.summary,
        matchedLicences: publication.tags.licenceTypes,
        matchedActivities: publication.tags.activities,
        matchedJurisdictions: publication.tags.jurisdictions,
        ruleVersion: "mvp-seed-v0",
      },
    });
  }

  for (const source of await prisma.source.findMany()) {
    const freshnessAt = new Date();
    const reuseStatus =
      source.code === "eurlex"
        ? "REUSE_PERMITTED"
        : source.code === "bundesbank"
          ? "REVIEW_REQUIRED"
          : "ATTRIBUTION_REQUIRED";
    await prisma.sourceDiligence.upsert({
      where: { sourceId: source.id },
      update: {
        reuseStatus,
        attributionRequirement: `Attribute ${source.displayName} and link to the original publication.`,
        robotsNotes: "Use conditional requests, fixture-backed parsing, and conservative cadence.",
        allowedCadenceMin: source.pollIntervalMin,
        lastReviewedAt: new Date("2026-05-20T00:00:00.000Z"),
        nextReviewAt: new Date("2026-08-20T00:00:00.000Z"),
      },
      create: {
        sourceId: source.id,
        reuseStatus,
        attributionRequirement: `Attribute ${source.displayName} and link to the original publication.`,
        robotsNotes: "Use conditional requests, fixture-backed parsing, and conservative cadence.",
        allowedCadenceMin: source.pollIntervalMin,
        lastReviewedAt: new Date("2026-05-20T00:00:00.000Z"),
        nextReviewAt: new Date("2026-08-20T00:00:00.000Z"),
      },
    });
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastFetchedAt: freshnessAt,
        adapterStatusJson: { status: "OK", seeded: true },
      },
    });
    await prisma.fetchRun.deleteMany({
      where: {
        sourceId: source.id,
        errorMessage: "Seeded fixture freshness marker.",
      },
    });
    await prisma.fetchRun.create({
      data: {
        sourceId: source.id,
        startedAt: freshnessAt,
        finishedAt: freshnessAt,
        status: "OK",
        publicationsSeen: 0,
        errorMessage: "Seeded fixture freshness marker.",
      },
    });
  }

  for (const provider of ["RESEND", "SLACK", "MS_TEAMS", "HUBSPOT"] as const) {
    await prisma.integrationConfig.upsert({
      where: {
        organisationId_provider: {
          organisationId: organisation.id,
          provider,
        },
      },
      update: {
        displayName: provider,
        status: "DISABLED",
        nonSecretConfigJson: { seeded: true },
      },
      create: {
        organisationId: organisation.id,
        provider,
        displayName: provider,
        status: "DISABLED",
        nonSecretConfigJson: { seeded: true },
      },
    });
  }

  await recalculateImpactScores(organisation.id);

  console.log("Seeded taxonomy, Tier 1 sources, design partner, product map, and demo publications.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
