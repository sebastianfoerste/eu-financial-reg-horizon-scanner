import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("fresh-checkout readiness", () => {
  it("runs Prisma generation before TypeScript validation in CI", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    const generateIndex = workflow.indexOf("npm run prisma:generate");
    const typecheckIndex = workflow.indexOf("npm run typecheck");

    expect(generateIndex).toBeGreaterThanOrEqual(0);
    expect(typecheckIndex).toBeGreaterThan(generateIndex);
  });

});
