import time
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from ortools.sat.python import cp_model

from app.engine.lp_solver import lp_solver, LPModelRequest, VariableDefinition, ConstraintDefinition

class ProductPlanItem(BaseModel):
    name: str
    profit_per_unit: float
    min_demand: float = 0.0
    max_demand: Optional[float] = None
    machine_hours: Dict[str, float]  # machine_id -> hours required per unit
    material_usage: Dict[str, float]  # material_id -> kg/units required

class MachineCapacity(BaseModel):
    id: str
    name: str
    available_hours: float
    hourly_operating_cost: float = 0.0

class MaterialLimit(BaseModel):
    id: str
    name: str
    available_stock: float
    unit_cost: float = 0.0

class ProductionPlanRequest(BaseModel):
    products: List[ProductPlanItem]
    machines: List[MachineCapacity]
    materials: List[MaterialLimit]

class JobTask(BaseModel):
    machine_id: int
    duration: int

class JobShopRequest(BaseModel):
    name: str = "Job Shop Scheduling Problem"
    jobs: List[List[JobTask]]  # jobs[j] is list of tasks in order
    machine_names: Optional[List[str]] = None
    time_limit_sec: float = 30.0

class ProductionPlanResult(BaseModel):
    status: str
    total_profit: float
    product_quantities: Dict[str, float]
    machine_utilization: List[Dict[str, Any]]
    material_consumption: List[Dict[str, Any]]
    bottleneck_resources: List[str]
    execution_time_sec: float
    mathematical_summary: str

class JobShopScheduleResult(BaseModel):
    status: str
    makespan_cmax: int
    tasks_schedule: List[Dict[str, Any]]
    machine_gantt_chart: List[Dict[str, Any]]
    execution_time_sec: float
    mathematical_summary: str


class ManufacturingSolver:
    """
    Manufacturing and Industrial Engineering optimization:
    Production planning with LP/HiGHS, bottleneck shadow price analysis,
    and Job Shop Scheduling with Google OR-Tools CP-SAT.
    """

    def solve_production_planning(self, req: ProductionPlanRequest) -> ProductionPlanResult:
        start_time = time.perf_counter()

        lp_vars = []
        obj_coeffs = {}

        for p in req.products:
            lp_vars.append(VariableDefinition(
                name=p.name,
                lower_bound=p.min_demand,
                upper_bound=p.max_demand
            ))
            obj_coeffs[p.name] = p.profit_per_unit

        lp_cons = []

        # Machine capacity constraints
        for m in req.machines:
            coeffs = {p.name: p.machine_hours.get(m.id, 0.0) for p in req.products if m.id in p.machine_hours}
            if coeffs and any(v > 0 for v in coeffs.values()):
                lp_cons.append(ConstraintDefinition(
                    name=f"Machine_{m.name}",
                    coefficients=coeffs,
                    relation="<=",
                    rhs=m.available_hours
                ))

        # Material availability constraints
        for mat in req.materials:
            coeffs = {p.name: p.material_usage.get(mat.id, 0.0) for p in req.products if mat.id in p.material_usage}
            if coeffs and any(v > 0 for v in coeffs.values()):
                lp_cons.append(ConstraintDefinition(
                    name=f"Material_{mat.name}",
                    coefficients=coeffs,
                    relation="<=",
                    rhs=mat.available_stock
                ))

        lp_req = LPModelRequest(
            name="Aggregate Production Planning",
            sense="maximize",
            variables=lp_vars,
            objective_coefficients=obj_coeffs,
            constraints=lp_cons
        )

        lp_res = lp_solver.solve(lp_req)
        exec_time = time.perf_counter() - start_time

        bottlenecks = []
        # Analyze machine utilization
        mach_util = []
        for m in req.machines:
            c_name = f"Machine_{m.name}"
            used = sum(p.machine_hours.get(m.id, 0.0) * lp_res.variable_values.get(p.name, 0.0) for p in req.products)
            pct = (used / m.available_hours * 100.0) if m.available_hours > 0 else 0.0
            sp = lp_res.shadow_prices.get(c_name, 0.0)
            if abs(sp) > 1e-4 or pct >= 99.9:
                bottlenecks.append(f"Machine: {m.name} (Shadow Price: ${sp:.2f}/hr)")
            mach_util.append({
                "name": m.name,
                "used_hours": round(used, 2),
                "available_hours": m.available_hours,
                "utilization_pct": round(pct, 1),
                "shadow_price": round(sp, 2)
            })

        # Analyze material consumption
        mat_util = []
        for mat in req.materials:
            c_name = f"Material_{mat.name}"
            used = sum(p.material_usage.get(mat.id, 0.0) * lp_res.variable_values.get(p.name, 0.0) for p in req.products)
            pct = (used / mat.available_stock * 100.0) if mat.available_stock > 0 else 0.0
            sp = lp_res.shadow_prices.get(c_name, 0.0)
            if abs(sp) > 1e-4 or pct >= 99.9:
                bottlenecks.append(f"Material: {mat.name} (Shadow Price: ${sp:.2f}/unit)")
            mat_util.append({
                "name": mat.name,
                "used_stock": round(used, 2),
                "available_stock": mat.available_stock,
                "consumption_pct": round(pct, 1),
                "shadow_price": round(sp, 2)
            })

        summary = (
            f"Production Plan optimized. Maximum Net Profit: ${lp_res.objective_value:,.2f}. "
            f"Active Bottlenecks: {', '.join(bottlenecks) if bottlenecks else 'None (excess capacity exists)'}."
        )

        return ProductionPlanResult(
            status=lp_res.status,
            total_profit=round(lp_res.objective_value, 2),
            product_quantities={k: round(v, 2) for k, v in lp_res.variable_values.items()},
            machine_utilization=mach_util,
            material_consumption=mat_util,
            bottleneck_resources=bottlenecks,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

    def solve_job_shop(self, req: JobShopRequest) -> JobShopScheduleResult:
        """
        Job Shop Scheduling with makespan minimization using Google OR-Tools CP-SAT:
        Models interval variables and AddNoOverlap constraints on each machine.
        """
        start_time = time.perf_counter()
        model = cp_model.CpModel()

        # Compute upper bound on horizon = sum of all task durations
        horizon = sum(task.duration for job in req.jobs for task in job)

        all_machines = set(task.machine_id for job in req.jobs for task in job)
        machine_intervals = {m: [] for m in all_machines}

        all_tasks = {}
        for j_idx, job in enumerate(req.jobs):
            prev_end = None
            for t_idx, task in enumerate(job):
                suffix = f"_{j_idx}_{t_idx}"
                start_var = model.NewIntVar(0, horizon, f"start{suffix}")
                duration = task.duration
                end_var = model.NewIntVar(0, horizon, f"end{suffix}")
                interval_var = model.NewIntervalVar(start_var, duration, end_var, f"interval{suffix}")

                all_tasks[(j_idx, t_idx)] = {
                    "start": start_var,
                    "end": end_var,
                    "interval": interval_var,
                    "machine": task.machine_id,
                    "duration": duration,
                    "job": j_idx,
                    "task": t_idx
                }

                machine_intervals[task.machine_id].append(interval_var)

                # Precedence constraint within the job
                if prev_end is not None:
                    model.Add(start_var >= prev_end)
                prev_end = end_var

        # Disjunctive constraints: No overlap on each machine
        for m in all_machines:
            model.AddNoOverlap(machine_intervals[m])

        # Objective: Minimize Makespan C_max = max(end_var)
        makespan = model.NewIntVar(0, horizon, "makespan")
        model.AddMaxEquality(makespan, [t["end"] for t in all_tasks.values()])
        model.Minimize(makespan)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = req.time_limit_sec
        solver.parameters.log_search_progress = False

        status_code = solver.Solve(model)
        exec_time = time.perf_counter() - start_time

        c_max = int(solver.ObjectiveValue()) if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0

        schedule = []
        gantt = []
        m_names = req.machine_names or [f"Machine {m}" for m in range(max(all_machines) + 1 if all_machines else 1)]

        for (j_idx, t_idx), t_data in all_tasks.items():
            st = solver.Value(t_data["start"])
            en = solver.Value(t_data["end"])
            m_id = t_data["machine"]
            m_name = m_names[m_id] if m_id < len(m_names) else f"Machine {m_id}"

            item = {
                "job_id": j_idx,
                "task_id": t_idx,
                "machine_id": m_id,
                "machine_name": m_name,
                "start": st,
                "end": en,
                "duration": t_data["duration"]
            }
            schedule.append(item)
            gantt.append({
                "job": f"Job {j_idx + 1}",
                "task": f"Job {j_idx + 1} Step {t_idx + 1}",
                "machine": m_name,
                "start": st,
                "end": en,
                "duration": t_data["duration"]
            })

        status_str = "OPTIMAL" if status_code == cp_model.OPTIMAL else "FEASIBLE"
        summary = (
            f"Job Shop Scheduling solved via Google OR-Tools CP-SAT. Status: {status_str} in {exec_time*1000:.2f} ms. "
            f"Minimal Makespan (C_max): {c_max} time units across {len(req.jobs)} jobs and {len(all_machines)} machines."
        )

        return JobShopScheduleResult(
            status=status_str,
            makespan_cmax=c_max,
            tasks_schedule=schedule,
            machine_gantt_chart=gantt,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

manufacturing_solver = ManufacturingSolver()
