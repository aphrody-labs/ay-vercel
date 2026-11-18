"""Strict Pydantic v2 models for ay-vercel.toml and Fluid Compute FinOps."""

from __future__ import annotations

import tomllib
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    """Strict immutable base model rejecting unknown fields."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class FinOpsPolicy(StrictModel):
    """Vercel Hobby and Pro Fluid Compute billing limits."""

    hobby_included_fast_data_transfer_gb: float = Field(ge=0)
    hobby_included_edge_requests: int = Field(gt=0)
    hobby_included_function_invocations: int = Field(gt=0)
    hobby_included_active_cpu_hours: float = Field(ge=0)
    hobby_included_provisioned_memory_gb_hours: float = Field(ge=0)
    pro_base_seat_usd: float = Field(ge=0)
    pro_included_fast_data_transfer_gb: float = Field(ge=0)
    pro_included_edge_requests: int = Field(gt=0)
    pro_extra_data_transfer_per_gb_usd: float = Field(ge=0)
    pro_extra_edge_requests_per_million_usd: float = Field(ge=0)
    pro_active_cpu_per_hour_usd: float = Field(ge=0)
    pro_provisioned_memory_per_gb_hour_usd: float = Field(ge=0)
    default_max_duration_seconds: int = Field(ge=1, le=900)
    default_memory_mb: int = Field(ge=128, le=4096)


class VercelProjectContract(StrictModel):
    """Declarative Vercel project contract."""

    name: str
    framework: str
    production_url: str | None = None
    node_version: str
    fluid_compute: bool = True


class ProMonthlyUsage(StrictModel):
    """Monthly Vercel Pro usage input."""

    seats: int = Field(ge=1, default=1)
    fast_data_transfer_gb: float = Field(ge=0)
    edge_requests: int = Field(ge=0)
    active_cpu_hours: float = Field(ge=0)
    provisioned_memory_gb_hours: float = Field(ge=0)


class ProCostEstimate(StrictModel):
    """Itemized monthly Vercel Pro cost estimate in USD."""

    seats_usd: float
    data_transfer_overage_usd: float
    edge_requests_overage_usd: float
    active_cpu_usd: float
    provisioned_memory_usd: float
    total_usd: float


def load_manifest(path: Path) -> dict[str, object]:
    """Load ay-vercel.toml with stdlib tomllib."""
    with path.open("rb") as fh:
        return tomllib.load(fh)


def estimate_pro_monthly_cost(policy: FinOpsPolicy, usage: ProMonthlyUsage) -> ProCostEstimate:
    """Compute itemized monthly Vercel Pro spend under Fluid Compute."""
    seats_usd = usage.seats * policy.pro_base_seat_usd
    extra_gb = max(0.0, usage.fast_data_transfer_gb - policy.pro_included_fast_data_transfer_gb)
    transfer_overage = extra_gb * policy.pro_extra_data_transfer_per_gb_usd
    extra_req = max(0, usage.edge_requests - policy.pro_included_edge_requests)
    req_overage = (extra_req / 1_000_000.0) * policy.pro_extra_edge_requests_per_million_usd
    cpu_usd = usage.active_cpu_hours * policy.pro_active_cpu_per_hour_usd
    mem_usd = usage.provisioned_memory_gb_hours * policy.pro_provisioned_memory_per_gb_hour_usd
    total = round(seats_usd + transfer_overage + req_overage + cpu_usd + mem_usd, 4)
    return ProCostEstimate(
        seats_usd=round(seats_usd, 4),
        data_transfer_overage_usd=round(transfer_overage, 4),
        edge_requests_overage_usd=round(req_overage, 4),
        active_cpu_usd=round(cpu_usd, 4),
        provisioned_memory_usd=round(mem_usd, 4),
        total_usd=total,
    )
