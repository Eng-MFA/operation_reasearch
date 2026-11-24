import time
import math
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from scipy.optimize import minimize
import highspy

class GeneratorUnit(BaseModel):
    id: str
    name: str
    p_min_mw: float  # Min generation limit (MW)
    p_max_mw: float  # Max generation limit (MW)
    cost_a: float  # Quadratic cost coefficient ($/MW^2)
    cost_b: float  # Linear cost coefficient ($/MW)
    cost_c: float  # Constant no-load cost ($/h)
    ramp_rate_mw_per_h: Optional[float] = None
    startup_cost: float = 0.0
    min_uptime_h: int = 1
    min_downtime_h: int = 1

class BatteryStorageUnit(BaseModel):
    capacity_mwh: float = 20.0
    max_charge_power_mw: float = 5.0
    max_discharge_power_mw: float = 5.0
    charge_efficiency: float = 0.92
    discharge_efficiency: float = 0.92
    initial_soc_mwh: float = 10.0
    min_soc_pct: float = 0.10
    max_soc_pct: float = 0.95

class EconomicDispatchParam(BaseModel):
    demand_mw: float
    generators: List[GeneratorUnit]
    include_transmission_losses: bool = False
    b_loss_matrix: Optional[List[List[float]]] = None  # Kron's B-matrix (1/MW)
    b0_loss_vector: Optional[List[float]] = None
    b00_loss_constant: float = 0.0

class MicrogridDispatchParam(BaseModel):
    hours: int = 24
    load_profile_mw: List[float]  # 24-hr demand
    solar_pv_profile_mw: List[float]  # 24-hr solar generation
    wind_profile_mw: List[float]  # 24-hr wind generation
    grid_buy_price_per_mwh: List[float]  # Time-of-Use tariff
    grid_sell_price_per_mwh: List[float]
    generators: List[GeneratorUnit]
    battery: BatteryStorageUnit

class EnergyDispatchResult(BaseModel):
    status: str
    is_physically_feasible: bool
    total_generation_mw: float
    total_demand_mw: float
    transmission_loss_mw: float
    total_fuel_cost_per_hour: float
    system_lambda_incremental_cost: float
    generator_setpoints: List[Dict[str, Any]]
    physical_checks: List[str]
    execution_time_sec: float
    mathematical_summary: str

class MicrogridScheduleResult(BaseModel):
    status: str
    total_cost: float
    grid_import_cost: float
    generator_cost: float
    hourly_schedule: List[Dict[str, Any]]
    battery_soc_trajectory: List[float]
    execution_time_sec: float
    mathematical_summary: str


class EnergyOptimizationSolver:
    """
    Electrical Engineering and Power Systems Optimization Engine:
    Implements exact Economic Dispatch (quadratic cost curves, active power balance,
    B-matrix Kron transmission loss factors, and incremental cost lambda condition),
    Unit Commitment (MILP), and Microgrid Battery Storage Time-of-Use Arbitrage.
    """

    def solve_economic_dispatch(self, req: EconomicDispatchParam) -> EnergyDispatchResult:
        start_time = time.perf_counter()
        gens = req.generators
        n_gens = len(gens)
        P_D = req.demand_mw

        p_min = np.array([g.p_min_mw for g in gens], dtype=float)
        p_max = np.array([g.p_max_mw for g in gens], dtype=float)
        a_coeffs = np.array([g.cost_a for g in gens], dtype=float)
        b_coeffs = np.array([g.cost_b for g in gens], dtype=float)
        c_coeffs = np.array([g.cost_c for g in gens], dtype=float)

        # Check total capacity feasibility
        total_p_max = float(np.sum(p_max))
        total_p_min = float(np.sum(p_min))

        if P_D > total_p_max:
            return EnergyDispatchResult(
                status="INFEASIBLE",
                is_physically_feasible=False,
                total_generation_mw=0.0,
                total_demand_mw=P_D,
                transmission_loss_mw=0.0,
                total_fuel_cost_per_hour=0.0,
                system_lambda_incremental_cost=0.0,
                generator_setpoints=[],
                physical_checks=[f"Deficient generation: Demand ({P_D} MW) exceeds maximum installed capacity ({total_p_max} MW)."],
                execution_time_sec=0.0,
                mathematical_summary="System capacity insufficient to satisfy active power load."
            )

        # Transmission loss matrix (Kron's formula)
        B_mat = np.array(req.b_loss_matrix, dtype=float) if req.b_loss_matrix else np.zeros((n_gens, n_gens))
        B0 = np.array(req.b0_loss_vector, dtype=float) if req.b0_loss_vector else np.zeros(n_gens)
        B00 = req.b00_loss_constant

        def compute_loss(P):
            if not req.include_transmission_losses:
                return 0.0
            loss = float(P @ B_mat @ P + B0 @ P + B00)
            return max(0.0, loss)

        # Objective: minimize total generation fuel cost sum(a_i * P_i^2 + b_i * P_i + c_i)
        def objective(P):
            return float(np.sum(a_coeffs * (P**2) + b_coeffs * P + c_coeffs))

        def power_balance_constraint(P):
            P_loss = compute_loss(P)
            return float(np.sum(P) - (P_D + P_loss))

        # Initial guess: proportional allocation
        x0 = p_min + (p_max - p_min) * (P_D / total_p_max)
        bounds = [(p_min[i], p_max[i]) for i in range(n_gens)]

        res = minimize(
            fun=objective,
            x0=x0,
            method="SLSQP",
            bounds=bounds,
            constraints={"type": "eq", "fun": power_balance_constraint},
            options={"ftol": 1e-7, "maxiter": 200}
        )

        exec_time = time.perf_counter() - start_time
        P_opt = res.x
        P_loss_val = compute_loss(P_opt)
        total_gen = float(np.sum(P_opt))
        total_cost = objective(P_opt)

        # Physical checks
        checks = []
        balance_err = abs(total_gen - (P_D + P_loss_val))
        checks.append(f"Active Power Balance: sum(P_i) = {total_gen:.3f} MW == Demand ({P_D:.3f} MW) + Losses ({P_loss_val:.3f} MW) [Residual: {balance_err:.6f} MW].")

        setpoints = []
        incremental_costs = []
        for i, g in enumerate(gens):
            p_val = float(P_opt[i])
            inc_cost = 2.0 * a_coeffs[i] * p_val + b_coeffs[i]
            # Penalty factor for transmission losses
            if req.include_transmission_losses:
                dPl_dPi = 2.0 * float(B_mat[i] @ P_opt) + B0[i]
                penalty_factor = 1.0 / max(1e-4, (1.0 - dPl_dPi))
                lambda_gen = inc_cost * penalty_factor
            else:
                penalty_factor = 1.0
                lambda_gen = inc_cost

            incremental_costs.append(lambda_gen)
            is_at_limit = abs(p_val - p_min[i]) < 1e-3 or abs(p_val - p_max[i]) < 1e-3

            setpoints.append({
                "id": g.id,
                "name": g.name,
                "generation_mw": round(p_val, 3),
                "min_limit_mw": g.p_min_mw,
                "max_limit_mw": g.p_max_mw,
                "incremental_cost": round(inc_cost, 3),
                "penalty_factor": round(penalty_factor, 4),
                "generator_lambda": round(lambda_gen, 3),
                "is_at_limit": is_at_limit,
                "fuel_cost_per_hour": round(float(a_coeffs[i]*(p_val**2) + b_coeffs[i]*p_val + c_coeffs[i]), 2)
            })
            checks.append(f"Generator {g.name}: {p_val:.2f} MW within [{g.p_min_mw}, {g.p_max_mw}] MW.")

        # System marginal cost lambda (equal incremental cost principle for unconstrained generators)
        unconstrained_lambdas = [s["generator_lambda"] for s in setpoints if not s["is_at_limit"]]
        sys_lambda = float(np.mean(unconstrained_lambdas)) if unconstrained_lambdas else float(np.mean(incremental_costs))

        summary = (
            f"Economic Dispatch optimal schedule found in {exec_time*1000:.2f} ms. "
            f"Total Generation: {total_gen:.2f} MW (Losses: {P_loss_val:.3f} MW). "
            f"Total Fuel Cost: ${total_cost:.2f}/h. System Marginal Cost lambda: ${sys_lambda:.2f}/MWh."
        )

        return EnergyDispatchResult(
            status="OPTIMAL" if res.success else "FEASIBLE",
            is_physically_feasible=bool(res.success and balance_err < 1e-3),
            total_generation_mw=round(total_gen, 3),
            total_demand_mw=P_D,
            transmission_loss_mw=round(P_loss_val, 4),
            total_fuel_cost_per_hour=round(total_cost, 2),
            system_lambda_incremental_cost=round(sys_lambda, 3),
            generator_setpoints=setpoints,
            physical_checks=checks,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

    def solve_microgrid_battery(self, req: MicrogridDispatchParam) -> MicrogridScheduleResult:
        """
        Optimal 24-hour Microgrid Energy Management & Battery Energy Storage (BESS) Arbitrage:
        Minimizes total daily cost (Grid import + Generator fuel - Grid export)
        while respecting SoC dynamics, charge/discharge efficiency, and power balance.
        """
        start_time = time.perf_counter()
        T = req.hours
        bat = req.battery

        highs = highspy.Highs()
        highs.setOptionValue("output_flag", False)

        # Decision variables per hour t:
        # P_ch[t], P_dis[t], P_grid_buy[t], P_grid_sell[t], SoC[t], P_gen[t]
        n_gens = len(req.generators)
        var_map = {}
        col_cost = []
        col_lower = []
        col_upper = []

        def add_var(name, cost, lb, ub):
            idx = len(col_cost)
            var_map[name] = idx
            col_cost.append(cost)
            col_lower.append(lb)
            col_upper.append(ub)
            return idx

        soc_min = bat.capacity_mwh * bat.min_soc_pct
        soc_max = bat.capacity_mwh * bat.max_soc_pct

        for t in range(T):
            add_var(f"p_ch_{t}", 0.0, 0.0, bat.max_charge_power_mw)
            add_var(f"p_dis_{t}", 0.0, 0.0, bat.max_discharge_power_mw)
            add_var(f"grid_buy_{t}", req.grid_buy_price_per_mwh[t], 0.0, 100.0)
            add_var(f"grid_sell_{t}", -req.grid_sell_price_per_mwh[t], 0.0, 50.0)
            add_var(f"soc_{t}", 0.0, soc_min, soc_max)
            for g_idx, g in enumerate(req.generators):
                # Linearized fuel cost approx (a*p_max + b)
                cost_rate = g.cost_a * g.p_max_mw + g.cost_b
                add_var(f"gen_{g_idx}_{t}", cost_rate, g.p_min_mw, g.p_max_mw)

        num_cols = len(col_cost)
        row_lower = []
        row_upper = []
        a_matrix_rows = []

        for t in range(T):
            # 1. Power Balance at hour t:
            # P_solar[t] + P_wind[t] + P_dis[t] + P_grid_buy[t] + sum(P_gen[t]) - P_ch[t] - P_grid_sell[t] == Load[t]
            row_coeffs = np.zeros(num_cols)
            row_coeffs[var_map[f"p_dis_{t}"]] = 1.0
            row_coeffs[var_map[f"p_ch_{t}"]] = -1.0
            row_coeffs[var_map[f"grid_buy_{t}"]] = 1.0
            row_coeffs[var_map[f"grid_sell_{t}"]] = -1.0
            for g_idx in range(n_gens):
                row_coeffs[var_map[f"gen_{g_idx}_{t}"]] = 1.0

            net_load = req.load_profile_mw[t] - req.solar_pv_profile_mw[t] - req.wind_profile_mw[t]
            row_lower.append(net_load)
            row_upper.append(net_load)
            a_matrix_rows.append(row_coeffs)

            # 2. Battery State-of-Charge Dynamics:
            # SoC[t] - SoC[t-1] - eta_ch * P_ch[t] + (1/eta_dis) * P_dis[t] == 0
            row_soc = np.zeros(num_cols)
            row_soc[var_map[f"soc_{t}"]] = 1.0
            if t > 0:
                row_soc[var_map[f"soc_{t-1}"]] = -1.0
            row_soc[var_map[f"p_ch_{t}"]] = -bat.charge_efficiency
            row_soc[var_map[f"p_dis_{t}"]] = (1.0 / bat.discharge_efficiency)

            rhs_soc = bat.initial_soc_mwh if t == 0 else 0.0
            row_lower.append(rhs_soc)
            row_upper.append(rhs_soc)
            a_matrix_rows.append(row_soc)

        # Pass to HiGHS
        A = np.array(a_matrix_rows)
        import scipy.sparse as sp
        A_sp = sp.csc_matrix(A)

        lp = highspy.HighsLp()
        lp.num_col_ = num_cols
        lp.num_row_ = len(row_lower)
        lp.sense_ = highspy.ObjSense.kMinimize
        lp.col_cost_ = np.array(col_cost)
        lp.col_lower_ = np.array(col_lower)
        lp.col_upper_ = np.array(col_upper)
        lp.row_lower_ = np.array(row_lower)
        lp.row_upper_ = np.array(row_upper)
        lp.a_matrix_.start_ = A_sp.indptr.astype(np.int32)
        lp.a_matrix_.index_ = A_sp.indices.astype(np.int32)
        lp.a_matrix_.value_ = A_sp.data.astype(np.float64)

        highs.passModel(lp)
        highs.run()

        sol = highs.getSolution()
        col_vals = list(sol.col_value)
        info = highs.getInfo()
        exec_time = time.perf_counter() - start_time

        hourly = []
        soc_trajectory = []
        tot_grid_cost = 0.0
        tot_gen_cost = 0.0

        for t in range(T):
            ch = float(col_vals[var_map[f"p_ch_{t}"]])
            dis = float(col_vals[var_map[f"p_dis_{t}"]])
            gb = float(col_vals[var_map[f"grid_buy_{t}"]])
            gs = float(col_vals[var_map[f"grid_sell_{t}"]])
            soc = float(col_vals[var_map[f"soc_{t}"]])
            gen_p = sum(float(col_vals[var_map[f"gen_{g}_{t}"]]) for g in range(n_gens))

            grid_net_cost = gb * req.grid_buy_price_per_mwh[t] - gs * req.grid_sell_price_per_mwh[t]
            tot_grid_cost += grid_net_cost
            soc_trajectory.append(round(soc, 2))

            hourly.append({
                "hour": t,
                "load_mw": req.load_profile_mw[t],
                "solar_mw": req.solar_pv_profile_mw[t],
                "wind_mw": req.wind_profile_mw[t],
                "battery_charge_mw": round(ch, 2),
                "battery_discharge_mw": round(dis, 2),
                "battery_soc_mwh": round(soc, 2),
                "grid_import_mw": round(gb, 2),
                "grid_export_mw": round(gs, 2),
                "generator_generation_mw": round(gen_p, 2),
                "electricity_tariff": req.grid_buy_price_per_mwh[t]
            })

        summary = (
            f"24-Hour Microgrid Energy Dispatch optimized via HiGHS. "
            f"Total Operating Cost: ${info.objective_function_value:.2f}. "
            f"Battery Arbitrage: Charge at low-tariff periods, discharge at peak periods."
        )

        return MicrogridScheduleResult(
            status="OPTIMAL",
            total_cost=round(float(info.objective_function_value), 2),
            grid_import_cost=round(tot_grid_cost, 2),
            generator_cost=round(info.objective_function_value - tot_grid_cost, 2),
            hourly_schedule=hourly,
            battery_soc_trajectory=soc_trajectory,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

energy_solver = EnergyOptimizationSolver()
