import type { AyVercelManifest } from "./schemas.ts";

export interface MonthlyVercelUsage {
  fastDataTransferGb: number;
  edgeRequests: number;
  activeCpuHours: number;
  provisionedMemoryGbHours: number;
  seats?: number;
}

export interface VercelCostBreakdown {
  seatsUsd: number;
  dataTransferOverageUsd: number;
  edgeRequestsOverageUsd: number;
  activeCpuUsd: number;
  provisionedMemoryUsd: number;
  totalUsd: number;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function estimateProMonthlyCost(
  manifest: AyVercelManifest,
  usage: MonthlyVercelUsage,
): VercelCostBreakdown {
  const f = manifest.finops;
  const seats = Math.max(1, usage.seats ?? 1);
  const seatsUsd = seats * f.pro_base_seat_usd;
  const extraGb = Math.max(0, usage.fastDataTransferGb - f.pro_included_fast_data_transfer_gb);
  const dataTransferOverageUsd = extraGb * f.pro_extra_data_transfer_per_gb_usd;
  const extraReq = Math.max(0, usage.edgeRequests - f.pro_included_edge_requests);
  const edgeRequestsOverageUsd = (extraReq / 1_000_000) * f.pro_extra_edge_requests_per_million_usd;
  const activeCpuUsd = usage.activeCpuHours * f.pro_active_cpu_per_hour_usd;
  const provisionedMemoryUsd =
    usage.provisionedMemoryGbHours * f.pro_provisioned_memory_per_gb_hour_usd;

  return {
    seatsUsd: round4(seatsUsd),
    dataTransferOverageUsd: round4(dataTransferOverageUsd),
    edgeRequestsOverageUsd: round4(edgeRequestsOverageUsd),
    activeCpuUsd: round4(activeCpuUsd),
    provisionedMemoryUsd: round4(provisionedMemoryUsd),
    totalUsd: round4(
      seatsUsd +
        dataTransferOverageUsd +
        edgeRequestsOverageUsd +
        activeCpuUsd +
        provisionedMemoryUsd,
    ),
  };
}
