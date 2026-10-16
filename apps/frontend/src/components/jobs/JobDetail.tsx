import dayjs from "@bullstudio/dayjs";
import { Button } from "@bullstudio/ui/components/button";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@bullstudio/ui/components/tabs";
import {
  formatDuration,
  type JobStatus,
  JobStatusBadge,
} from "@bullstudio/ui/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlowGraph } from "@/components/flows/FlowGraph";
import { usePollingQueryOptions } from "@/components/PollingProvider";
import { useTRPC } from "@/integrations/trpc/react";
import { DEFAULT_JOBS_SEARCH } from "@/lib/jobs";
import { queueKey as buildQueueKey } from "@/lib/queue-key";

interface JobDetailProps {
  jobId: string;
  queueName: string;
  prefix?: string;
  queueKey?: string;
  /** Called after the job has been removed, so the parent can collapse the row. */
  onRemoved?: () => void;
}

export function JobDetail({
  jobId,
  queueName,
  prefix,
  queueKey,
  onRemoved,
}: JobDetailProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const polling = usePollingQueryOptions();

  const {
    data: job,
    isLoading,
    refetch,
    isFetching,
  } = useQuery(
    trpc.jobs.get.queryOptions(
      {
        queueKey,
        queueName,
        jobId,
        prefix,
      },
      polling,
    ),
  );

  const { data: logsData } = useQuery(
    trpc.jobs.logs.queryOptions(
      { queueKey, queueName, jobId, prefix },
      { ...polling, enabled: !!job },
    ),
  );

  // Resolving the flow walks up to the root across queues, so it is loaded
  // lazily once the job is in view and never blocks the rest of the detail UI.
  const { data: flowTree } = useQuery(
    trpc.flows.forJob.queryOptions(
      { queueKey, queueName, jobId, prefix },
      { ...polling, enabled: !!job },
    ),
  );
  const isFlow = !!flowTree && flowTree.totalNodes > 1;

  const navigate = useNavigate();
  const handleFlowNodeClick = useCallback(
    (clickedJobId: string, jobQueueName: string) => {
      navigate({
        to: "/queues/$queueName/jobs",
        params: { queueName: buildQueueKey(prefix ?? "", jobQueueName) },
        search: { ...DEFAULT_JOBS_SEARCH, selected: clickedJobId },
      });
    },
    [navigate, prefix],
  );

  const retryMutation = useMutation(
    trpc.jobs.retry.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message, {
          description: `${data.workerCount} worker(s) available to process`,
        });
        queryClient.invalidateQueries({ queryKey: [["jobs"]] });
        refetch();
      },
      onError: (error) => {
        toast.error("Failed to retry job", {
          description: error.message,
        });
      },
    }),
  );

  const removeMutation = useMutation(
    trpc.jobs.remove.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: [["jobs"]] });
        onRemoved?.();
      },
      onError: (error) => {
        toast.error("Failed to remove job", {
          description: error.message,
        });
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full bg-muted/50" />
        <Skeleton className="h-[280px] w-full bg-muted/50" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Job not found</h3>
        <p className="text-xs text-muted-foreground">
          The job may have been removed or the ID is incorrect.
        </p>
      </div>
    );
  }

  const handleRetry = () => {
    retryMutation.mutate({ queueKey, queueName, jobId, prefix });
  };

  const handleRemove = () => {
    removeMutation.mutate({ queueKey, queueName, jobId, prefix });
  };

  const createdAt = dayjs(job.timestamp);
  const duration =
    job.finishedOn && job.processedOn
      ? formatDuration(job.finishedOn - job.processedOn)
      : job.processedOn
        ? "In progress"
        : "Pending";

  const delayMs = job.status === "delayed" ? job.delay : undefined;
  const scheduledFor = delayMs != null ? dayjs(job.timestamp + delayMs) : null;

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {job.name}
          </span>
          <JobStatusBadge status={job.status as JobStatus} size="sm" />
          <span className="font-mono text-xs text-muted-foreground">
            #{job.id}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-card"
          >
            <RefreshCw
              className={`size-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {job.status === "failed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={retryMutation.isPending}
              className="bg-card text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <RotateCcw
                className={`size-4 ${retryMutation.isPending ? "animate-spin" : ""}`}
              />
              {retryMutation.isPending ? "Retrying" : "Retry"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className="bg-card text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 className="size-4" />
            {removeMutation.isPending ? "Removing" : "Remove"}
          </Button>
        </div>
      </header>

      <dl className="grid overflow-hidden rounded-lg border bg-card/80 sm:grid-cols-2 xl:grid-cols-4">
        <MetadataItem title="Queue" value={job.queueName} />
        <MetadataItem
          title="Created"
          value={createdAt.format("MMM D, HH:mm:ss")}
          subtitle={createdAt.format("YYYY-MM-DD")}
        />
        <MetadataItem
          title="Attempts"
          value={`${job.attemptsMade} / ${job.attemptsLimit + 1}`}
        />
        <MetadataItem title="Duration" value={duration} />
        {delayMs != null && scheduledFor && (
          <>
            <MetadataItem title="Delay" value={formatDuration(delayMs)} />
            <MetadataItem
              title="Scheduled for"
              value={scheduledFor.format("MMM D, HH:mm:ss")}
              subtitle={scheduledFor.fromNow()}
            />
          </>
        )}
      </dl>

      <Tabs defaultValue="data" className="w-full gap-3">
        <TabsList className="h-8 rounded-md border border-border bg-muted/60 p-1">
          <TabsTrigger value="data" className="h-6 rounded-sm px-3 text-xs">
            Input Data
          </TabsTrigger>
          <TabsTrigger value="logs" className="h-6 rounded-sm px-3 text-xs">
            Logs
          </TabsTrigger>
          <TabsTrigger value="result" className="h-6 rounded-sm px-3 text-xs">
            Result
          </TabsTrigger>
          {isFlow && (
            <TabsTrigger value="flow" className="h-6 rounded-sm px-3 text-xs">
              Flow
            </TabsTrigger>
          )}
          {job.status === "failed" && (
            <TabsTrigger value="error" className="h-6 rounded-sm px-3 text-xs">
              Error
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="data">
          <DetailPanel title="Input Data">
            <JsonViewer data={job.data} />
          </DetailPanel>
        </TabsContent>

        <TabsContent value="logs">
          <DetailPanel title="Job Logs">
            {logsData && logsData.logs.length > 0 ? (
              <div className="overflow-x-auto overflow-y-auto rounded-md bg-muted/70 max-h-[420px]">
                {logsData.logs.map((line) => (
                  <div
                    key={line}
                    className="border-b px-4 py-1.5 font-mono text-sm text-foreground whitespace-pre-wrap break-all last:border-b-0 hover:bg-background/70"
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No logs recorded</p>
            )}
          </DetailPanel>
        </TabsContent>

        {isFlow && flowTree && (
          <TabsContent value="flow">
            <DetailPanel title="Flow">
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-mono text-foreground">
                    {flowTree.totalNodes}
                  </span>{" "}
                  jobs
                </span>
                <span>
                  <span className="font-mono text-emerald-400">
                    {flowTree.completedNodes}
                  </span>{" "}
                  completed
                </span>
                <span>
                  <span
                    className={`font-mono ${flowTree.failedNodes > 0 ? "text-red-400" : "text-foreground"}`}
                  >
                    {flowTree.failedNodes}
                  </span>{" "}
                  failed
                </span>
              </div>
              <FlowGraph
                root={flowTree.root}
                onNodeClick={handleFlowNodeClick}
                heightClassName="h-[420px]"
              />
            </DetailPanel>
          </TabsContent>
        )}

        <TabsContent value="result">
          <DetailPanel title="Return Value">
            {job.returnValue ? (
              <JsonViewer data={job.returnValue} />
            ) : (
              <p className="text-sm text-muted-foreground">No return value</p>
            )}
          </DetailPanel>
        </TabsContent>

        {job.status === "failed" && (
          <TabsContent value="error">
            <DetailPanel
              title="Error Details"
              className="border-red-900/30 bg-red-950/10"
              titleClassName="text-red-400"
            >
              <div className="space-y-4">
                {job.failedReason && (
                  <div>
                    <h4 className="mb-1 text-xs text-muted-foreground">
                      Message
                    </h4>
                    <p className="font-mono text-sm text-red-300">
                      {job.failedReason}
                    </p>
                  </div>
                )}
                {job.stacktrace && job.stacktrace.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs text-muted-foreground">
                      Stack Trace
                    </h4>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/70 p-4 font-mono text-xs text-foreground">
                      {job.stacktrace.join("\n")}
                    </pre>
                  </div>
                )}
              </div>
            </DetailPanel>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function MetadataItem({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 border-b px-3 py-2 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {title}
      </dt>
      <dd className="min-w-0 truncate text-right font-mono text-xs text-foreground">
        {value}
        {subtitle && (
          <span className="ml-1.5 text-muted-foreground">{subtitle}</span>
        )}
      </dd>
    </div>
  );
}

function DetailPanel({
  title,
  children,
  className,
  titleClassName,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <section className={`rounded-lg border bg-card/80 p-4 ${className ?? ""}`}>
      <h2
        className={`mb-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground ${titleClassName ?? ""}`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const TRUNCATION_THRESHOLD = 50 * 1024; // 50KB

const JsonViewer = memo(function JsonViewer({ data }: { data: unknown }) {
  const [showFull, setShowFull] = useState(false);

  const { formatted, isTruncated, fullSize } = useMemo(() => {
    const full = JSON.stringify(data, null, 2);
    const size = full.length;
    const shouldTruncate = size > TRUNCATION_THRESHOLD && !showFull;

    return {
      formatted: shouldTruncate ? full.slice(0, TRUNCATION_THRESHOLD) : full,
      isTruncated: shouldTruncate,
      fullSize: size,
    };
  }, [data, showFull]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <pre className="overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted/70 p-4 font-mono text-sm text-foreground max-h-[420px]">
        {formatted}
        {isTruncated && (
          <span className="text-muted-foreground">{"\n\n... (truncated)"}</span>
        )}
      </pre>
      {(isTruncated || showFull) && fullSize > TRUNCATION_THRESHOLD && (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Size: {formatSize(fullSize)}
          </span>
          <button
            type="button"
            onClick={() => setShowFull(!showFull)}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            {showFull ? "Show less" : "Show full data"}
          </button>
        </div>
      )}
    </div>
  );
});
