import dayjs from "@bullstudio/dayjs";
import { Button } from "@bullstudio/ui/components/button";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import {
  EmptyState,
  type JobStatus,
  JobStatusBadge,
} from "@bullstudio/ui/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle,
  ChevronDown,
  Inbox,
  RefreshCw,
  Workflow,
  XCircle,
} from "lucide-react";
import { Fragment, useState } from "react";
import { FlowDetail } from "@/components/flows/FlowDetail";
import { usePollingQueryOptions } from "@/components/PollingProvider";
import { useTRPC } from "@/integrations/trpc/react";
import { queueNameFromParam, resolveQueueFromParam } from "@/lib/queue-key";

const flowSkeletonRows = [
  "flow-skeleton-1",
  "flow-skeleton-2",
  "flow-skeleton-3",
  "flow-skeleton-4",
  "flow-skeleton-5",
];

export const Route = createFileRoute("/queues/$queueName/flows")({
  component: QueueFlowsPage,
});

function QueueFlowsPage() {
  const trpc = useTRPC();
  const { queueName: queueParam } = Route.useParams();
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null);
  const polling = usePollingQueryOptions();

  const { data: queues } = useQuery(trpc.queues.list.queryOptions());
  const queue = resolveQueueFromParam(queueParam, queues);
  const queueName = queue?.name ?? queueNameFromParam(queueParam);
  const prefix = queue?.prefix;

  const {
    data: flows,
    isLoading,
    refetch,
    isFetching,
  } = useQuery(trpc.flows.list.queryOptions({ queueName, prefix }, polling));

  const toggleFlow = (flowId: string) => {
    setExpandedFlowId((current) => (current === flowId ? null : flowId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="bg-card"
        >
          <RefreshCw
            className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-8 space-y-4">
            {flowSkeletonRows.map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : !flows || flows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-12" />}
          title="No flows found"
          description="Flows will appear here when parent jobs with children are created using BullMQ's FlowProducer"
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Flow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((flow) => {
                const isExpanded = expandedFlowId === flow.id;
                return (
                  <Fragment key={`${flow.prefix}-${flow.queueName}-${flow.id}`}>
                    <TableRow
                      className={`cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-muted/60 hover:bg-muted/60"
                          : "hover:bg-muted/60"
                      }`}
                      onClick={() => toggleFlow(flow.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                              isExpanded ? "" : "-rotate-90"
                            }`}
                          />
                          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                            <Workflow className="size-4 text-cyan-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {flow.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {flow.id}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge
                          status={flow.status as JobStatus}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-foreground">
                            {flow.totalJobs} total
                          </span>
                          <div className="flex items-center gap-3 text-xs">
                            {flow.completedJobs > 0 && (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle className="size-3" />
                                {flow.completedJobs}
                              </span>
                            )}
                            {flow.failedJobs > 0 && (
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="size-3" />
                                {flow.failedJobs}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground">
                            {dayjs(flow.timestamp).fromNow()}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {dayjs(flow.timestamp).format("MMM D, HH:mm:ss")}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={4}
                          className="border-b bg-muted/20 p-0"
                        >
                          <FlowDetail
                            flowId={flow.id}
                            queueName={flow.queueName}
                            prefix={flow.prefix ?? prefix}
                            queueKey={queue?.key}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t text-sm text-muted-foreground">
            Showing {flows.length} flow{flows.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
