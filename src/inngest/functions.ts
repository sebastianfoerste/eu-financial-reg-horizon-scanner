import { getDigestPreview } from "@/lib/publications";
import { isAgentKind } from "@/lib/agents/policy";
import { runAgent } from "@/lib/agents/runner";
import { getEnv } from "@/lib/env";
import { pollTierOneSources } from "@/lib/ingestion/pipeline";
import { inngest } from "@/inngest/client";

export type StepLike = {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
};

export type RequestedAgentRunEvent = {
  name?: string;
  data: {
    kind?: string;
    organisationId?: string | null;
    triggeredByUserId?: string | null;
    publicationId?: string | null;
    limit?: number;
  };
};

type PollResult = Awaited<ReturnType<typeof pollTierOneSources>>[number];

export const pollTierOneSourcesHandler = async ({ step }: { step: StepLike }) => {
  const results = await step.run("poll tier one adapters", async () => pollTierOneSources());
  return {
    results,
    failed: results.filter((result: PollResult) => result.status === "FAILED").length,
  };
};

export const pollTierOneSourcesFunction = inngest.createFunction(
  {
    id: "poll-tier-one-sources",
    name: "Poll Tier 1 regulator sources",
    triggers: [{ cron: "*/60 * * * *" }],
  },
  pollTierOneSourcesHandler,
);

export const manualPollSourcesHandler = async ({ step }: { step: StepLike }) => {
  return step.run("poll tier one adapters", async () => pollTierOneSources());
};

export const manualPollSourcesFunction = inngest.createFunction(
  {
    id: "manual-poll-sources",
    name: "Manual source poll",
    triggers: [{ event: "sources/poll.requested" }],
  },
  manualPollSourcesHandler,
);

export const prepareDigestPreviewHandler = async ({ step }: { step: StepLike }) => {
  return step.run("render digest preview", async () => getDigestPreview());
};

export const prepareDigestPreviewFunction = inngest.createFunction(
  {
    id: "prepare-digest-preview",
    name: "Prepare dry-run digest preview",
    triggers: [{ event: "digest/preview.requested" }, { cron: "0 7 * * 1-5" }],
  },
  prepareDigestPreviewHandler,
);

export const scheduledSourceMonitorAgentHandler = async ({ step }: { step: StepLike }) => {
  return step.run("run source monitor agent", async () => {
    if (!getEnv().HORIZON_AGENT_AUTORUN_ENABLED) {
      return { skipped: true, reason: "Agent autorun is disabled." };
    }
    return runAgent({ kind: "SOURCE_MONITOR", trigger: "inngest" });
  });
};

export const scheduledSourceMonitorAgentFunction = inngest.createFunction(
  {
    id: "agent-source-monitor",
    name: "Agent source monitor",
    triggers: [{ cron: "*/60 * * * *" }, { event: "agents/source-monitor.requested" }],
  },
  scheduledSourceMonitorAgentHandler,
);

export const requestedAgentRunHandler = async ({
  event,
  step,
}: {
  event: RequestedAgentRunEvent;
  step: StepLike;
}) => {
  return step.run("run requested agent", async () => {
    const data = event.data;
    if (!data.kind || !isAgentKind(data.kind)) {
      throw new Error("Requested agent run did not include a known agent kind.");
    }
    return runAgent({
      kind: data.kind,
      trigger: "inngest",
      organisationId: data.organisationId ?? null,
      triggeredByUserId: data.triggeredByUserId ?? null,
      publicationId: data.publicationId ?? null,
      limit: data.limit,
    });
  });
};

export const requestedAgentRunFunction = inngest.createFunction(
  {
    id: "agent-run-requested",
    name: "Requested agent run",
    triggers: [{ event: "agents/run.requested" }],
  },
  requestedAgentRunHandler,
);

export const functions = [
  pollTierOneSourcesFunction,
  manualPollSourcesFunction,
  prepareDigestPreviewFunction,
  scheduledSourceMonitorAgentFunction,
  requestedAgentRunFunction,
];
