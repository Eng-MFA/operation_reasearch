import time
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field

from app.engine.lp_solver import lp_solver, LPModelRequest, VariableDefinition, ConstraintDefinition

class ScenarioDefinition(BaseModel):
    name: str
    probability: float  # sum(p) = 1.0
    demand: float
    unit_selling_price: float
    penalty_or_salvage: float = 0.0

class TwoStageStochasticRequest(BaseModel):
    name: str = "Two-Stage Stochastic Capacity Problem"
    unit_first_stage_cost: float = 30.0  # Cost per unit of capacity acquired in stage 1
    scenarios: List[ScenarioDefinition]
    max_capacity: float = 1000.0

class StochasticResultResponse(BaseModel):
    status: str
    optimal_first_stage_decision: float
    expected_profit_or_cost: float
    recourse_problem_value: float  # RP
    expected_value_problem_value: float  # EEV
    wait_and_see_value: float  # WS
    evpi: float  # Expected Value of Perfect Information = |WS - RP|
    vss: float  # Value of Stochastic Solution = |EEV - RP|
    scenario_outcomes: List[Dict[str, Any]]
    monte_carlo_distribution: List[float]
    execution_time_sec: float
    mathematical_summary: str


class StochasticSolver:
    """
    Two-Stage Stochastic Programming and Recourse Optimization engine:
    Computes optimal here-and-now stage 1 decisions, Wait-and-See (WS),
    Recourse Problem (RP), Expected Value Solution (EEV), EVPI, and VSS.
    """

    def solve_two_stage(self, req: TwoStageStochasticRequest) -> StochasticResultResponse:
        start_time = time.perf_counter()

        probs = [s.probability for s in req.scenarios]
        if abs(sum(probs) - 1.0) > 1e-4:
            raise ValueError(f"Scenario probabilities must sum to 1.0 (current sum: {sum(probs):.4f}).")

        # 1. Deterministic Equivalent LP Formulation (RP)
        # Maximize Profit: - c * x + sum_s p_s * (price_s * sales_s + salvage_s * leftover_s)
        # Subject to:
        # sales_s <= x
        # sales_s <= demand_s
        # leftover_s = x - sales_s
        # x <= max_capacity

        lp_vars = [VariableDefinition(name="x", lower_bound=0.0, upper_bound=req.max_capacity)]
        obj_coeffs = {"x": -req.unit_first_stage_cost}
        lp_cons = []

        for i, s in enumerate(req.scenarios):
            s_name = f"sales_{i}"
            l_name = f"left_{i}"
            lp_vars.append(VariableDefinition(name=s_name, lower_bound=0.0))
            lp_vars.append(VariableDefinition(name=l_name, lower_bound=0.0))

            obj_coeffs[s_name] = s.probability * s.unit_selling_price
            obj_coeffs[l_name] = s.probability * s.penalty_or_salvage

            # sales_s <= x -> sales_s - x <= 0
            lp_cons.append(ConstraintDefinition(
                name=f"SalesCap_{i}",
                coefficients={s_name: 1.0, "x": -1.0},
                relation="<=",
                rhs=0.0
            ))
            # sales_s <= demand_s
            lp_cons.append(ConstraintDefinition(
                name=f"Demand_{i}",
                coefficients={s_name: 1.0},
                relation="<=",
                rhs=s.demand
            ))
            # leftover_s - x + sales_s == 0
            lp_cons.append(ConstraintDefinition(
                name=f"Balance_{i}",
                coefficients={l_name: 1.0, "x": -1.0, s_name: 1.0},
                relation="==",
                rhs=0.0
            ))

        lp_req = LPModelRequest(
            name="Two-Stage Stochastic Recourse",
            sense="maximize",
            variables=lp_vars,
            objective_coefficients=obj_coeffs,
            constraints=lp_cons
        )

        rp_res = lp_solver.solve(lp_req)
        opt_x = rp_res.variable_values.get("x", 0.0)
        rp_val = rp_res.objective_value

        # 2. Wait-and-See (WS): Perfect information in each scenario
        ws_val = 0.0
        scenario_outcomes = []
        for i, s in enumerate(req.scenarios):
            # Perfect foresight: x_s = s.demand
            ideal_x = min(s.demand, req.max_capacity)
            profit_s = -req.unit_first_stage_cost * ideal_x + s.unit_selling_price * ideal_x
            ws_val += s.probability * profit_s

            sales_actual = min(opt_x, s.demand)
            leftover_actual = max(0.0, opt_x - sales_actual)
            profit_actual = -req.unit_first_stage_cost * opt_x + (s.unit_selling_price * sales_actual) + (s.penalty_or_salvage * leftover_actual)

            scenario_outcomes.append({
                "scenario": s.name,
                "probability": s.probability,
                "demand": s.demand,
                "optimal_sales": round(sales_actual, 2),
                "leftover": round(leftover_actual, 2),
                "profit": round(profit_actual, 2)
            })

        # 3. Expected Value Solution (EEV): Use average demand in deterministic problem
        avg_demand = sum(s.probability * s.demand for s in req.scenarios)
        x_ev = min(avg_demand, req.max_capacity)
        # Evaluate x_ev across all scenarios
        eev_val = 0.0
        for s in req.scenarios:
            s_sales = min(x_ev, s.demand)
            s_left = max(0.0, x_ev - s_sales)
            eev_val += s.probability * (-req.unit_first_stage_cost * x_ev + s.unit_selling_price * s_sales + s.penalty_or_salvage * s_left)

        evpi = max(0.0, ws_val - rp_val)
        vss = max(0.0, rp_val - eev_val)

        # 4. Monte Carlo Simulation of Profit Distribution
        rng = np.random.default_rng(42)
        mc_samples = []
        p_cdf = np.cumsum(probs)
        for _ in range(500):
            r = rng.random()
            scen_idx = int(np.searchsorted(p_cdf, r))
            scen_idx = min(scen_idx, len(req.scenarios) - 1)
            scen = req.scenarios[scen_idx]
            # Add continuous Gaussian jitter around demand
            sim_demand = max(0.0, rng.normal(scen.demand, scen.demand * 0.1))
            sim_sales = min(opt_x, sim_demand)
            sim_left = max(0.0, opt_x - sim_sales)
            sim_profit = -req.unit_first_stage_cost * opt_x + scen.unit_selling_price * sim_sales + scen.penalty_or_salvage * sim_left
            mc_samples.append(round(float(sim_profit), 2))

        exec_time = time.perf_counter() - start_time

        summary = (
            f"Two-Stage Stochastic Programming model solved. Optimal 1st Stage Decision: x* = {opt_x:.2f} units. "
            f"Recourse Problem (RP) Expected Profit: ${rp_val:.2f}. "
            f"EVPI (Expected Value of Perfect Information): ${evpi:.2f} (max value of acquiring perfect foresight). "
            f"VSS (Value of Stochastic Solution): ${vss:.2f} (gain over using a deterministic mean model)."
        )

        return StochasticResultResponse(
            status="OPTIMAL",
            optimal_first_stage_decision=round(opt_x, 2),
            expected_profit_or_cost=round(rp_val, 2),
            recourse_problem_value=round(rp_val, 2),
            expected_value_problem_value=round(eev_val, 2),
            wait_and_see_value=round(ws_val, 2),
            evpi=round(evpi, 2),
            vss=round(vss, 2),
            scenario_outcomes=scenario_outcomes,
            monte_carlo_distribution=mc_samples,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

stochastic_solver = StochasticSolver()
