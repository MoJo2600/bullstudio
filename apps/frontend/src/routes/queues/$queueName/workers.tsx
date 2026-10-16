import { Button } from "@bullstudio/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { usePollingQueryOptions } from "@/components/PollingProvider";
import type { PrivateWorker } from "@/components/workers/types";
import { WorkerSheet } from "@/components/workers/WorkerSheet";
import { WorkersTable } from "@/components/workers/WorkersTable";
import { useTRPC } from "@/integrations/trpc/react";
import { queueNameFromParam, resolveQueueFromParam } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

export const Route = createFileRoute("/queues/$queueName/workers")({
  component: QueueWorkersPage,
});

function QueueWorkersPage() {
  const trpc = useTRPC();
  const polling = usePollingQueryOptions();
  const { queueName: queueParam } = Route.useParams();
  const [selected, setSelected] = useState<PrivateWorker | null>(null);

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;
  const hasMultiplePrefixes = (queueSource?.prefixes.length ?? 0) > 1;

  const { data: queues } = useQuery(trpc.queues.list.queryOptions());
  const queue = resolveQueueFromParam(queueParam, queues);
  const queueName = queue?.name ?? queueNameFromParam(queueParam);
  const prefix = queue?.prefix;

  const {
    data: workers,
    isLoading,
    isFetching,
    refetch,
  } = useQuery(
    trpc.workers.list.queryOptions({ queueName, prefix, limit: 500 }, polling),
  );

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

      <WorkersTable
        hasMultiplePrefixes={hasMultiplePrefixes}
        isLoading={isLoading}
        workers={workers}
        onSelectWorker={setSelected}
      />

      <WorkerSheet
        open={Boolean(selected)}
        worker={selected}
        queue={queue}
        queueActions={{
          pause: queueSource?.features.queuePause.enabled ?? false,
          resume: queueSource?.features.queueResume.enabled ?? false,
          drain: queueSource?.features.queueDrain.enabled ?? false,
        }}
        onClose={() => setSelected(null)}
        onChanged={() => refetch()}
      />
    </div>
  );
}
