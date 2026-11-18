"""Tests validating ay-vercel.toml against Pydantic v2 and FinOps models."""

from __future__ import annotations

from pathlib import Path

from ay_vercel_py import (
    FinOpsPolicy,
    ProMonthlyUsage,
    VercelProjectContract,
    estimate_pro_monthly_cost,
    load_manifest,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_ay_vercel_manifest_validates() -> None:
    """Ensure ay-vercel.toml validates cleanly."""
    raw = load_manifest(REPO_ROOT / "ay-vercel.toml")
    finops = FinOpsPolicy.model_validate(raw["finops"])
    assert finops.default_memory_mb == 1024

    projects = raw["project"]
    assert isinstance(projects, list)
    assert len(projects) >= 3
    for proj in projects:
        parsed = VercelProjectContract.model_validate(proj)
        assert parsed.fluid_compute is True

    est = estimate_pro_monthly_cost(
        finops,
        ProMonthlyUsage(
            seats=1,
            fast_data_transfer_gb=250.0,
            edge_requests=2_000_000,
            active_cpu_hours=10.0,
            provisioned_memory_gb_hours=100.0,
        ),
    )
    assert est.data_transfer_overage_usd == 0.0
    assert est.total_usd > 20.0
