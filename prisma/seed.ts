import { getTierOneAdapters } from "@/lib/ingestion/adapters";
import { syncAgentDefinitions } from "@/lib/agents/config";
import { syncSources, syncTaxonomyConfig, upsertCanonicalPublication } from "@/lib/ingestion/store";
import type { CanonicalPublication } from "@/lib/ingestion/types";
import { recalculateImpactScores } from "@/lib/impact-recalculation";
import {
  buildClientBriefBody,
  DEMO_FIRM_ORG_ID,
  demoClients,
  demoMatterProfiles,
  demoPlaybooks,
  demoPracticeGroups,
  scorePublicationForMatter,
} from "@/lib/law-firm";
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
  await syncAgentDefinitions();
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

  const lawFirmOrganisation = await prisma.organisation.upsert({
    where: { id: DEMO_FIRM_ORG_ID },
    update: {
      name: "Law firm mode pilot",
      legalName: "Law firm mode pilot LLP",
      tier: "ENTERPRISE",
      tenantKind: "LAW_FIRM",
    },
    create: {
      id: DEMO_FIRM_ORG_ID,
      name: "Law firm mode pilot",
      legalName: "Law firm mode pilot LLP",
      registeredSeat: "Berlin, Germany",
      tier: "ENTERPRISE",
      tenantKind: "LAW_FIRM",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organisationId: {
        userId: fixtureUser.id,
        organisationId: lawFirmOrganisation.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      userId: fixtureUser.id,
      organisationId: lawFirmOrganisation.id,
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

  const savedPublicationIdsByMockId = new Map<string, string>();

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
    savedPublicationIdsByMockId.set(publication.id, savedPublication.id);

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

  for (const client of demoClients) {
    await prisma.lawFirmClient.upsert({
      where: {
        firmOrganisationId_displayName: {
          firmOrganisationId: lawFirmOrganisation.id,
          displayName: client.displayName,
        },
      },
      update: {
        legalName: client.legalName,
        sector: client.sector,
        relationshipPartnerName: client.relationshipPartnerName,
        responsibleAssociateName: client.responsibleAssociateName,
        confidentialityLevel: client.confidentialityLevel,
        defaultAccessPolicy: client.defaultAccessPolicy,
      },
      create: {
        id: client.id,
        firmOrganisationId: lawFirmOrganisation.id,
        displayName: client.displayName,
        legalName: client.legalName,
        sector: client.sector,
        relationshipPartnerName: client.relationshipPartnerName,
        responsibleAssociateName: client.responsibleAssociateName,
        confidentialityLevel: client.confidentialityLevel,
        defaultAccessPolicy: client.defaultAccessPolicy,
      },
    });
  }

  for (const group of demoPracticeGroups) {
    await prisma.practiceGroup.upsert({
      where: {
        firmOrganisationId_slug: {
          firmOrganisationId: lawFirmOrganisation.id,
          slug: group.slug,
        },
      },
      update: {
        name: group.name,
        focusDescription: group.focusDescription,
        leadPartnerName: group.leadPartnerName,
      },
      create: {
        id: group.id,
        firmOrganisationId: lawFirmOrganisation.id,
        name: group.name,
        slug: group.slug,
        focusDescription: group.focusDescription,
        leadPartnerName: group.leadPartnerName,
      },
    });
  }

  for (const matter of demoMatterProfiles) {
    await prisma.firmMatter.upsert({
      where: {
        firmOrganisationId_matterCode: {
          firmOrganisationId: lawFirmOrganisation.id,
          matterCode: matter.matterCode,
        },
      },
      update: {
        clientId: matter.clientId,
        practiceGroupId: matter.practiceGroupId,
        title: matter.title,
        matterType: matter.matterType,
        status: matter.status,
        sensitivity: matter.sensitivity,
        accessPolicy: matter.accessPolicy,
        relationshipPartnerName: matter.relationshipPartnerName,
        responsibleAssociateName: matter.responsibleAssociateName,
        jurisdictionTags: matter.jurisdictionTags,
        regulationFamilies: matter.regulationFamilies,
        activities: matter.activities,
        licenceTypes: matter.licenceTypes,
        topicPaths: matter.topicPaths,
        openedAt: new Date(matter.openedAt),
        notes: matter.notes,
      },
      create: {
        id: matter.id,
        firmOrganisationId: lawFirmOrganisation.id,
        clientId: matter.clientId,
        practiceGroupId: matter.practiceGroupId,
        matterCode: matter.matterCode,
        title: matter.title,
        matterType: matter.matterType,
        status: matter.status,
        sensitivity: matter.sensitivity,
        accessPolicy: matter.accessPolicy,
        relationshipPartnerName: matter.relationshipPartnerName,
        responsibleAssociateName: matter.responsibleAssociateName,
        jurisdictionTags: matter.jurisdictionTags,
        regulationFamilies: matter.regulationFamilies,
        activities: matter.activities,
        licenceTypes: matter.licenceTypes,
        topicPaths: matter.topicPaths,
        openedAt: new Date(matter.openedAt),
        notes: matter.notes,
      },
    });

    const scoredPublications = mockPublications
      .map((publication) => ({
        publication,
        score: scorePublicationForMatter(publication, matter),
        savedPublicationId: savedPublicationIdsByMockId.get(publication.id),
      }))
      .filter((item) => item.savedPublicationId && item.score.bucket !== "NONE")
      .sort((left, right) => right.score.score - left.score.score);

    for (const item of scoredPublications) {
      await prisma.matterPublication.upsert({
        where: {
          matterId_publicationId: {
            matterId: matter.id,
            publicationId: item.savedPublicationId!,
          },
        },
        update: {
          relevanceScore: item.score.score,
          relevanceBucket: item.score.bucket,
          rationale: item.score.rationale,
          suggestedAction:
            matter.matterType === "TRANSACTION_DILIGENCE"
              ? "Add a regulatory-risk insert to the diligence report and check whether the acquisition model needs a condition precedent or covenant."
              : matter.matterType === "AUTHORISATION"
                ? "Update the authorisation tracker, filing checklist and client-facing next-step note."
                : item.publication.tags.regulationFamilies.includes("dora")
                  ? "Update the implementation action register and verify outsourcing, ICT and incident response evidence."
                  : "Prepare a reviewed client note and update the matter knowledge asset if the point is reusable.",
          status: item.score.score >= 65 ? "TRIAGED" : "NEW",
        },
        create: {
          matterId: matter.id,
          publicationId: item.savedPublicationId!,
          relevanceScore: item.score.score,
          relevanceBucket: item.score.bucket,
          rationale: item.score.rationale,
          suggestedAction:
            matter.matterType === "TRANSACTION_DILIGENCE"
              ? "Add a regulatory-risk insert to the diligence report and check whether the acquisition model needs a condition precedent or covenant."
              : matter.matterType === "AUTHORISATION"
                ? "Update the authorisation tracker, filing checklist and client-facing next-step note."
                : item.publication.tags.regulationFamilies.includes("dora")
                  ? "Update the implementation action register and verify outsourcing, ICT and incident response evidence."
                  : "Prepare a reviewed client note and update the matter knowledge asset if the point is reusable.",
          status: item.score.score >= 65 ? "TRIAGED" : "NEW",
        },
      });
    }

    const topSignal = scoredPublications[0];
    if (topSignal?.savedPublicationId) {
      const signal = {
        relevanceScore: topSignal.score.score,
        relevanceBucket: topSignal.score.bucket,
        rationale: topSignal.score.rationale,
        suggestedAction:
          matter.matterType === "TRANSACTION_DILIGENCE"
            ? "Add a regulatory-risk insert to the diligence report and check whether the acquisition model needs a condition precedent or covenant."
            : matter.matterType === "AUTHORISATION"
              ? "Update the authorisation tracker, filing checklist and client-facing next-step note."
              : "Update the implementation action register and verify outsourcing, ICT and incident response evidence.",
      };
      await prisma.clientBrief.upsert({
        where: { id: `brief-${matter.id}` },
        update: {
          publicationId: topSignal.savedPublicationId,
          title: `Client note draft: ${topSignal.publication.title}`,
          body: buildClientBriefBody({
            matter,
            publication: topSignal.publication,
            signal,
          }),
          sourceProvenanceJson: {
            publicationId: topSignal.savedPublicationId,
            sourcePublicationId: topSignal.publication.id,
            sourceUrl: topSignal.publication.sourceUrl,
            rawHash: topSignal.publication.rawHash,
            generatedFrom: "seed-law-firm-mode-v1",
          },
        },
        create: {
          id: `brief-${matter.id}`,
          firmOrganisationId: lawFirmOrganisation.id,
          matterId: matter.id,
          publicationId: topSignal.savedPublicationId,
          status: "DRAFT",
          title: `Client note draft: ${topSignal.publication.title}`,
          audience: "Matter team and relationship partner",
          disclaimerProfile: "internal_review",
          body: buildClientBriefBody({
            matter,
            publication: topSignal.publication,
            signal,
          }),
          sourceProvenanceJson: {
            publicationId: topSignal.savedPublicationId,
            sourcePublicationId: topSignal.publication.id,
            sourceUrl: topSignal.publication.sourceUrl,
            rawHash: topSignal.publication.rawHash,
            generatedFrom: "seed-law-firm-mode-v1",
          },
        },
      });
    }

    await prisma.knowledgeAsset.upsert({
      where: { id: `asset-${matter.id}` },
      update: {
        kind: matter.matterType === "TRANSACTION_DILIGENCE" ? "DILIGENCE_INSERT" : "CHECKLIST",
        status: "DRAFT",
        visibility: "FIRM_INTERNAL",
        title: `${matter.title} working checklist`,
        summary: "Reusable internal checklist generated from matter taxonomy, source provenance and current regulatory signals.",
        regulationFamilies: matter.regulationFamilies,
        activities: matter.activities,
        licenceTypes: matter.licenceTypes,
        topicPaths: matter.topicPaths,
        jurisdictions: matter.jurisdictionTags,
      },
      create: {
        id: `asset-${matter.id}`,
        firmOrganisationId: lawFirmOrganisation.id,
        matterId: matter.id,
        publicationId: topSignal?.savedPublicationId ?? null,
        kind: matter.matterType === "TRANSACTION_DILIGENCE" ? "DILIGENCE_INSERT" : "CHECKLIST",
        status: "DRAFT",
        visibility: "FIRM_INTERNAL",
        title: `${matter.title} working checklist`,
        summary: "Reusable internal checklist generated from matter taxonomy, source provenance and current regulatory signals.",
        regulationFamilies: matter.regulationFamilies,
        activities: matter.activities,
        licenceTypes: matter.licenceTypes,
        topicPaths: matter.topicPaths,
        jurisdictions: matter.jurisdictionTags,
      },
    });

    if (matter.accessPolicy === "RESTRICTED") {
      await prisma.ethicalWall.upsert({
        where: { id: `wall-${matter.id}` },
        update: {
          name: "Restricted implementation matter team",
          accessPolicy: "RESTRICTED",
          notes: "Restrict client-sensitive implementation notes to the matter team.",
        },
        create: {
          id: `wall-${matter.id}`,
          matterId: matter.id,
          name: "Restricted implementation matter team",
          accessPolicy: "RESTRICTED",
          notes: "Restrict client-sensitive implementation notes to the matter team.",
        },
      });
    }

    await prisma.commercialOpportunity.upsert({
      where: { id: `opp-${matter.id}` },
      update: {
        clientId: matter.clientId,
        matterId: matter.id,
        publicationId: topSignal?.savedPublicationId ?? null,
        serviceOfferingId:
          matter.matterType === "IMPLEMENTATION"
            ? "gc_dora_register"
            : matter.matterType === "AUTHORISATION"
              ? "gc_micar_authorisation"
              : "gc_regulatory_strategy_retainer",
        stage: "IDENTIFIED",
        title: `Follow-on package: ${matter.title}`,
        rationale: "The matter has a current regulatory signal and a mapped fixed-fee service route.",
        nextAction: "Relationship partner reviews the proposed package and decides whether to raise it in the next client call.",
        ownerName: matter.relationshipPartnerName,
        estimatedValueEur: matter.matterType === "TRANSACTION_DILIGENCE" ? 45000 : 18000,
      },
      create: {
        id: `opp-${matter.id}`,
        firmOrganisationId: lawFirmOrganisation.id,
        clientId: matter.clientId,
        matterId: matter.id,
        publicationId: topSignal?.savedPublicationId ?? null,
        serviceOfferingId:
          matter.matterType === "IMPLEMENTATION"
            ? "gc_dora_register"
            : matter.matterType === "AUTHORISATION"
              ? "gc_micar_authorisation"
              : "gc_regulatory_strategy_retainer",
        stage: "IDENTIFIED",
        title: `Follow-on package: ${matter.title}`,
        rationale: "The matter has a current regulatory signal and a mapped fixed-fee service route.",
        nextAction: "Relationship partner reviews the proposed package and decides whether to raise it in the next client call.",
        ownerName: matter.relationshipPartnerName,
        estimatedValueEur: matter.matterType === "TRANSACTION_DILIGENCE" ? 45000 : 18000,
      },
    });
  }

  for (const playbook of demoPlaybooks) {
    await prisma.regulatoryPlaybook.upsert({
      where: { id: playbook.id },
      update: {
        practiceGroupId: playbook.practiceGroupId,
        firmProfile: playbook.firmProfile,
        name: playbook.name,
        description: playbook.description,
        triggerRegulationFamilies: playbook.triggerRegulationFamilies,
        triggerTopics: playbook.triggerTopics,
        triggerLicenceTypes: playbook.triggerLicenceTypes,
        workflowSteps: playbook.workflowSteps,
        outputTemplates: playbook.outputTemplates,
        isActive: playbook.isActive,
      },
      create: {
        id: playbook.id,
        firmOrganisationId: lawFirmOrganisation.id,
        practiceGroupId: playbook.practiceGroupId,
        firmProfile: playbook.firmProfile,
        name: playbook.name,
        description: playbook.description,
        triggerRegulationFamilies: playbook.triggerRegulationFamilies,
        triggerTopics: playbook.triggerTopics,
        triggerLicenceTypes: playbook.triggerLicenceTypes,
        workflowSteps: playbook.workflowSteps,
        outputTemplates: playbook.outputTemplates,
        isActive: playbook.isActive,
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

    await prisma.integrationConfig.upsert({
      where: {
        organisationId_provider: {
          organisationId: lawFirmOrganisation.id,
          provider,
        },
      },
      update: {
        displayName: provider,
        status: "DISABLED",
        nonSecretConfigJson: { seeded: true, lawFirmMode: true },
      },
      create: {
        organisationId: lawFirmOrganisation.id,
        provider,
        displayName: provider,
        status: "DISABLED",
        nonSecretConfigJson: { seeded: true, lawFirmMode: true },
      },
    });
  }

  await prisma.agentRun.upsert({
    where: { id: "agent-demo-review-qa" },
    update: {
      agentDefinitionId: "review-qa",
      kind: "REVIEW_QA",
      status: "SUCCEEDED",
      organisationId: organisation.id,
      trigger: "manual",
      agentVersion: "review-qa-v1",
      inputHash: "seed-review-qa-input",
      outputHash: "seed-review-qa-output",
      costCents: 0,
      finishedAt: new Date("2026-05-29T08:30:00.000Z"),
      errorMessage: null,
    },
    create: {
      id: "agent-demo-review-qa",
      agentDefinitionId: "review-qa",
      kind: "REVIEW_QA",
      status: "SUCCEEDED",
      organisationId: organisation.id,
      trigger: "manual",
      agentVersion: "review-qa-v1",
      inputHash: "seed-review-qa-input",
      outputHash: "seed-review-qa-output",
      costCents: 0,
      startedAt: new Date("2026-05-29T08:29:00.000Z"),
      finishedAt: new Date("2026-05-29T08:30:00.000Z"),
    },
  });
  await prisma.agentRunStep.deleteMany({ where: { agentRunId: "agent-demo-review-qa" } });
  await prisma.agentArtifact.deleteMany({ where: { agentRunId: "agent-demo-review-qa" } });
  await prisma.agentRunStep.createMany({
    data: [
      {
        agentRunId: "agent-demo-review-qa",
        stepKey: "load-review-queue",
        status: "SUCCEEDED",
        inputJson: { source: "seed" },
        outputJson: { pendingReviewItems: 2, approvedReviewItems: 1 },
        startedAt: new Date("2026-05-29T08:29:10.000Z"),
        finishedAt: new Date("2026-05-29T08:29:25.000Z"),
      },
      {
        agentRunId: "agent-demo-review-qa",
        stepKey: "summarize-review-readiness",
        status: "SUCCEEDED",
        inputJson: { reviewStatuses: ["PENDING", "APPROVED"] },
        outputJson: { artifactType: "REVIEW_SUGGESTION" },
        startedAt: new Date("2026-05-29T08:29:25.000Z"),
        finishedAt: new Date("2026-05-29T08:29:45.000Z"),
      },
    ],
  });
  await prisma.agentArtifact.create({
    data: {
      id: "agent-demo-review-qa-artifact-0",
      agentRunId: "agent-demo-review-qa",
      organisationId: organisation.id,
      type: "REVIEW_SUGGESTION",
      status: "DRAFT",
      title: "Review queue readiness check",
      summary: "Seeded review QA artifact for database-backed smoke tests and local operator review.",
      payloadJson: {
        finding: "Review queue has approved content and pending items for pilot validation.",
        externalDeliveryPermitted: false,
      },
      provenanceJson: {
        generatedFrom: "seed-review-qa-v1",
        reviewGate: "internal_only",
      },
    },
  });

  await recalculateImpactScores(organisation.id);

  console.log("Seeded taxonomy, Tier 1 sources, agents, design partner, product map, law-firm mode, and demo publications.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
