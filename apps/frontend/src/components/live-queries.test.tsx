import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as runtimeConfig from "@/lib/runtime-config";
import { Route as FlowsRoute } from "@/routes/queues/$queueName/flows";
import { Route as MetricsRoute } from "@/routes/queues/$queueName/index";
import { Route as JobsRoute } from "@/routes/queues/$queueName/jobs";
import { Route as SchedulersRoute } from "@/routes/queues/$queueName/schedulers";
import { Route as WorkersRoute } from "@/routes/queues/$queueName/workers";
import { FlowDetail } from "./flows/FlowDetail";
import { JobDetail } from "./jobs/JobDetail";
import { PollingProvider } from "./PollingProvider";

const { queryConfigs } = vi.hoisted(() => ({
  queryConfigs: new Map<
    string,
    { refetchInterval?: number | false; enabled?: boolean }
  >(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ queueName: "bull::email" }),
    useSearch: () => ({
      statusFilter: "all",
      page: 1,
      pageSize: 50,
      sortField: "timestamp",
      sortOrder: "desc",
    }),
  }),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/flows/FlowGraph", () => ({ FlowGraph: () => null }));
vi.mock("@/components/workers/WorkerSheet", () => ({
  WorkerSheet: () => null,
}));
vi.mock("@/components/schedulers/SchedulerSheet", () => ({
  SchedulerSheet: () => null,
}));

vi.mock("@/integrations/trpc/react", () => {
  function query(key: string) {
    return {
      queryOptions: (_input: unknown, options?: object) => {
        queryConfigs.set(key, options ?? {});
        return {
          queryKey: [key],
          queryFn: async () => null,
          ...options,
        };
      },
    };
  }

  return {
    useTRPC: () => ({
      connection: { info: query("connection") },
      queues: { list: query("queues") },
      overview: { metrics: query("metrics") },
      workers: { list: query("workers") },
      schedulers: { list: query("schedulers") },
      flows: {
        list: query("flows"),
        get: query("flow"),
        forJob: query("jobFlow"),
      },
      jobs: {
        listSummary: query("jobs"),
        get: query("job"),
        logs: query("logs"),
        retry: { mutationOptions: () => ({}) },
        remove: { mutationOptions: () => ({}) },
        retryAllFailed: { mutationOptions: () => ({}) },
      },
    }),
  };
});

function renderView(queryClient: QueryClient, view: ReactNode) {
  renderToString(
    <QueryClientProvider client={queryClient}>
      <PollingProvider>{view}</PollingProvider>
    </QueryClientProvider>,
  );
}

function expectPolling(
  queryClient: QueryClient,
  key: string,
  expected: number | boolean,
) {
  const query = queryClient.getQueryCache().find({ queryKey: [key] });
  expect(query).toBeDefined();
  expect(queryConfigs.get(key)?.refetchInterval).toBe(expected);
}

describe("live dashboard queries", () => {
  beforeEach(() => {
    queryConfigs.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const routes = [
    { key: "jobs", route: JobsRoute },
    { key: "workers", route: WorkersRoute },
    { key: "schedulers", route: SchedulersRoute },
    { key: "flows", route: FlowsRoute },
    { key: "metrics", route: MetricsRoute },
  ];

  describe.each(routes)("$key", ({ key, route }) => {
    it.each([
      { enabled: true, expected: 8000 },
      { enabled: false, expected: false },
    ])(
      "uses $expected for polling even when empty",
      ({ enabled, expected }) => {
        vi.spyOn(runtimeConfig, "getPollingConfig").mockReturnValue({
          enabled,
          interval: 8000,
        });
        const queryClient = new QueryClient();
        queryClient.setQueryData(
          [key],
          key === "jobs"
            ? { items: [], total: 0 }
            : key === "metrics"
              ? null
              : [],
        );
        const Page = route.options.component as ComponentType;

        renderView(queryClient, <Page />);

        expectPolling(queryClient, key, expected);
        queryClient.clear();
      },
    );
  });

  it.each(["completed", "failed"])(
    "keeps %s job details, logs, and flow live",
    (status) => {
      const queryClient = new QueryClient();
      queryClient.setQueryData(["job"], {
        id: "1",
        name: "email",
        queueName: "email",
        status,
        timestamp: 1,
        attemptsMade: 1,
        attemptsLimit: 1,
        data: {},
      });

      renderView(queryClient, <JobDetail jobId="1" queueName="email" />);

      for (const key of ["job", "logs", "jobFlow"]) {
        expectPolling(queryClient, key, 2000);
      }
      queryClient.clear();
    },
  );

  it("does not fetch logs or job flows before a job exists", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["job"], null);

    renderView(queryClient, <JobDetail jobId="1" queueName="email" />);

    for (const key of ["logs", "jobFlow"]) {
      expect(queryConfigs.get(key)?.enabled).toBe(false);
    }
    queryClient.clear();
  });

  it("keeps an unavailable flow live so it can appear later", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["flow"], null);

    renderView(queryClient, <FlowDetail flowId="1" queueName="email" />);

    expectPolling(queryClient, "flow", 2000);
    queryClient.clear();
  });
});
