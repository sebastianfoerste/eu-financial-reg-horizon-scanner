import { checkRoute, describeSmokeError } from "../scripts/smoke-routes";
import { describe, expect, it } from "vitest";

describe("route smoke helper", () => {
  it("formats nested connection failures for operator output", () => {
    const error = new TypeError("fetch failed", {
      cause: new AggregateError([
        Object.assign(new Error(""), {
          code: "ECONNREFUSED",
          syscall: "connect",
          address: "127.0.0.1",
          port: 3000,
        }),
      ]),
    });

    expect(describeSmokeError(error)).toBe("fetch failed: ECONNREFUSED connect 127.0.0.1:3000");
  });

  it("returns a failed smoke result instead of throwing when the app is offline", async () => {
    const result = await checkRoute(
      { path: "/", expected: ["scanner cockpit"] },
      async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
      },
    );

    expect(result).toEqual({
      path: "/",
      status: 0,
      ok: false,
      missing: ["request failed: connect ECONNREFUSED 127.0.0.1:3000"],
    });
  });

  it("reports missing expected text when a route responds", async () => {
    const result = await checkRoute(
      { path: "/briefing", expected: ["pilot briefing room", "impact queue"] },
      async () => new Response("Pilot briefing room"),
    );

    expect(result).toEqual({
      path: "/briefing",
      status: 200,
      ok: false,
      missing: ["impact queue"],
    });
  });
});
