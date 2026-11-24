from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
import time

from app.engine.stochastic_solver import stochastic_solver, TwoStageStochasticRequest, StochasticResultResponse

router = APIRouter(prefix="/stochastic", tags=["Stochastic & Robust Optimization"])

@router.post("/two-stage", response_model=StochasticResultResponse)
def solve_two_stage_stochastic(req: TwoStageStochasticRequest):
    try:
        return stochastic_solver.solve_two_stage(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Stochastic Solver Error: {str(e)}")


class MonteCarloRequest(BaseModel):
    num_simulations: int = 1000
    distribution: str = "normal"  # 'normal', 'uniform', 'triangular'
    params: Dict[str, float] = {"mean": 100.0, "std": 20.0, "min_val": 60.0, "max_val": 140.0, "mode": 100.0}
    decision_vars: Dict[str, float] = {"quantity": 90.0, "price": 15.0, "cost": 8.0}


class MonteCarloResult(BaseModel):
    status: str
    mean_outcome: float
    std_outcome: float
    percentile_5: float
    percentile_95: float
    prob_loss: float
    var_95: float
    cvar_95: float
    histogram_bins: List[float]
    histogram_counts: List[int]
    num_simulations: int
    execution_time_sec: float
    mathematical_summary: str


@router.post("/monte-carlo", response_model=MonteCarloResult)
def solve_monte_carlo(req: MonteCarloRequest):
    try:
        start = time.perf_counter()
        rng = np.random.default_rng(42)
        n = max(100, min(req.num_simulations, 50000))

        p = req.params
        dist = req.distribution.lower()
        if dist == "normal":
            demands = rng.normal(p.get("mean", 100), p.get("std", 20), n)
        elif dist == "uniform":
            demands = rng.uniform(p.get("min_val", 60), p.get("max_val", 140), n)
        elif dist == "triangular":
            lo = p.get("min_val", 60)
            hi = p.get("max_val", 140)
            mode = p.get("mode", 100)
            # numpy triangular uses (left, mode, right) with mode in [0,1] relative
            c = (mode - lo) / (hi - lo) if hi > lo else 0.5
            demands = rng.triangular(lo, lo + c * (hi - lo), hi, n)
        else:
            demands = rng.normal(p.get("mean", 100), p.get("std", 20), n)

        q = req.decision_vars.get("quantity", 90)
        price = req.decision_vars.get("price", 15)
        cost = req.decision_vars.get("cost", 8)

        sales = np.minimum(demands, q)
        profits = price * sales - cost * q

        mean_p = float(np.mean(profits))
        std_p = float(np.std(profits))
        p5 = float(np.percentile(profits, 5))
        p95 = float(np.percentile(profits, 95))
        prob_loss = float(np.mean(profits < 0))
        # VaR at 95% confidence (5th percentile of losses = negative profits)
        var_95 = float(-np.percentile(profits, 5))
        losses_below_var = profits[profits <= np.percentile(profits, 5)]
        cvar_95 = float(-np.mean(losses_below_var)) if len(losses_below_var) > 0 else 0.0

        # Histogram (20 bins)
        counts, edges = np.histogram(profits, bins=20)
        bin_centers = [(edges[i] + edges[i+1]) / 2 for i in range(len(edges)-1)]

        elapsed = time.perf_counter() - start
        return MonteCarloResult(
            status="success",
            mean_outcome=round(mean_p, 4),
            std_outcome=round(std_p, 4),
            percentile_5=round(p5, 4),
            percentile_95=round(p95, 4),
            prob_loss=round(prob_loss, 4),
            var_95=round(var_95, 4),
            cvar_95=round(cvar_95, 4),
            histogram_bins=[round(b, 2) for b in bin_centers],
            histogram_counts=[int(c) for c in counts],
            num_simulations=n,
            execution_time_sec=round(elapsed, 4),
            mathematical_summary=f"Monte Carlo simulation ({dist}, n={n}): E[Profit]={mean_p:.2f}, Std={std_p:.2f}, P(Loss)={prob_loss*100:.1f}%, VaR(95%)={var_95:.2f}"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Monte Carlo Error: {str(e)}")
