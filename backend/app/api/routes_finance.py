from fastapi import APIRouter, HTTPException
import numpy as np
import time
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.engine.finance_solver import financial_solver, PortfolioRequest, PortfolioResultResponse

router = APIRouter(prefix="/finance", tags=["Business & Financial Optimization"])

@router.post("/portfolio", response_model=PortfolioResultResponse)
def solve_portfolio(req: PortfolioRequest):
    try:
        return financial_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Portfolio Optimization Error: {str(e)}")


class EfficientFrontierRequest(BaseModel):
    assets: List[Dict[str, Any]]  # [{ticker, expected_annual_return, volatility_std_dev}]
    correlation_matrix: Optional[List[List[float]]] = None
    risk_free_rate: float = 0.04
    num_points: int = 50


class EfficientFrontierResult(BaseModel):
    status: str
    frontier_points: List[Dict[str, float]]  # [{volatility, return, sharpe}]
    min_variance_point: Dict[str, float]
    max_sharpe_point: Dict[str, float]
    execution_time_sec: float


@router.post("/efficient-frontier", response_model=EfficientFrontierResult)
def compute_efficient_frontier(req: EfficientFrontierRequest):
    try:
        from scipy.optimize import minimize

        start = time.perf_counter()
        n = len(req.assets)
        if n < 2:
            raise ValueError("Need at least 2 assets")

        tickers = [a.get("ticker", a.get("name", f"A{i}")) for i, a in enumerate(req.assets)]
        mu = np.array([a.get("expected_annual_return", a.get("expected_return", 0.1)) for a in req.assets])
        sigmas = np.array([a.get("volatility_std_dev", a.get("std_dev", 0.2)) for a in req.assets])

        if req.correlation_matrix and len(req.correlation_matrix) == n:
            corr = np.array(req.correlation_matrix)
        else:
            corr = np.eye(n)

        cov = np.outer(sigmas, sigmas) * corr

        def port_vol(w):
            return float(np.sqrt(w @ cov @ w))

        def port_ret(w):
            return float(w @ mu)

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0, 1)] * n
        w0 = np.ones(n) / n

        # Find min return and max return
        ret_min = float(np.min(mu))
        ret_max = float(np.max(mu))
        target_returns = np.linspace(ret_min + 1e-6, ret_max - 1e-6, req.num_points)

        frontier_points = []
        for tr in target_returns:
            cons = constraints + [{"type": "eq", "fun": lambda w, tr=tr: w @ mu - tr}]
            res = minimize(lambda w: port_vol(w), w0, method="SLSQP", bounds=bounds, constraints=cons,
                           options={"maxiter": 500, "ftol": 1e-10})
            if res.success:
                vol = port_vol(res.x)
                ret = port_ret(res.x)
                sharpe = (ret - req.risk_free_rate) / vol if vol > 1e-8 else 0
                frontier_points.append({"volatility": round(vol, 6), "return": round(ret, 6), "sharpe": round(sharpe, 4)})

        if not frontier_points:
            raise ValueError("Could not compute efficient frontier")

        # Min variance
        res_mv = minimize(lambda w: port_vol(w), w0, method="SLSQP", bounds=bounds, constraints=constraints,
                          options={"maxiter": 500})
        min_v_pt = {"volatility": round(port_vol(res_mv.x), 6), "return": round(port_ret(res_mv.x), 6),
                    "sharpe": round((port_ret(res_mv.x) - req.risk_free_rate) / max(port_vol(res_mv.x), 1e-8), 4)}

        # Max Sharpe
        def neg_sharpe(w):
            ret = w @ mu
            vol = np.sqrt(w @ cov @ w)
            return -(ret - req.risk_free_rate) / (vol + 1e-8)
        res_ms = minimize(neg_sharpe, w0, method="SLSQP", bounds=bounds, constraints=constraints,
                          options={"maxiter": 500})
        ms_pt = {"volatility": round(port_vol(res_ms.x), 6), "return": round(port_ret(res_ms.x), 6),
                 "sharpe": round(-neg_sharpe(res_ms.x), 4)}

        return EfficientFrontierResult(
            status="optimal",
            frontier_points=frontier_points,
            min_variance_point=min_v_pt,
            max_sharpe_point=ms_pt,
            execution_time_sec=round(time.perf_counter() - start, 4)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Efficient Frontier Error: {str(e)}")
