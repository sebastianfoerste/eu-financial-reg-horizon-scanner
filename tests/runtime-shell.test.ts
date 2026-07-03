import { describe, expect, it } from "vitest";

import { describeShellRuntime } from "@/lib/runtime-shell";

describe("shell runtime status", () => {
  it("separates persisted data from local operator auth", () => {
    expect(
      describeShellRuntime({
        databaseConfigured: true,
        clerkConfigured: false,
        demoFallbackAllowed: true,
        isProduction: false,
      }),
    ).toMatchObject({
      persistence: { label: "Postgres", tone: "success" },
      auth: { label: "Local operator", tone: "warning" },
    });
  });

  it("surfaces sample data distinctly from configured Clerk", () => {
    expect(
      describeShellRuntime({
        databaseConfigured: false,
        clerkConfigured: true,
        demoFallbackAllowed: true,
        isProduction: false,
      }),
    ).toMatchObject({
      persistence: { label: "Sample data", tone: "warning" },
      auth: { label: "Clerk auth", tone: "success" },
    });
  });

  it("marks missing production auth as a blocking runtime state", () => {
    expect(
      describeShellRuntime({
        databaseConfigured: true,
        clerkConfigured: false,
        demoFallbackAllowed: false,
        isProduction: true,
      }).auth,
    ).toEqual({ label: "Auth missing", tone: "danger" });
  });
});
