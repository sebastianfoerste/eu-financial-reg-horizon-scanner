import { describe, expect, it, vi } from "vitest";

import {
  pollTierOneSourcesHandler,
  manualPollSourcesHandler,
  prepareDigestPreviewHandler,
  scheduledSourceMonitorAgentHandler,
  requestedAgentRunHandler
} from "@/inngest/functions";

// Mock the dependencies
vi.mock("@/lib/ingestion/pipeline", () => ({
  pollTierOneSources: vi.fn().mockResolvedValue([
    { status: "SUCCESS", count: 12 },
    { status: "SUCCESS", count: 0 }
  ])
}));

vi.mock("@/lib/publications", () => ({
  getDigestPreview: vi.fn().mockResolvedValue({
    renderedAt: "2026-06-17T12:00:00Z",
    items: []
  })
}));

vi.mock("@/lib/agents/runner", () => ({
  runAgent: vi.fn().mockResolvedValue({
    status: "success",
    processed: 5
  })
}));

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn().mockReturnValue({
    HORIZON_AGENT_AUTORUN_ENABLED: true
  })
}));

describe("Inngest Handlers", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((name, fn) => fn())
  };

  it("executes pollTierOneSourcesFunction correctly", async () => {
    const result = await pollTierOneSourcesHandler({ step: mockStep });
    expect(result).toEqual({
      results: [
        { status: "SUCCESS", count: 12 },
        { status: "SUCCESS", count: 0 }
      ],
      failed: 0
    });
    expect(mockStep.run).toHaveBeenCalledWith("poll tier one adapters", expect.any(Function));
  });

  it("executes manualPollSourcesFunction correctly", async () => {
    const result = await manualPollSourcesHandler({ step: mockStep });
    expect(result).toEqual([
      { status: "SUCCESS", count: 12 },
      { status: "SUCCESS", count: 0 }
    ]);
    expect(mockStep.run).toHaveBeenCalledWith("poll tier one adapters", expect.any(Function));
  });

  it("executes prepareDigestPreviewFunction correctly", async () => {
    const result = await prepareDigestPreviewHandler({ step: mockStep });
    expect(result).toEqual({
      renderedAt: "2026-06-17T12:00:00Z",
      items: []
    });
    expect(mockStep.run).toHaveBeenCalledWith("render digest preview", expect.any(Function));
  });

  it("executes scheduledSourceMonitorAgentFunction when autorun is enabled", async () => {
    const result = await scheduledSourceMonitorAgentHandler({ step: mockStep });
    expect(result).toEqual({
      status: "success",
      processed: 5
    });
    expect(mockStep.run).toHaveBeenCalledWith("run source monitor agent", expect.any(Function));
  });

  it("skips scheduledSourceMonitorAgentFunction when autorun is disabled", async () => {
    const { getEnv } = await import("@/lib/env");
    vi.mocked(getEnv).mockReturnValueOnce({
      HORIZON_AGENT_AUTORUN_ENABLED: false
    } as any);

    const result = await scheduledSourceMonitorAgentHandler({ step: mockStep });
    expect(result).toEqual({
      skipped: true,
      reason: "Agent autorun is disabled."
    });
  });

  it("executes requestedAgentRunFunction with correct arguments", async () => {
    const mockEvent = {
      name: "agents/run.requested",
      data: {
        kind: "SOURCE_MONITOR",
        limit: 10
      }
    };
    const result = await requestedAgentRunHandler({ event: mockEvent as any, step: mockStep });
    expect(result).toEqual({
      status: "success",
      processed: 5
    });
    expect(mockStep.run).toHaveBeenCalledWith("run requested agent", expect.any(Function));
  });

  it("rejects requestedAgentRunFunction with invalid kind", async () => {
    const mockEvent = {
      name: "agents/run.requested",
      data: {
        kind: "INVALID_KIND"
      }
    };
    await expect(
      requestedAgentRunHandler({ event: mockEvent as any, step: mockStep })
    ).rejects.toThrow("Requested agent run did not include a known agent kind.");
  });
});
