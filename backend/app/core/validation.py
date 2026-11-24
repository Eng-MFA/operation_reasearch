import math
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field

class ConstraintCheckResult(BaseModel):
    name: str
    expression: str
    lhs_evaluated: float
    rhs_value: float
    relation: str  # "<=", ">=", "=="
    violation: float  # Amount of violation (>0 means violated beyond tolerance)
    is_satisfied: bool
    slack_or_surplus: float

class VariableBoundCheckResult(BaseModel):
    name: str
    value: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    is_satisfied: bool
    violation: float

class ValidationReport(BaseModel):
    is_valid: bool
    status_classification: str  # "OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNBOUNDED", "NUMERICAL_FAILURE", "ERROR"
    objective_declared: Optional[float]
    objective_recalculated: Optional[float]
    objective_discrepancy: Optional[float]
    max_constraint_violation: float
    max_bound_violation: float
    max_integrality_violation: float
    is_feasible: bool
    is_optimal_proven: bool
    constraints_evaluated: List[ConstraintCheckResult]
    bounds_evaluated: List[VariableBoundCheckResult]
    infeasibility_diagnostics: Optional[Dict[str, Any]] = None
    validation_messages: List[str] = Field(default_factory=list)


class MathematicalValidator:
    """
    Independent verification and validation engine for mathematical optimization solutions.
    Evaluates constraints, bounds, integrality, and objective values independently from the solver.
    """

    def __init__(
        self,
        feasibility_tolerance: float = 1e-6,
        integrality_tolerance: float = 1e-5,
        optimality_tolerance: float = 1e-5,
    ):
        self.feasibility_tolerance = feasibility_tolerance
        self.integrality_tolerance = integrality_tolerance
        self.optimality_tolerance = optimality_tolerance

    def validate_solution(
        self,
        solver_status: str,
        solver_objective: Optional[float],
        solution_dict: Dict[str, float],
        objective_coeffs: Dict[str, float],
        objective_sense: str,  # "minimize" or "maximize"
        objective_constant: float = 0.0,
        constraints: Optional[List[Dict[str, Any]]] = None,
        variable_bounds: Optional[Dict[str, Tuple[Optional[float], Optional[float]]]] = None,
        variable_types: Optional[Dict[str, str]] = None,  # "continuous", "integer", "binary"
        optimality_proven: bool = True
    ) -> ValidationReport:
        messages = []
        constraints_results: List[ConstraintCheckResult] = []
        bounds_results: List[VariableBoundCheckResult] = []

        max_constraint_viol = 0.0
        max_bound_viol = 0.0
        max_int_viol = 0.0
        all_constraints_satisfied = True
        all_bounds_satisfied = True
        all_integrality_satisfied = True

        # Check solver status
        norm_status = solver_status.upper().strip()
        if "INFEASIBLE" in norm_status:
            status_classification = "INFEASIBLE"
            messages.append("Solver reported model is INFEASIBLE. Independent feasibility analysis initiated.")
            diagnostics = self.diagnose_infeasibility(constraints or [], variable_bounds or {})
            return ValidationReport(
                is_valid=False,
                status_classification=status_classification,
                objective_declared=None,
                objective_recalculated=None,
                objective_discrepancy=None,
                max_constraint_violation=0.0,
                max_bound_violation=0.0,
                max_integrality_violation=0.0,
                is_feasible=False,
                is_optimal_proven=False,
                constraints_evaluated=[],
                bounds_evaluated=[],
                infeasibility_diagnostics=diagnostics,
                validation_messages=messages
            )
        elif "UNBOUNDED" in norm_status:
            return ValidationReport(
                is_valid=False,
                status_classification="UNBOUNDED",
                objective_declared=None,
                objective_recalculated=None,
                objective_discrepancy=None,
                max_constraint_violation=0.0,
                max_bound_violation=0.0,
                max_integrality_violation=0.0,
                is_feasible=True,
                is_optimal_proven=False,
                constraints_evaluated=[],
                bounds_evaluated=[],
                validation_messages=["Problem is mathematically UNBOUNDED. The objective function can improve indefinitely."]
            )

        # 1. Variable bounds validation
        if variable_bounds:
            for var_name, bounds in variable_bounds.items():
                val = solution_dict.get(var_name, 0.0)
                lb, ub = bounds
                viol = 0.0
                satisfied = True

                if lb is not None and val < lb - self.feasibility_tolerance:
                    viol = max(viol, lb - val)
                    satisfied = False
                if ub is not None and val > ub + self.feasibility_tolerance:
                    viol = max(viol, val - ub)
                    satisfied = False

                max_bound_viol = max(max_bound_viol, viol)
                if not satisfied:
                    all_bounds_satisfied = False
                    messages.append(f"Variable '{var_name}' = {val:.6g} violates bounds [{lb}, {ub}] by {viol:.6g}.")

                bounds_results.append(VariableBoundCheckResult(
                    name=var_name,
                    value=val,
                    lower_bound=lb,
                    upper_bound=ub,
                    is_satisfied=satisfied,
                    violation=viol
                ))

        # 2. Integrality validation
        if variable_types:
            for var_name, var_type in variable_types.items():
                if var_type.lower() in ("integer", "binary"):
                    val = solution_dict.get(var_name, 0.0)
                    nearest_int = round(val)
                    int_err = abs(val - nearest_int)
                    max_int_viol = max(max_int_viol, int_err)
                    if int_err > self.integrality_tolerance:
                        all_integrality_satisfied = False
                        messages.append(f"Discrete variable '{var_name}' = {val:.6g} violates integrality (distance {int_err:.6g}).")
                    if var_type.lower() == "binary" and (nearest_int not in (0, 1) or int_err > self.integrality_tolerance):
                        all_integrality_satisfied = False
                        messages.append(f"Binary variable '{var_name}' = {val:.6g} is not in {{0, 1}}.")

        # 3. Constraints validation
        if constraints:
            for c in constraints:
                name = c.get("name", "Unnamed Constraint")
                coeffs = c.get("coefficients", {})
                relation = c.get("relation", "<=")
                rhs = float(c.get("rhs", 0.0))

                # Compute LHS = sum(coeff * value)
                lhs = sum(float(coef) * solution_dict.get(v, 0.0) for v, coef in coeffs.items())
                viol = 0.0
                satisfied = True
                slack_or_surplus = 0.0

                if relation in ("<=", "le", "LE"):
                    slack_or_surplus = rhs - lhs
                    if lhs > rhs + self.feasibility_tolerance:
                        viol = lhs - rhs
                        satisfied = False
                elif relation in (">=", "ge", "GE"):
                    slack_or_surplus = lhs - rhs
                    if lhs < rhs - self.feasibility_tolerance:
                        viol = rhs - lhs
                        satisfied = False
                elif relation in ("==", "=", "eq", "EQ"):
                    slack_or_surplus = abs(rhs - lhs)
                    if abs(lhs - rhs) > self.feasibility_tolerance:
                        viol = abs(lhs - rhs)
                        satisfied = False

                max_constraint_viol = max(max_constraint_viol, viol)
                if not satisfied:
                    all_constraints_satisfied = False
                    messages.append(f"Constraint '{name}' violated by {viol:.6g}: evaluated LHS={lhs:.6g}, {relation} RHS={rhs:.6g}.")

                # Construct human-readable expression
                expr_terms = [f"{coef:+}*{v}" if coef != 1 else f"+{v}" for v, coef in coeffs.items()]
                expr_str = " ".join(expr_terms).lstrip("+") + f" {relation} {rhs}"

                constraints_results.append(ConstraintCheckResult(
                    name=name,
                    expression=expr_str,
                    lhs_evaluated=lhs,
                    rhs_value=rhs,
                    relation=relation,
                    violation=viol,
                    is_satisfied=satisfied,
                    slack_or_surplus=slack_or_surplus
                ))

        # 4. Independent Objective Recalculation
        recalculated_obj = objective_constant + sum(
            float(coef) * solution_dict.get(v, 0.0) for v, coef in objective_coeffs.items()
        )
        obj_discrepancy = None
        if solver_objective is not None:
            obj_discrepancy = abs(recalculated_obj - solver_objective)
            if obj_discrepancy > self.optimality_tolerance:
                messages.append(f"Objective discrepancy detected: Solver returned {solver_objective:.6g}, recalculated is {recalculated_obj:.6g} (diff: {obj_discrepancy:.6g}).")

        # Determine overall classification
        is_feasible = (
            all_constraints_satisfied and
            all_bounds_satisfied and
            all_integrality_satisfied and
            (obj_discrepancy is None or obj_discrepancy <= self.optimality_tolerance)
        )

        if not is_feasible:
            status_classification = "FEASIBILITY_VIOLATION"
            is_valid = False
            is_optimal_proven = False
        elif optimality_proven:
            status_classification = "OPTIMAL"
            is_valid = True
            is_optimal_proven = True
            messages.append("Independent verification PASSED: All constraints, bounds, integrality, and objective matched within tolerance.")
        else:
            status_classification = "FEASIBLE"
            is_valid = True
            is_optimal_proven = False
            messages.append("Solution is FEASIBLE within numerical tolerance, but optimality is unproven.")

        return ValidationReport(
            is_valid=is_valid,
            status_classification=status_classification,
            objective_declared=solver_objective,
            objective_recalculated=recalculated_obj,
            objective_discrepancy=obj_discrepancy,
            max_constraint_violation=max_constraint_viol,
            max_bound_violation=max_bound_viol,
            max_integrality_violation=max_int_viol,
            is_feasible=is_feasible,
            is_optimal_proven=is_optimal_proven,
            constraints_evaluated=constraints_results,
            bounds_evaluated=bounds_results,
            validation_messages=messages
        )

    def diagnose_infeasibility(
        self,
        constraints: List[Dict[str, Any]],
        variable_bounds: Dict[str, Tuple[Optional[float], Optional[float]]]
    ) -> Dict[str, Any]:
        """
        Diagnose potential causes of infeasibility through conflict analysis and relaxation suggestions.
        """
        bound_conflicts = []
        for v, (lb, ub) in variable_bounds.items():
            if lb is not None and ub is not None and lb > ub:
                bound_conflicts.append({
                    "variable": v,
                    "lower_bound": lb,
                    "upper_bound": ub,
                    "issue": f"Contradictory variable bounds: lower bound ({lb}) > upper bound ({ub})"
                })

        suggestions = []
        if bound_conflicts:
            suggestions.append("Fix conflicting variable bounds where lower bound exceeds upper bound.")

        if constraints:
            suggestions.append("Run Irreducible Infeasible Subsystem (IIS) relaxation by increasing RHS capacities or relaxing equality constraints to inequalities.")
            suggestions.append("Check for opposing constraints (e.g. sum(x) <= A and sum(x) >= B where A < B).")

        return {
            "bound_conflicts": bound_conflicts,
            "suspected_constraints_count": len(constraints),
            "relaxation_recommendations": suggestions,
            "diagnosis_summary": "Model lacks a common intersection between hyperplanes and variable bounding intervals."
        }

validator = MathematicalValidator()
