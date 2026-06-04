import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("reviewer-facing documentation proof", () => {
  const readme = readFileSync("README.md", "utf8");

  it("keeps the parent product relationship explicit", () => {
    expect(readme).toContain("Regulatory Compliance OS");
    expect(readme).toContain("src/lib/scanner");
    expect(readme).toContain("/scanner");
  });

  it("documents the non-negotiable delivery and client-data safety gates", () => {
    expect(readme).toContain("No alert reaches an external channel without a reviewer approving it.");
    expect(readme).toContain("Product-map impact scoring is deterministic and local");
    expect(readme).toContain("public regulator publication text");
  });

  it("lists the validation bundle used for public proof", () => {
    expect(readme).toContain("npm run typecheck");
    expect(readme).toContain("npm run test");
    expect(readme).toContain("npm run ingest:fixture");
    expect(readme).toContain("npm audit --omit=dev");
  });
});
