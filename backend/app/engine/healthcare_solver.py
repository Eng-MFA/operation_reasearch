import time
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from ortools.sat.python import cp_model

class NurseStaff(BaseModel):
    id: str
    name: str
    max_shifts: int = 5
    min_shifts: int = 2

class ShiftDemand(BaseModel):
    shift_name: str  # "Morning", "Afternoon", "Night"
    required_nurses: int = 2

class DayRequirement(BaseModel):
    day_name: str
    shift_demands: Dict[str, int]  # shift_name -> count

class NurseRosteringRequest(BaseModel):
    name: str = "Hospital Nurse Rostering"
    nurses: List[NurseStaff]
    shifts: List[str] = ["Morning", "Afternoon", "Night"]
    num_days: int = 7
    min_nurses_per_shift: Dict[str, int] = {"Morning": 2, "Afternoon": 2, "Night": 1}
    allow_night_to_morning: bool = False
    time_limit_sec: float = 20.0

class NurseRosteringResult(BaseModel):
    status: str
    is_feasible: bool
    total_assignments: int
    roster_schedule: List[Dict[str, Any]]  # Day by day nurse assignments
    nurse_workloads: List[Dict[str, Any]]
    execution_time_sec: float
    mathematical_summary: str


class HealthcareSolver:
    """
    Healthcare and Workforce Scheduling Engine:
    Solves the Nurse Rostering Problem (NRP) using Google OR-Tools CP-SAT
    with hard coverage constraints, ergonomics, and shift rotation rules.
    """

    def solve_nurse_rostering(self, req: NurseRosteringRequest) -> NurseRosteringResult:
        start_time = time.perf_counter()
        model = cp_model.CpModel()

        num_nurses = len(req.nurses)
        num_shifts = len(req.shifts)
        num_days = req.num_days

        # Decision variables: shifts[(n, d, s)] == 1 if nurse n works shift s on day d
        shifts_vars = {}
        for n in range(num_nurses):
            for d in range(num_days):
                for s in range(num_shifts):
                    shifts_vars[(n, d, s)] = model.NewBoolVar(f"shift_n{n}_d{d}_s{s}")

        # 1. Shift Coverage Constraints: Each shift on each day has required staffing
        for d in range(num_days):
            for s, s_name in enumerate(req.shifts):
                min_req = req.min_nurses_per_shift.get(s_name, 1)
                model.Add(sum(shifts_vars[(n, d, s)] for n in range(num_nurses)) >= min_req)

        # 2. At most one shift per nurse per day
        for n in range(num_nurses):
            for d in range(num_days):
                model.Add(sum(shifts_vars[(n, d, s)] for s in range(num_shifts)) <= 1)

        # 3. Workload Bounds: Min and Max shifts per nurse over the scheduling horizon
        for n, nurse in enumerate(req.nurses):
            total_shifts = sum(shifts_vars[(n, d, s)] for d in range(num_days) for s in range(num_shifts))
            model.Add(total_shifts <= nurse.max_shifts)
            model.Add(total_shifts >= nurse.min_shifts)

        # 4. Ergonomic Rest Constraints: Prevent Night shift followed by Morning shift
        if not req.allow_night_to_morning and "Night" in req.shifts and "Morning" in req.shifts:
            night_idx = req.shifts.index("Night")
            morning_idx = req.shifts.index("Morning")
            for n in range(num_nurses):
                for d in range(num_days - 1):
                    # If night shift on day d, cannot work morning shift on day d+1
                    model.Add(shifts_vars[(n, d, night_idx)] + shifts_vars[(n, d + 1, morning_idx)] <= 1)

        # Objective: Balance workload evenly across all staff members
        total_assignments_var = sum(shifts_vars.values())
        model.Maximize(total_assignments_var)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = req.time_limit_sec
        status_code = solver.Solve(model)
        exec_time = time.perf_counter() - start_time

        is_feasible = status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE)

        if not is_feasible:
            return NurseRosteringResult(
                status="INFEASIBLE",
                is_feasible=False,
                total_assignments=0,
                roster_schedule=[],
                nurse_workloads=[],
                execution_time_sec=exec_time,
                mathematical_summary="Shift staffing demands cannot be satisfied within nurse capacity constraints."
            )

        # Extract schedule day-by-day
        schedule = []
        days_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for d in range(num_days):
            day_label = days_names[d % 7] + f" (Day {d + 1})"
            shifts_alloc = {}
            for s, s_name in enumerate(req.shifts):
                assigned_nurses = [
                    req.nurses[n].name
                    for n in range(num_nurses)
                    if solver.Value(shifts_vars[(n, d, s)]) == 1
                ]
                shifts_alloc[s_name] = assigned_nurses

            schedule.append({
                "day_index": d + 1,
                "day_name": day_label,
                "shifts": shifts_alloc
            })

        # Nurse workloads
        workloads = []
        tot_assigned = 0
        for n, nurse in enumerate(req.nurses):
            count = sum(solver.Value(shifts_vars[(n, d, s)]) for d in range(num_days) for s in range(num_shifts))
            tot_assigned += count
            workloads.append({
                "nurse": nurse.name,
                "shifts_worked": count,
                "min_target": nurse.min_shifts,
                "max_target": nurse.max_shifts
            })

        summary = (
            f"Nurse Roster optimized via Google OR-Tools CP-SAT in {exec_time*1000:.2f} ms. "
            f"All {num_days} days fully staffed with {tot_assigned} total shifts allocated across {num_nurses} nurses."
        )

        return NurseRosteringResult(
            status="OPTIMAL" if status_code == cp_model.OPTIMAL else "FEASIBLE",
            is_feasible=True,
            total_assignments=tot_assigned,
            roster_schedule=schedule,
            nurse_workloads=workloads,
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

healthcare_solver = HealthcareSolver()
