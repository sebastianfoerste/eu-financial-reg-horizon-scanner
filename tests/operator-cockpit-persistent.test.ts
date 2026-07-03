import { describe, expect, it } from "vitest";

import { hasDatabaseUrl } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { listReviewQueue } from "@/lib/review";
import { listAlerts } from "@/lib/alerts";
import { buildOperatorActions } from "@/lib/operator-cockpit";
import { getTaxonomyVersion } from "@/lib/taxonomy";

describe("operator cockpit persistent (database-backed)", () => {
  it("verifies database-backed functionality when DATABASE_URL is set, or skips gracefully", async () => {
    if (!hasDatabaseUrl()) {
      console.log("Skipping database-backed operator cockpit test: DATABASE_URL not set");
      expect(true).toBe(true);
      return;
    }

    const prisma = getPrisma();

    // 1. Setup mock source, publication, review item, alert, etc.
    const uniqueSuffix = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const orgId = `org_${uniqueSuffix}`;
    const sourceId = `source_${uniqueSuffix}`;
    const pubId = `pub_${uniqueSuffix}`;
    const pmId = `pm_${uniqueSuffix}`;
    const userId = `user_${uniqueSuffix}`;
    const taxVersionId = getTaxonomyVersion();

    // Ensure TaxonomyVersion exists
    const tv = await prisma.taxonomyVersion.upsert({
      where: { version: taxVersionId },
      update: {},
      create: {
        version: taxVersionId,
        yamlContent: "dummy yaml",
      },
    });

    // Create Organisation
    await prisma.organisation.create({
      data: {
        id: orgId,
        name: `Test Org ${uniqueSuffix}`,
        tier: "TRIAL",
      },
    });

    // Create User
    await prisma.user.create({
      data: {
        id: userId,
        email: `${uniqueSuffix}@example.test`,
        name: "Test User",
        authProvider: "fixture",
        isInternalOperator: true,
      },
    });

    // Create Source
    await prisma.source.create({
      data: {
        id: sourceId,
        code: `code_${uniqueSuffix}`,
        displayName: `Test Source ${uniqueSuffix}`,
        jurisdictionCode: "eu",
        baseUrl: "https://example.test",
        feedType: "RSS",
      },
    });

    // Create Publication
    await prisma.publication.create({
      data: {
        id: pubId,
        sourceId: sourceId,
        sourceUrl: `https://example.test/pub_${uniqueSuffix}`,
        title: `Test Publication ${uniqueSuffix}`,
        language: "en",
        publicationType: "regulation_final",
        rawHash: `hash_${uniqueSuffix}`,
        bodyText: "Sample body text for test.",
      },
    });

    // Create ProductMap
    await prisma.productMap.create({
      data: {
        id: pmId,
        organisationId: orgId,
        name: `Test ProductMap ${uniqueSuffix}`,
        isActive: true,
      },
    });

    // Create Classification
    await prisma.classification.create({
      data: {
        publicationId: pubId,
        taxonomyVersionId: tv.id,
        regulationFamilies: ["micar"],
        subTopics: [],
        activities: ["exchange_services"],
        licenceTypes: ["casp_micar"],
        topicPaths: ["market_abuse_crypto"],
        jurisdictions: ["eu"],
        summary: "Synthetic classification summary for testing database-backed routes.",
        whatChanged: "What changed text",
        whoIsAffected: "Who is affected text",
        recommendedAction: "Review recommendation",
        serviceOfferingIds: [],
        classifierModel: "test-model",
        classifierVersion: "v1.0",
        classifierStatus: "STUB",
        confidence: 0.95,
      },
    });

    // Create ReviewQueueItem
    await prisma.reviewQueueItem.create({
      data: {
        publicationId: pubId,
        status: "PENDING",
        priority: 75,
      },
    });

    // Create ImpactScore
    await prisma.impactScore.create({
      data: {
        publicationId: pubId,
        organisationId: orgId,
        productMapId: pmId,
        score: 75,
        bucket: "HIGH",
        rationale: "High impact matched topics.",
        ruleVersion: "v1",
      },
    });

    // Create Alert
    await prisma.alert.create({
      data: {
        organisationId: orgId,
        publicationId: pubId,
        channel: "EMAIL_REALTIME",
        status: "DRAFT",
        scheduledFor: new Date(),
        payloadJson: {
          subject: "Test subject",
          text: "Test text",
          title: "Test Publication",
          sourceUrl: "https://example.test",
          publicationUrl: "/publications/1",
          impactBucket: "HIGH",
          impactScore: 75,
          serviceOfferingIds: [],
        },
      },
    });

    try {
      // 2. Call listReviewQueue() and listAlerts()
      const reviewQueue = await listReviewQueue(orgId);
      const alerts = await listAlerts(orgId);

      // Verify records are retrieved and matched
      const foundReview = reviewQueue.find((item) => item.publicationId === pubId);
      expect(foundReview).toBeDefined();
      expect(foundReview?.status).toBe("PENDING");
      expect(foundReview?.priority).toBe(75);

      const foundAlert = alerts.find((item) => item.publicationId === pubId);
      expect(foundAlert).toBeDefined();
      expect(foundAlert?.status).toBe("DRAFT");
      expect(foundAlert?.channel).toBe("EMAIL_REALTIME");

      // 3. Call buildOperatorActions()
      const actions = buildOperatorActions({
        highImpactCount: 1,
        reviewItems: [{ status: foundReview!.status }],
        alerts: [{ status: foundAlert!.status }],
        sourceFreshness: { stale: 0, pollable: 0 },
        footprintReadiness: { ready: true, blockingMaps: [] },
        runtimeChecks: [],
      });

      expect(actions).toBeDefined();
      expect(actions.length).toBeGreaterThan(0);
      const reviewAction = actions.find((a) => a.key === "review");
      const draftsAction = actions.find((a) => a.key === "drafts");
      expect(reviewAction).toBeDefined();
      expect(draftsAction).toBeDefined();

    } finally {
      // 4. Cleanup
      await prisma.alert.deleteMany({ where: { publicationId: pubId } });
      await prisma.impactScore.deleteMany({ where: { publicationId: pubId } });
      await prisma.reviewQueueItem.deleteMany({ where: { publicationId: pubId } });
      await prisma.classification.deleteMany({ where: { publicationId: pubId } });
      await prisma.productMap.deleteMany({ where: { id: pmId } });
      await prisma.publication.deleteMany({ where: { id: pubId } });
      await prisma.source.deleteMany({ where: { id: sourceId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.organisation.deleteMany({ where: { id: orgId } });
    }
  });
});
