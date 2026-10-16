import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Separator } from "@bullstudio/ui/components/separator";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { EmptyState } from "@bullstudio/ui/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database } from "lucide-react";
import { useState } from "react";
import { FailingJobTypesTable } from "@/components/overview/FailingJobTypesTable";
import { JobStateCards } from "@/components/overview/JobStateCards";
import { MetricCardsGrid } from "@/components/overview/MetricCardsGrid";
import { ProcessingTimeChart } from "@/components/overview/ProcessingTimeChart";
import { SlowestJobsTable } from "@/components/overview/SlowestJobsTable";
import { ThroughputChart } from "@/components/overview/ThroughputChart";
import { usePollingQueryOptions } from "@/components/PollingProvider";
import { useTRPC } from "@/integrations/trpc/react";
import { queueNameFromParam, resolveQueueFromParam } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";
import { TIME_RANGES } from "@/lib/time-ranges";

export const Route = createFileRoute("/queues/$queueName/")({
  component: QueueOverview,
});

const OVERVIEW_SKELETON_KEYS = [
  "summary-1",
  "summary-2",
  "summary-3",
  "summary-4",
];

const JOB_STATE_SKELETON_KEYS = [
  "state-1",
  "state-2",
  "state-3",
  "state-4",
  "state-5",
  "state-6",
];

function QueueOverview() {
  const trpc = useTRPC();
  const polling = usePollingQueryOptions();
  const { queueName: queueParam } = Route.useParams();
  const [timeRange, setTimeRange] = useState<number>(5 / 60);

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions(),
  );
  const queue = resolveQueueFromParam(queueParam, queues);
  const queueName = queue?.name ?? queueNameFromParam(queueParam);
  const prefix = queue?.prefix;

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  const { data: metrics, isLoading: loadingMetrics } = useQuery(
    trpc.overview.metrics.queryOptions(
      { timeRangeHours: timeRange, queueName, prefix },
      polling,
    ),
  );

  return (
    <div className="space-y-6">
      {/* Live job-state snapshot (independent of the time range below) */}
      {(queue?.jobCounts || loadingQueues) && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Jobs distribution
          </h2>
          {queue?.jobCounts ? (
            <JobStateCards counts={queue.jobCounts} queueParam={queueParam} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {JOB_STATE_SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-20 w-full bg-zinc-800/50" />
              ))}
            </div>
          )}
        </section>
      )}

      <Separator />

      {/* Header Controls */}
      <div className="flex items-center w-full justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Performance
        </h2>
        <Select
          value={String(timeRange)}
          onValueChange={(value) => setTimeRange(Number(value))}
        >
          <SelectTrigger className="w-[150px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loadingMetrics ? (
        <OverviewSkeleton />
      ) : queues && queues.length === 0 ? (
        <EmptyState
          icon={<Database className="size-12" />}
          title="No queues found"
          description={
            queueSource?.mode === "embedded"
              ? "No supplied queues are available in this dashboard."
              : "No BullMQ queues were found in the connected Redis instance. Make sure you have queues set up."
          }
        />
      ) : metrics ? (
        <>
          <section className="space-y-3">
            <MetricCardsGrid
              summary={metrics.summary}
              timeSeries={metrics.timeSeries}
              timeRange={timeRange}
              nativeMetrics={metrics.nativeMetrics}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <ThroughputChart
              data={metrics.timeSeries}
              timeRange={timeRange}
              nativeMetrics={metrics.nativeMetrics}
            />
            <ProcessingTimeChart
              data={metrics.timeSeries}
              timeRange={timeRange}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SlowestJobsTable
              jobs={metrics.slowestJobs}
              queueParam={queueParam}
            />
            <FailingJobTypesTable jobTypes={metrics.failingJobTypes} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OVERVIEW_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-32 w-full bg-zinc-800/50" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 w-full bg-zinc-800/50" />
        <Skeleton className="h-96 w-full bg-zinc-800/50" />
      </div>
    </div>
  );
}
