import { getDigestPreview } from "@/lib/publications";

async function main() {
  const digest = await getDigestPreview();
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        delivery: "disabled",
        reviewNotice: "Digest preview is internal draft output. External delivery requires reviewer approval and configured integrations.",
        subject: digest.subject,
        generatedAt: digest.generatedAt,
        items: digest.items.map((item) => ({
          id: item.id,
          title: item.title,
          source: item.sourceCode,
          publicationType: item.publicationType,
          impactBucket: item.impactBucket,
          impactScore: item.impactScore,
          regulationFamilies: item.tags.regulationFamilies,
          recommendedAction: item.recommendedAction,
          sourceUrl: item.sourceUrl,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
