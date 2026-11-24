import time
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field

class DPTableEntry(BaseModel):
    stage: int
    state: int
    decision: int
    cost_or_value: float
    accumulated_value: float

class KnapsackItem(BaseModel):
    name: str
    weight: int
    value: float

class ResourceActivity(BaseModel):
    name: str
    returns: List[float]  # returns[x] is return for allocating x units of resource

class DPModelRequest(BaseModel):
    problem_type: str = "knapsack"  # "knapsack", "resource_allocation", "inventory"
    # Knapsack params
    knapsack_capacity: int = 50
    knapsack_items: List[KnapsackItem] = []
    # Resource allocation params
    total_resource: int = 10
    activities: List[ResourceActivity] = []
    # Inventory DP params
    periods: int = 4
    demands: List[int] = [2, 3, 2, 4]
    holding_cost_per_unit: float = 1.0
    production_setup_cost: float = 3.0
    unit_production_cost: float = 1.0
    max_production_capacity: int = 5
    max_inventory_capacity: int = 6

class DPResultResponse(BaseModel):
    problem_type: str
    optimal_value: float
    optimal_decisions: Dict[str, Any]
    dp_table: List[Dict[str, Any]]
    execution_time_sec: float
    mathematical_summary: str


class DPSolver:
    """
    Dynamic Programming engine implementing the Principle of Optimality (Bellman Equation)
    for Knapsack, Multistage Resource Allocation, and Wagner-Whitin style Inventory lot-sizing.
    """

    def solve(self, req: DPModelRequest) -> DPResultResponse:
        start_time = time.perf_counter()

        if req.problem_type == "knapsack":
            res = self._solve_knapsack(req)
        elif req.problem_type == "resource_allocation":
            res = self._solve_resource_allocation(req)
        elif req.problem_type == "inventory":
            res = self._solve_inventory_dp(req)
        else:
            raise ValueError(f"Unsupported DP problem type: {req.problem_type}")

        exec_time = time.perf_counter() - start_time
        res.execution_time_sec = exec_time
        return res

    def _solve_knapsack(self, req: DPModelRequest) -> DPResultResponse:
        W = req.knapsack_capacity
        items = req.knapsack_items
        n = len(items)

        # dp[i][w] = max value using a subset of first i items with weight capacity w
        dp = [[0.0] * (W + 1) for _ in range(n + 1)]
        choice = [[False] * (W + 1) for _ in range(n + 1)]

        for i in range(1, n + 1):
            item = items[i - 1]
            wt = item.weight
            val = item.value
            for w in range(W + 1):
                # Don't pick item
                dp[i][w] = dp[i - 1][w]
                # Try picking item
                if wt <= w:
                    pick_val = dp[i - 1][w - wt] + val
                    if pick_val > dp[i][w]:
                        dp[i][w] = pick_val
                        choice[i][w] = True

        # Reconstruct optimal policy
        curr_w = W
        selected_items = []
        for i in range(n, 0, -1):
            if choice[i][curr_w]:
                selected_items.append(items[i - 1].name)
                curr_w -= items[i - 1].weight

        selected_items.reverse()
        optimal_val = dp[n][W]

        # Tabulate sample of DP grid
        dp_sample = []
        step_w = max(1, W // 10)
        for i in range(n + 1):
            row_data = {"stage_item": items[i - 1].name if i > 0 else "Base"}
            for w in range(0, W + 1, step_w):
                row_data[f"cap_{w}"] = round(dp[i][w], 2)
            dp_sample.append(row_data)

        summary = (
            f"0-1 Knapsack solved via Dynamic Programming. "
            f"Optimal Value: {optimal_val:.2f} using items: {', '.join(selected_items)} "
            f"with total weight capacity {W}."
        )

        return DPResultResponse(
            problem_type="knapsack",
            optimal_value=optimal_val,
            optimal_decisions={"selected_items": selected_items, "items_count": len(selected_items)},
            dp_table=dp_sample,
            execution_time_sec=0.0,
            mathematical_summary=summary
        )

    def _solve_resource_allocation(self, req: DPModelRequest) -> DPResultResponse:
        """
        Multistage resource allocation:
        f_i(s) = max_{0 <= x <= s} [ returns_i(x) + f_{i-1}(s - x) ]
        """
        R = req.total_resource
        acts = req.activities
        n = len(acts)

        # dp[i][r] = max return allocating r units across activities 0..i
        dp = [[0.0] * (R + 1) for _ in range(n)]
        decisions = [[0] * (R + 1) for _ in range(n)]

        # Base stage (activity 0)
        act0 = acts[0]
        for r in range(R + 1):
            dp[0][r] = act0.returns[r] if r < len(act0.returns) else act0.returns[-1]
            decisions[0][r] = r

        # Stages 1..n-1
        for i in range(1, n):
            act = acts[i]
            for r in range(R + 1):
                best_val = -1e9
                best_x = 0
                max_alloc = min(r, len(act.returns) - 1)
                for x in range(max_alloc + 1):
                    val = act.returns[x] + dp[i - 1][r - x]
                    if val > best_val:
                        best_val = val
                        best_x = x
                dp[i][r] = best_val
                decisions[i][r] = best_x

        # Reconstruct allocation
        allocations = {}
        rem_r = R
        for i in range(n - 1, -1, -1):
            x = decisions[i][rem_r]
            allocations[acts[i].name] = x
            rem_r -= x

        dp_sample = []
        for i in range(n):
            row = {"activity": acts[i].name}
            for r in range(R + 1):
                row[f"res_{r}"] = round(dp[i][r], 2)
            dp_sample.append(row)

        summary = (
            f"Multistage Resource Allocation solved via Bellman's Principle of Optimality. "
            f"Maximum Total Return: {dp[n - 1][R]:.2f}. Allocations: {allocations}."
        )

        return DPResultResponse(
            problem_type="resource_allocation",
            optimal_value=float(dp[n - 1][R]),
            optimal_decisions={"allocations": allocations},
            dp_table=dp_sample,
            execution_time_sec=0.0,
            mathematical_summary=summary
        )

    def _solve_inventory_dp(self, req: DPModelRequest) -> DPResultResponse:
        """
        Wagner-Whitin dynamic lot-sizing DP:
        Minimizes ordering setup cost + holding cost across discrete time horizons.
        """
        T = req.periods
        demands = req.demands[:T]
        setup = req.production_setup_cost
        h_cost = req.holding_cost_per_unit

        # F(t) = minimum cost to satisfy demand from period 1 to t
        F = [0.0] * (T + 1)
        parent = [0] * (T + 1)

        for t in range(1, T + 1):
            min_cost = float("inf")
            best_j = 1
            for j in range(1, t + 1):
                # Produce in period j to satisfy demands from j to t
                holding = sum(h_cost * demands[k - 1] * (k - j) for k in range(j, t + 1))
                prod_cost = setup + holding + sum(req.unit_production_cost * demands[k - 1] for k in range(j, t + 1))
                total = F[j - 1] + prod_cost
                if total < min_cost:
                    min_cost = total
                    best_j = j
            F[t] = min_cost
            parent[t] = best_j

        # Reconstruct production order schedule
        production_schedule = [0] * T
        curr = T
        while curr > 0:
            prod_period = parent[curr]
            qty = sum(demands[k - 1] for k in range(prod_period, curr + 1))
            production_schedule[prod_period - 1] = qty
            curr = prod_period - 1

        dp_table = []
        for t in range(1, T + 1):
            dp_table.append({
                "period": t,
                "demand": demands[t - 1],
                "min_accumulated_cost": round(F[t], 2),
                "last_order_period": parent[t],
                "production_amount": production_schedule[t - 1]
            })

        summary = (
            f"Dynamic Inventory Lot Sizing (Wagner-Whitin) solved. "
            f"Total Minimum Cost over {T} periods: ${F[T]:.2f}. "
            f"Optimal production schedule: {production_schedule}."
        )

        return DPResultResponse(
            problem_type="inventory",
            optimal_value=round(F[T], 2),
            optimal_decisions={"production_schedule": production_schedule, "periods": T},
            dp_table=dp_table,
            execution_time_sec=0.0,
            mathematical_summary=summary
        )

dp_solver = DPSolver()
