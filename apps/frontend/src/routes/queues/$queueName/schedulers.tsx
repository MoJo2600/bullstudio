import { Button } from "@bullstudio/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { usePollingQueryOptions } from "@/components/PollingProvider";
import { SchedulerSheet } from "@/components/schedulers/SchedulerSheet";
import { SchedulersTable } from "@/components/schedulers/SchedulersTable";
import type { PrivateScheduler } from "@/components/schedulers/types";
import { useTRPC } from "@/integrations/trpc/react";
import { queueNameFromParam, resolveQueueFromParam } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

export const Route = createFileRoute("/queues/$queueName/schedulers")({
  component: QueueSchedulersPage,
});

function QueueSchedulersPage() {
  const trpc = useTRPC();
  const polling = usePollingQueryOptions();
  const { queueName: queueParam } = Route.useParams();

  const [selected, setSelected] = useState<PrivateScheduler | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;
  const mutationsEnabled = queueSource?.features.schedulers.enabled ?? false;
  const hasMultiplePrefixes = (queueSource?.prefixes.length ?? 0) > 1;

  const { data: queues } = useQuery(trpc.queues.list.queryOptions());
  const queue = resolveQueueFromParam(queueParam, queues);
  const queueName = queue?.name ?? queueNameFromParam(queueParam);
  const prefix = queue?.prefix;

  const {
    data: schedulers,
    isLoading,
    isFetching,
    refetch,
  } = useQuery(
    trpc.schedulers.list.queryOptions(
      { queueName, prefix, limit: 200 },
      polling,
    ),
  );

  const canCreate = mutationsEnabled && Boolean(queue);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
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
        <Button
          size="sm"
          disabled={!canCreate}
          title={
            mutationsEnabled
              ? undefined
              : "Schedulers are read-only for this dashboard"
          }
          onClick={() => {
            setSelected(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4 mr-2" />
          New scheduler
        </Button>
      </div>

      <SchedulersTable
        hasMultiplePrefixes={hasMultiplePrefixes}
        isLoading={isLoading}
        schedulers={schedulers}
        onSelectScheduler={(scheduler) => {
          setCreating(false);
          setSelected(scheduler);
        }}
      />

      <SchedulerSheet
        open={Boolean(selected) || creating}
        mode={creating ? "create" : "edit"}
        scheduler={selected}
        mutationsEnabled={mutationsEnabled}
        createQueue={
          queue
            ? {
                queueKey: "key" in queue ? queue.key : undefined,
                queueName: queue.name,
                prefix: queue.prefix,
              }
            : null
        }
        onClose={() => {
          setSelected(null);
          setCreating(false);
        }}
        onSaved={() => refetch()}
      />
    </div>
  );
}
