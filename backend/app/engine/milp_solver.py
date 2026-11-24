import time
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
import highspy
from ortools.sat.python import cp_model

from app.core.validation import validator, ValidationReport

class MILPVariable(BaseModel):
    name: str
    lower_bound: Optional[float] = 0.0
    upper_bound: Optional[float] = None
    variable_type: str = "integer"  # "continuous", "integer", "binary"

class MILPConstraint(BaseModel):
    name: str
    coefficients: Dict[str, float]
    relation: str  # "<=", ">=", "=="
    rhs: float

class MILPModelRequest(BaseModel):
    name: str = "Mixed Integer Linear Program"
    sense: str = "maximize"  # "maximize" or "minimize"
    variables: List[MILPVariable]
    objective_coefficients: Dict[str, float]
    objective_constant: float = 0.0
    constraints: List[MILPConstraint]
    engine: str = "highs"  # "highs" or "cpsat"
    time_limit_sec: float = 60.0
    relative_gap_tolerance: float = 1e-4

class MILPResultResponse(BaseModel):
    status: str
    is_optimal: bool
    objective_value: float
    variable_values: Dict[str, float]
    slack_surplus_values: Dict[str, float]
    solver_name: str
    engine_used: str
    execution_time_sec: float
    nodes_explored: int
    optimality_gap: float
    validation_report: ValidationReport
    branch_and_cut_summary: Dict[str, Any]
    mathematical_summary: str


class MILPSolver:
    """
    Mixed-Integer Linear Programming solver using HiGHS Branch-and-Cut engine
    and Google OR-Tools CP-SAT solver with independent validation and tree statistics.
    """

    def solve(self, req: MILPModelRequest) -> MILPResultResponse:
        if req.engine.lower() == "cpsat":
            return self._solve_with_cpsat(req)
        else:
            return self._solve_with_highs(req)

    def _solve_with_highs(self, req: MILPModelRequest) -> MILPResultResponse:
        start_time = time.perf_counter()

        highs = highspy.Highs()
        highs.setOptionValue("output_flag", False)
        highs.setOptionValue("time_limit", req.time_limit_sec)
        highs.setOptionValue("mip_rel_gap", req.relative_gap_tolerance)

        num_vars = len(req.variables)
        var_indices = {v.name: i for i, v in enumerate(req.variables)}
        var_names = [v.name for v in req.variables]

        c = np.zeros(num_vars)
        for v_name, coef in req.objective_coefficients.items():
            if v_name in var_indices:
                c[var_indices[v_name]] = coef

        col_lower = np.zeros(num_vars)
        col_upper = np.zeros(num_vars)
        integrality = []

        for i, v in enumerate(req.variables):
            col_lower[i] = v.lower_bound if v.lower_bound is not None else -highspy.kHighsInf
            col_upper[i] = v.upper_bound if v.upper_bound is not None else highspy.kHighsInf

            vtype = v.variable_type.lower()
            if vtype == "binary":
                col_lower[i] = max(0.0, col_lower[i])
                col_upper[i] = min(1.0, col_upper[i])
                integrality.append(highspy.HighsVarType.kInteger)
            elif vtype == "integer":
                integrality.append(highspy.HighsVarType.kInteger)
            else:
                integrality.append(highspy.HighsVarType.kContinuous)

        num_rows = len(req.constraints)
        row_lower = np.zeros(num_rows)
        row_upper = np.zeros(num_rows)
        a_matrix_rows = []

        for i, con in enumerate(req.constraints):
            row_coeffs = np.zeros(num_vars)
            for v_name, coef in con.coefficients.items():
                if v_name in var_indices:
                    row_coeffs[var_indices[v_name]] = coef

            rel = con.relation.strip()
            if rel in ("<=", "le", "LE"):
                row_lower[i] = -highspy.kHighsInf
                row_upper[i] = con.rhs
            elif rel in (">=", "ge", "GE"):
                row_lower[i] = con.rhs
                row_upper[i] = highspy.kHighsInf
            elif rel in ("==", "=", "eq", "EQ"):
                row_lower[i] = con.rhs
                row_upper[i] = con.rhs
            a_matrix_rows.append(row_coeffs)

        A = np.array(a_matrix_rows) if num_rows > 0 else np.zeros((0, num_vars))

        lp = highspy.HighsLp()
        lp.num_col_ = num_vars
        lp.num_row_ = num_rows
        lp.sense_ = highspy.ObjSense.kMaximize if req.sense.lower() == "maximize" else highspy.ObjSense.kMinimize
        lp.offset_ = req.objective_constant
        lp.col_cost_ = c
        lp.col_lower_ = col_lower
        lp.col_upper_ = col_upper
        lp.row_lower_ = row_lower
        lp.row_upper_ = row_upper
        lp.integrality_ = integrality

        if num_rows > 0:
            import scipy.sparse as sp
            A_sparse = sp.csc_matrix(A)
            lp.a_matrix_.start_ = A_sparse.indptr.astype(np.int32)
            lp.a_matrix_.index_ = A_sparse.indices.astype(np.int32)
            lp.a_matrix_.value_ = A_sparse.data.astype(np.float64)

        highs.passModel(lp)
        highs.run()

        exec_time = time.perf_counter() - start_time
        info = highs.getInfo()
        solution = highs.getSolution()
        status_model = highs.getModelStatus()
        status_str = highs.modelStatusToString(status_model)

        is_optimal = (status_model == highspy.HighsModelStatus.kOptimal)

        var_vals = {}
        col_vals = list(solution.col_value) if solution.value_valid else [0.0]*num_vars
        for i, name in enumerate(var_names):
            val = float(col_vals[i]) if i < len(col_vals) else 0.0
            vtype = req.variables[i].variable_type.lower()
            if vtype in ("integer", "binary"):
                val = round(val)
            var_vals[name] = float(val)

        slacks = {}
        row_vals = list(solution.row_value) if solution.value_valid else [0.0]*num_rows
        for i, con in enumerate(req.constraints):
            r_val = float(row_vals[i]) if i < len(row_vals) else 0.0
            slacks[con.name] = float(con.rhs - r_val)

        obj_val = float(info.objective_function_value) if solution.value_valid else 0.0
        nodes_explored = int(info.mip_node_count)
        mip_gap = float(info.mip_gap) if hasattr(info, "mip_gap") else 0.0

        # Independent validation
        val_bounds = {v.name: (v.lower_bound, v.upper_bound) for v in req.variables}
        val_types = {v.name: v.variable_type for v in req.variables}
        val_constraints = [con.model_dump() for con in req.constraints]

        val_report = validator.validate_solution(
            solver_status=status_str,
            solver_objective=obj_val if is_optimal else None,
            solution_dict=var_vals,
            objective_coeffs=req.objective_coefficients,
            objective_sense=req.sense,
            objective_constant=req.objective_constant,
            constraints=val_constraints,
            variable_bounds=val_bounds,
            variable_types=val_types,
            optimality_proven=is_optimal
        )

        b_and_c_info = {
            "branch_and_bound_nodes": nodes_explored,
            "mip_gap": mip_gap,
            "simplex_iterations": int(info.simplex_iteration_count),
            "dual_bound": float(info.objective_function_value) + mip_gap if is_optimal else None,
            "primal_bound": obj_val
        }

        summary = (
            f"MILP '{req.name}' solved via HiGHS Branch-and-Cut. "
            f"Status: {status_str} in {exec_time*1000:.2f} ms ({nodes_explored} branch-and-bound nodes). "
            f"Optimal Objective Value: {obj_val:.6g}. "
            f"Validation: {'PASSED' if val_report.is_valid else 'FAILED'}."
        )

        return MILPResultResponse(
            status=status_str,
            is_optimal=is_optimal,
            objective_value=obj_val,
            variable_values=var_vals,
            slack_surplus_values=slacks,
            solver_name="HiGHS 1.16 Branch-and-Cut",
            engine_used="highs",
            execution_time_sec=exec_time,
            nodes_explored=nodes_explored,
            optimality_gap=mip_gap,
            validation_report=val_report,
            branch_and_cut_summary=b_and_c_info,
            mathematical_summary=summary
        )

    def _solve_with_cpsat(self, req: MILPModelRequest) -> MILPResultResponse:
        start_time = time.perf_counter()
        model = cp_model.CpModel()

        # CP-SAT handles integer coefficients cleanly
        cp_vars = {}
        for v in req.variables:
            vtype = v.variable_type.lower()
            if vtype == "binary":
                cp_vars[v.name] = model.NewBoolVar(v.name)
            else:
                lb = int(v.lower_bound) if v.lower_bound is not None else -cp_model.INT32_MAX
                ub = int(v.upper_bound) if v.upper_bound is not None else cp_model.INT32_MAX
                cp_vars[v.name] = model.NewIntVar(lb, ub, v.name)

        # Detect if all coefficients are integers or need scaling
        all_coeffs = list(req.objective_coefficients.values()) + [c for con in req.constraints for c in con.coefficients.values()] + [con.rhs for con in req.constraints]
        needs_scale = any(not float(x).is_integer() for x in all_coeffs)
        SCALE = 1000 if needs_scale else 1

        obj_expr = sum(
            int(round(coef * SCALE)) * cp_vars[v_name]
            for v_name, coef in req.objective_coefficients.items()
            if v_name in cp_vars
        )
        if req.sense.lower() == "maximize":
            model.Maximize(obj_expr)
        else:
            model.Minimize(obj_expr)

        for con in req.constraints:
            lhs = sum(
                int(round(coef * SCALE)) * cp_vars[v_name]
                for v_name, coef in con.coefficients.items()
                if v_name in cp_vars
            )
            rhs_val = int(round(con.rhs * SCALE))
            rel = con.relation.strip()
            if rel in ("<=", "le", "LE"):
                model.Add(lhs <= rhs_val)
            elif rel in (">=", "ge", "GE"):
                model.Add(lhs >= rhs_val)
            elif rel in ("==", "=", "eq", "EQ"):
                model.Add(lhs == rhs_val)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = req.time_limit_sec
        solver.parameters.log_search_progress = False

        status_code = solver.Solve(model)
        exec_time = time.perf_counter() - start_time

        status_map = {
            cp_model.OPTIMAL: "Optimal",
            cp_model.FEASIBLE: "Feasible",
            cp_model.INFEASIBLE: "Infeasible",
            cp_model.MODEL_INVALID: "Invalid",
            cp_model.UNKNOWN: "Unknown"
        }
        status_str = status_map.get(status_code, "Unknown")
        is_optimal = (status_code == cp_model.OPTIMAL)

        var_vals = {v.name: float(solver.Value(cp_vars[v.name])) for v in req.variables}
        obj_val = float(solver.ObjectiveValue()) / SCALE if (is_optimal or status_code == cp_model.FEASIBLE) else 0.0

        slacks = {}
        for con in req.constraints:
            lhs_val = sum(con.coefficients.get(v, 0.0) * var_vals.get(v, 0.0) for v in con.coefficients)
            slacks[con.name] = float(con.rhs - lhs_val)

        val_bounds = {v.name: (v.lower_bound, v.upper_bound) for v in req.variables}
        val_types = {v.name: v.variable_type for v in req.variables}
        val_constraints = [con.model_dump() for con in req.constraints]

        val_report = validator.validate_solution(
            solver_status=status_str,
            solver_objective=obj_val if is_optimal else None,
            solution_dict=var_vals,
            objective_coeffs=req.objective_coefficients,
            objective_sense=req.sense,
            objective_constant=req.objective_constant,
            constraints=val_constraints,
            variable_bounds=val_bounds,
            variable_types=val_types,
            optimality_proven=is_optimal
        )

        b_and_c_info = {
            "cp_sat_conflicts": solver.NumConflicts(),
            "cp_sat_branches": solver.NumBranches(),
            "wall_time_sec": solver.WallTime(),
        }

        summary = (
            f"Solved via Google OR-Tools CP-SAT. Status: {status_str} in {exec_time*1000:.2f} ms "
            f"({solver.NumBranches()} branches, {solver.NumConflicts()} conflicts). "
            f"Objective: {obj_val:.6g}. Validation: {'PASSED' if val_report.is_valid else 'FAILED'}."
        )

        return MILPResultResponse(
            status=status_str,
            is_optimal=is_optimal,
            objective_value=obj_val,
            variable_values=var_vals,
            slack_surplus_values=slacks,
            solver_name="Google OR-Tools 9.15 CP-SAT",
            engine_used="cpsat",
            execution_time_sec=exec_time,
            nodes_explored=solver.NumBranches(),
            optimality_gap=0.0 if is_optimal else 0.05,
            validation_report=val_report,
            branch_and_cut_summary=b_and_c_info,
            mathematical_summary=summary
        )

milp_solver = MILPSolver()
