import time
import math
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from scipy.optimize import minimize

class AssetDefinition(BaseModel):
    ticker: str
    expected_annual_return: float  # e.g., 0.12 for 12%
    volatility_std_dev: float  # e.g., 0.18 for 18%

class PortfolioRequest(BaseModel):
    assets: List[AssetDefinition]
    correlation_matrix: Optional[List[List[float]]] = None  # Pairwise asset correlation
    risk_free_rate: float = 0.04  # 4% risk free rate
    target_return: Optional[float] = None
    allow_short_selling: bool = False

class PortfolioResultResponse(BaseModel):
    status: str
    optimal_weights: Dict[str, float]
    expected_annual_return: float
    portfolio_volatility: float
    sharpe_ratio: float
    minimum_variance_portfolio: Dict[str, Any]
    max_sharpe_portfolio: Dict[str, Any]
    efficient_frontier_curve: List[Dict[str, float]]
    execution_time_sec: float
    mathematical_summary: str


class FinancialPortfolioSolver:
    """
    Markowitz Mean-Variance Portfolio Optimization Engine:
    Computes the Global Minimum Variance Portfolio (GMVP),
    Tangency / Maximum Sharpe Ratio Portfolio, and the continuous Efficient Frontier.
    """

    def solve(self, req: PortfolioRequest) -> PortfolioResultResponse:
        start_time = time.perf_counter()
        n = len(req.assets)
        if n < 2:
            raise ValueError("At least 2 assets required for portfolio diversification and optimization.")

        tickers = [a.ticker for a in req.assets]
        mu = np.array([a.expected_annual_return for a in req.assets], dtype=float)
        sigmas = np.array([a.volatility_std_dev for a in req.assets], dtype=float)

        # Build Covariance Matrix Sigma
        if req.correlation_matrix:
            corr = np.array(req.correlation_matrix, dtype=float)
        else:
            # Default mild positive correlation 0.2
            corr = np.eye(n) + 0.2 * (np.ones((n, n)) - np.eye(n))

        cov_matrix = np.outer(sigmas, sigmas) * corr
        # Ensure positive semi-definite
        cov_matrix = (cov_matrix + cov_matrix.T) / 2.0
        eigvals, eigvecs = np.linalg.eigh(cov_matrix)
        eigvals = np.maximum(eigvals, 1e-6)
        cov_matrix = eigvecs @ np.diag(eigvals) @ eigvecs.T

        bounds = None if req.allow_short_selling else [(0.0, 1.0) for _ in range(n)]

        def portfolio_stats(w):
            w = np.array(w)
            ret = float(np.dot(w, mu))
            var = float(w @ cov_matrix @ w)
            vol = math.sqrt(max(0.0, var))
            sharpe = (ret - req.risk_free_rate) / max(1e-6, vol)
            return ret, vol, sharpe

        # 1. Global Minimum Variance Portfolio (GMVP)
        res_min_var = minimize(
            fun=lambda w: float(w @ cov_matrix @ w),
            x0=np.ones(n) / n,
            method="SLSQP",
            bounds=bounds,
            constraints={"type": "eq", "fun": lambda w: np.sum(w) - 1.0}
        )
        w_min_var = res_min_var.x
        ret_min, vol_min, sharpe_min = portfolio_stats(w_min_var)

        # 2. Maximum Sharpe Ratio Portfolio (Tangency)
        res_sharpe = minimize(
            fun=lambda w: -portfolio_stats(w)[2],
            x0=np.ones(n) / n,
            method="SLSQP",
            bounds=bounds,
            constraints={"type": "eq", "fun": lambda w: np.sum(w) - 1.0}
        )
        w_max_sharpe = res_sharpe.x
        ret_sharpe, vol_sharpe, sharpe_max = portfolio_stats(w_max_sharpe)

        # 3. User Target Return or Default
        if req.target_return is not None:
            r_target = req.target_return
            res_opt = minimize(
                fun=lambda w: float(w @ cov_matrix @ w),
                x0=np.ones(n) / n,
                method="SLSQP",
                bounds=bounds,
                constraints=[
                    {"type": "eq", "fun": lambda w: np.sum(w) - 1.0},
                    {"type": "eq", "fun": lambda w: np.dot(w, mu) - r_target}
                ]
            )
            w_opt = res_opt.x
        else:
            w_opt = w_max_sharpe

        ret_opt, vol_opt, sharpe_opt = portfolio_stats(w_opt)

        # 4. Generate Efficient Frontier Curve
        min_r = ret_min
        max_r = float(np.max(mu)) * 1.05
        frontier_points = []

        for r_sample in np.linspace(min_r, max_r, 20):
            res_point = minimize(
                fun=lambda w: float(w @ cov_matrix @ w),
                x0=np.ones(n) / n,
                method="SLSQP",
                bounds=bounds,
                constraints=[
                    {"type": "eq", "fun": lambda w: np.sum(w) - 1.0},
                    {"type": "eq", "fun": lambda w: np.dot(w, mu) - r_sample}
                ]
            )
            if res_point.success:
                p_ret, p_vol, p_sh = portfolio_stats(res_point.x)
                frontier_points.append({
                    "volatility_risk": round(p_vol, 4),
                    "expected_return": round(p_ret, 4),
                    "sharpe_ratio": round(p_sh, 3)
                })

        exec_time = time.perf_counter() - start_time

        summary = (
            f"Markowitz Mean-Variance Portfolio optimized across {n} assets. "
            f"Expected Return: {ret_opt*100:.2f}%, Volatility (Risk): {vol_opt*100:.2f}%, "
            f"Sharpe Ratio: {sharpe_opt:.2f}. "
            f"Max Sharpe Allocation achieved at {ret_sharpe*100:.2f}% return with {vol_sharpe*100:.2f}% volatility."
        )

        return PortfolioResultResponse(
            status="OPTIMAL",
            optimal_weights={tickers[i]: round(float(w_opt[i]), 4) for i in range(n)},
            expected_annual_return=round(ret_opt, 4),
            portfolio_volatility=round(vol_opt, 4),
            sharpe_ratio=round(sharpe_opt, 3),
            minimum_variance_portfolio={
                "weights": {tickers[i]: round(float(w_min_var[i]), 4) for i in range(n)},
                "expected_return": round(ret_min, 4),
                "volatility": round(vol_min, 4),
                "sharpe_ratio": round(sharpe_min, 3)
            },
            max_sharpe_portfolio={
                "weights": {tickers[i]: round(float(w_max_sharpe[i]), 4) for i in range(n)},
                "expected_return": round(ret_sharpe, 4),
                "volatility": round(vol_sharpe, 4),
                "sharpe_ratio": round(sharpe_max, 3)
            },
            efficient_frontier_curve=frontier_points,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

financial_solver = FinancialPortfolioSolver()
