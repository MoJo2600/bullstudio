import { Button } from "@bullstudio/ui/components/button";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle,
  GitBranch,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback } from "react";
import { FlowGraph } from "@/components/flows/FlowGraph";
import { usePollingQueryOptions } from "@/components/PollingProvider";
import { useTRPC } from "@/integrations/trpc/react";
import { DEFAULT_JOBS_SEARCH } from "@/lib/jobs";
import { queueKey as buildQueueKey } from "@/lib/queue-key";

interface FlowDetailProps {
  flowId: string;
  queueName: string;
  prefix?: string;
  queueKey?: string;
}

export function FlowDetail({
  flowId,
  queueName,
  prefix,
  queueKey,
}: FlowDetailProps) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const polling = usePollingQueryOptions();

  const {
    data: flowTree,
    isLoading,
    refetch,
    isFetching,
  } = useQuery(
    trpc.flows.get.queryOptions(
      { queueKey, queueName, flowId, prefix },
      polling,
    ),
  );

  const handleNodeClick = useCallback(
    (jobId: string, jobQueueName: string) => {
      navigate({
        to: "/queues/$queueName/jobs",
        params: { queueName: buildQueueKey(prefix ?? "", jobQueueName) },
        search: { ...DEFAULT_JOBS_SEARCH, selected: jobId },
      });
    },
    [navigate, prefix],
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-full bg-muted/50" />
        <Skeleton className="h-[420px] w-full bg-muted/50" />
      </div>
    );
  }

  if (!flowTree) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Flow not found</h3>
        <p className="text-xs text-muted-foreground">
          The flow may have been removed or the ID is incorrect.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {flowTree.root.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            #{flowId}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="bg-card"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid overflow-hidden rounded-lg border bg-card/80 sm:grid-cols-2 lg:grid-cols-4">
        <FlowMetric
          icon={<GitBranch className="size-4 text-muted-foreground" />}
          label="Jobs"
          value={String(flowTree.totalNodes)}
        />
        <FlowMetric
          icon={<CheckCircle className="size-4 text-emerald-400" />}
          label="Completed"
          value={String(flowTree.completedNodes)}
          valueClassName="text-emerald-400"
        />
        <FlowMetric
          icon={<XCircle className="size-4 text-red-400" />}
          label="Failed"
          value={String(flowTree.failedNodes)}
          valueClassName={flowTree.failedNodes > 0 ? "text-red-400" : undefined}
        />
        <FlowMetric label="Queue" value={queueName} mono />
      </div>

      <FlowGraph
        root={flowTree.root}
        onNodeClick={handleNodeClick}
        heightClassName="h-[480px]"
      />
    </div>
  );
}

function FlowMetric({
  icon,
  label,
  value,
  valueClassName,
  mono = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b p-4 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      {icon}
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-0.5 truncate text-sm font-medium text-foreground ${mono ? "font-mono" : ""} ${valueClassName ?? ""}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
