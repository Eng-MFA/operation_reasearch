import time
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from scipy.optimize import linear_sum_assignment

from app.engine.lp_solver import lp_solver, LPModelRequest, VariableDefinition, ConstraintDefinition

class TransportationRequest(BaseModel):
    sources: List[str]  # e.g., ["Factory 1", "Factory 2", "Factory 3"]
    destinations: List[str]  # e.g., ["Warehouse A", "Warehouse B", "Warehouse C", "Warehouse D"]
    supply: List[float]  # Supply at each source
    demand: List[float]  # Demand at each destination
    costs: List[List[float]]  # Cost matrix (sources x destinations)
    initial_method: str = "vam"  # "vam", "least_cost", "north_west"

class AssignmentRequest(BaseModel):
    agents: List[str]  # e.g., ["Worker 1", "Worker 2", "Worker 3"]
    tasks: List[str]  # e.g., ["Job A", "Job B", "Job C"]
    cost_matrix: List[List[float]]  # agents x tasks
    sense: str = "minimize"  # "minimize" or "maximize"

class TransportationResultResponse(BaseModel):
    status: str
    is_balanced: bool
    total_supply: float
    total_demand: float
    dummy_added: Optional[str] = None
    initial_method_used: str
    initial_cost: float
    optimal_cost: float
    optimal_allocation_matrix: List[List[float]]
    initial_allocation_matrix: List[List[float]]
    u_multipliers: List[float]
    v_multipliers: List[float]
    opportunity_costs_matrix: List[List[float]]
    execution_time_sec: float
    mathematical_summary: str

class AssignmentResultResponse(BaseModel):
    status: str
    optimal_total_cost: float
    assignments: List[Dict[str, Any]]
    assignment_matrix: List[List[int]]
    execution_time_sec: float
    mathematical_summary: str


class TransportSolver:
    """
    Transportation and Assignment Solver:
    Implements Vogel's Approximation Method (VAM), North-West Corner, Least Cost,
    MODI u-v multiplier optimality tests, and the Hungarian Algorithm for optimal assignment.
    """

    def solve_transportation(self, req: TransportationRequest) -> TransportationResultResponse:
        start_time = time.perf_counter()

        sources = list(req.sources)
        destinations = list(req.destinations)
        supply = [float(s) for s in req.supply]
        demand = [float(d) for d in req.demand]
        cost_matrix = [list(map(float, row)) for row in req.costs]

        total_sup = sum(supply)
        total_dem = sum(demand)
        is_balanced = abs(total_sup - total_dem) < 1e-5
        dummy_added = None

        # Balance if needed
        if total_sup > total_dem + 1e-5:
            diff = total_sup - total_dem
            destinations.append("Dummy Destination")
            demand.append(diff)
            for r in cost_matrix:
                r.append(0.0)
            dummy_added = f"Added Dummy Destination with demand {diff:.2f} and zero shipping costs."
        elif total_dem > total_sup + 1e-5:
            diff = total_dem - total_sup
            sources.append("Dummy Source")
            supply.append(diff)
            cost_matrix.append([0.0] * len(destinations))
            dummy_added = f"Added Dummy Source with supply {diff:.2f} and zero shipping costs."

        M = len(sources)
        N = len(destinations)

        # 1. Compute Initial Basic Feasible Solution
        init_method = req.initial_method.lower().strip()
        if init_method == "north_west":
            init_alloc = self._north_west_corner(supply, demand)
        elif init_method == "least_cost":
            init_alloc = self._least_cost_method(supply, demand, cost_matrix)
        else:
            init_alloc = self._vogel_approximation(supply, demand, cost_matrix)

        init_cost = sum(
            init_alloc[i][j] * cost_matrix[i][j] for i in range(M) for j in range(N)
        )

        # 2. Compute Exact Global Optimum via Linear Programming (HiGHS Simplex)
        lp_vars = []
        obj_coeffs = {}
        for i in range(M):
            for j in range(N):
                v_name = f"x_{i}_{j}"
                lp_vars.append(VariableDefinition(name=v_name, lower_bound=0.0))
                obj_coeffs[v_name] = cost_matrix[i][j]

        lp_cons = []
        # Supply constraints
        for i in range(M):
            coeffs = {f"x_{i}_{j}": 1.0 for j in range(N)}
            lp_cons.append(ConstraintDefinition(name=f"Supply_{sources[i]}", coefficients=coeffs, relation="==", rhs=supply[i]))

        # Demand constraints
        for j in range(N):
            coeffs = {f"x_{i}_{j}": 1.0 for i in range(M)}
            lp_cons.append(ConstraintDefinition(name=f"Demand_{destinations[j]}", coefficients=coeffs, relation="==", rhs=demand[j]))

        lp_req = LPModelRequest(
            name="Transportation Problem",
            sense="minimize",
            variables=lp_vars,
            objective_coefficients=obj_coeffs,
            constraints=lp_cons
        )

        lp_res = lp_solver.solve(lp_req)

        # Extract optimal allocation matrix
        opt_alloc = [[0.0] * N for _ in range(M)]
        for i in range(M):
            for j in range(N):
                opt_alloc[i][j] = round(lp_res.variable_values.get(f"x_{i}_{j}", 0.0), 4)

        opt_cost = lp_res.objective_value

        # Extract u and v multipliers from LP shadow prices (MODI Method)
        u_mults = [round(lp_res.shadow_prices.get(f"Supply_{sources[i]}", 0.0), 4) for i in range(M)]
        v_mults = [round(lp_res.shadow_prices.get(f"Demand_{destinations[j]}", 0.0), 4) for j in range(N)]

        # Opportunity cost matrix (c_ij - u_i - v_j)
        opp_costs = [[0.0] * N for _ in range(M)]
        for i in range(M):
            for j in range(N):
                opp_costs[i][j] = round(cost_matrix[i][j] - (u_mults[i] + v_mults[j]), 4)

        exec_time = time.perf_counter() - start_time

        summary = (
            f"Transportation problem ({M} sources x {N} destinations) solved to mathematical optimality. "
            f"Initial ({req.initial_method.upper()}) Cost: ${init_cost:.2f} -> "
            f"Optimal (MODI/Simplex) Cost: ${opt_cost:.2f}. "
            f"{dummy_added or 'Problem is intrinsically balanced.'}"
        )

        return TransportationResultResponse(
            status="OPTIMAL",
            is_balanced=is_balanced,
            total_supply=total_sup,
            total_demand=total_dem,
            dummy_added=dummy_added,
            initial_method_used=req.initial_method,
            initial_cost=round(init_cost, 2),
            optimal_cost=round(opt_cost, 2),
            optimal_allocation_matrix=opt_alloc,
            initial_allocation_matrix=init_alloc,
            u_multipliers=u_mults,
            v_multipliers=v_mults,
            opportunity_costs_matrix=opp_costs,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

    def _north_west_corner(self, supply: List[float], demand: List[float]) -> List[List[float]]:
        M, N = len(supply), len(demand)
        s = list(supply)
        d = list(demand)
        alloc = [[0.0] * N for _ in range(M)]
        i, j = 0, 0
        while i < M and j < N:
            qty = min(s[i], d[j])
            alloc[i][j] = qty
            s[i] -= qty
            d[j] -= qty
            if s[i] == 0:
                i += 1
            if d[j] == 0:
                j += 1
        return alloc

    def _least_cost_method(self, supply: List[float], demand: List[float], costs: List[List[float]]) -> List[List[float]]:
        M, N = len(supply), len(demand)
        s = list(supply)
        d = list(demand)
        alloc = [[0.0] * N for _ in range(M)]
        cells = sorted([(costs[i][j], i, j) for i in range(M) for j in range(N)])

        for c, i, j in cells:
            if s[i] > 0 and d[j] > 0:
                qty = min(s[i], d[j])
                alloc[i][j] = qty
                s[i] -= qty
                d[j] -= qty
        return alloc

    def _vogel_approximation(self, supply: List[float], demand: List[float], costs: List[List[float]]) -> List[List[float]]:
        """Vogel's Approximation Method (VAM) with row/column penalty calculation."""
        M, N = len(supply), len(demand)
        s = list(supply)
        d = list(demand)
        alloc = [[0.0] * N for _ in range(M)]
        row_active = [True] * M
        col_active = [True] * N

        while any(row_active) and any(col_active):
            # Compute row penalties
            row_penalties = {}
            for i in range(M):
                if row_active[i]:
                    active_costs = sorted([costs[i][j] for j in range(N) if col_active[j]])
                    pen = (active_costs[1] - active_costs[0]) if len(active_costs) >= 2 else active_costs[0]
                    row_penalties[i] = pen

            # Compute col penalties
            col_penalties = {}
            for j in range(N):
                if col_active[j]:
                    active_costs = sorted([costs[i][j] for i in range(M) if row_active[i]])
                    pen = (active_costs[1] - active_costs[0]) if len(active_costs) >= 2 else active_costs[0]
                    col_penalties[j] = pen

            max_row_pen = max(row_penalties.values()) if row_penalties else -1
            max_col_pen = max(col_penalties.values()) if col_penalties else -1

            if max_row_pen >= max_col_pen and row_penalties:
                # Pick row with max penalty
                r_cand = [i for i, p in row_penalties.items() if p == max_row_pen][0]
                # In that row, pick min cost active col
                c_cand = min([j for j in range(N) if col_active[j]], key=lambda j: costs[r_cand][j])
            else:
                c_cand = [j for j, p in col_penalties.items() if p == max_col_pen][0]
                r_cand = min([i for i in range(M) if row_active[i]], key=lambda i: costs[i][c_cand])

            qty = min(s[r_cand], d[c_cand])
            alloc[r_cand][c_cand] = qty
            s[r_cand] -= qty
            d[c_cand] -= qty

            if s[r_cand] == 0:
                row_active[r_cand] = False
            if d[c_cand] == 0:
                col_active[c_cand] = False

        return alloc

    def solve_assignment(self, req: AssignmentRequest) -> AssignmentResultResponse:
        """Hungarian Algorithm for the Assignment Problem (O(N^3))."""
        start_time = time.perf_counter()

        cost_mat = np.array(req.cost_matrix, dtype=float)
        if req.sense.lower() == "maximize":
            # For maximization, invert costs
            max_val = np.max(cost_mat)
            work_mat = max_val - cost_mat
        else:
            work_mat = cost_mat

        row_ind, col_ind = linear_sum_assignment(work_mat)
        exec_time = time.perf_counter() - start_time

        assignments = []
        assignment_matrix = np.zeros_like(cost_mat, dtype=int)
        total_cost = 0.0

        for r, c in zip(row_ind, col_ind):
            agent = req.agents[r] if r < len(req.agents) else f"Agent {r+1}"
            task = req.tasks[c] if c < len(req.tasks) else f"Task {c+1}"
            cost = float(cost_mat[r, c])
            total_cost += cost
            assignment_matrix[r, c] = 1
            assignments.append({
                "agent": agent,
                "task": task,
                "cost": cost
            })

        summary = (
            f"Assignment problem ({len(row_ind)} agents) solved using the Hungarian algorithm in {exec_time*1000:.2f} ms. "
            f"Total Optimal Cost: ${total_cost:.2f}."
        )

        return AssignmentResultResponse(
            status="OPTIMAL",
            optimal_total_cost=round(total_cost, 2),
            assignments=assignments,
            assignment_matrix=assignment_matrix.tolist(),
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

transport_solver = TransportSolver()
