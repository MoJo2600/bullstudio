import { SidebarProvider } from "@bullstudio/ui/components/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueSearchProvider } from "./QueueSearchProvider";
import { AppSidebar } from "./Sidebar";

const { queueOptions, polling } = vi.hoisted(() => ({
  queueOptions: vi.fn((_input, options) => ({
    queryKey: ["queues"],
    queryFn: async () => [],
    ...options,
  })),
  polling: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useLocation: () => ({ pathname: "/queues/bull::email/jobs" }),
}));

vi.mock("@/components/SettingsDialog", () => ({
  SettingsDialog: () => null,
}));

vi.mock("@/components/PollingProvider", () => ({
  usePollingQueryOptions: () => {
    const { enabled, interval } = polling();
    return { refetchInterval: enabled ? interval : false };
  },
}));

vi.mock("@/integrations/trpc/react", () => ({
  useTRPC: () => ({
    connection: {
      info: {
        queryOptions: () => ({
          queryKey: ["connection"],
          queryFn: async () => ({}),
        }),
      },
    },
    queues: { list: { queryOptions: queueOptions } },
  }),
}));

function renderSidebar(queryClient: QueryClient) {
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <QueueSearchProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </QueueSearchProvider>
    </QueryClientProvider>,
  );
}

describe("sidebar queue refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    polling.mockReturnValue({ enabled: true, interval: 2000 });
  });

  it.each([
    { enabled: true, interval: 2000, expected: 2000 },
    { enabled: true, interval: 8000, expected: 8000 },
    { enabled: false, interval: 2000, expected: false },
  ])(
    "uses $expected as its queue refresh interval away from the overview",
    ({ enabled, interval, expected }) => {
      polling.mockReturnValue({ enabled, interval });
      const queryClient = new QueryClient();

      renderSidebar(queryClient);

      expect(queueOptions).toHaveBeenCalledWith(undefined, {
        refetchInterval: expected,
      });
      queryClient.clear();
    },
  );

  it("replaces stale sidebar entries when the queue list refreshes", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ["queues"],
      [{ name: "old-queue", prefix: "bull" }],
    );
    expect(renderSidebar(queryClient)).toContain("old-queue");

    queryClient.setQueryData(
      ["queues"],
      [{ name: "new-queue", prefix: "bull" }],
    );
    const refreshed = renderSidebar(queryClient);
    expect(refreshed).toContain("new-queue");
    expect(refreshed).not.toContain("old-queue");
    queryClient.clear();
  });
});
