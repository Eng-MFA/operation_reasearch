from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

from app.engine.expression_parser import SafeExpressionParser
from app.engine.lp_solver import lp_solver, LPModelRequest, VariableDefinition, ConstraintDefinition, LPResultResponse
from app.engine.milp_solver import milp_solver, MILPModelRequest, MILPVariable, MILPConstraint, MILPResultResponse
from app.engine.solver_registry import solver_registry

router = APIRouter(prefix="/model-builder", tags=["Universal Mathematical Model Builder"])

class BuilderVariable(BaseModel):
    name: str
    variable_type: str = "continuous"  # continuous, integer, binary
    lower_bound: Optional[float] = 0.0
    upper_bound: Optional[float] = None

class BuilderConstraint(BaseModel):
    name: str
    expression: str  # e.g., "2*x1 + x2 <= 100"
    relation: Optional[str] = "<="
    rhs: Optional[float] = None

class UniversalModelDefinition(BaseModel):
    name: str = "Custom Optimization Model"
    problem_type: str = "linear_programming"  # "linear_programming", "mixed_integer"
    sense: str = "maximize"  # "maximize" or "minimize"
    variables: List[BuilderVariable]
    objective_expression: str  # e.g., "40*x1 + 30*x2"
    constraints: List[BuilderConstraint]
    selected_solver: Optional[str] = "auto"
    time_limit_sec: float = 60.0

class ModelExportResponse(BaseModel):
    lp_format: str
    json_schema_format: Dict[str, Any]
    variables_count: int
    constraints_count: int

@router.post("/export-format", response_model=ModelExportResponse)
def export_model_formats(req: UniversalModelDefinition):
    var_names = [v.name for v in req.variables]

    # Parse objective
    obj_coeffs, obj_const = SafeExpressionParser.extract_linear_coefficients(req.objective_expression, var_names)

    # Build LP format string
    lp_lines = [f"\\* Problem: {req.name} *\\"]
    lp_lines.append(f"{req.sense.capitalize()}")
    obj_terms = " + ".join([f"{c} {v}" for v, c in obj_coeffs.items() if c != 0])
    if obj_const != 0:
        obj_terms += f" + {obj_const}"
    lp_lines.append(f" obj: {obj_terms or '0'}")

    lp_lines.append("Subject To")
    for con in req.constraints:
        # Check if relation in expression
        raw_expr = con.expression
        rel = "<="
        rhs = 0.0
        expr_part = raw_expr

        for candidate_rel in ["<=", ">=", "==", "=", "<", ">"]:
            if candidate_rel in raw_expr:
                parts = raw_expr.split(candidate_rel, 1)
                expr_part = parts[0].strip()
                rel = candidate_rel if candidate_rel != "=" else "=="
                try:
                    rhs = float(parts[1].strip())
                except Exception:
                    rhs = 0.0
                break

        coeffs, const_term = SafeExpressionParser.extract_linear_coefficients(expr_part, var_names)
        adj_rhs = rhs - const_term
        terms = " + ".join([f"{c} {v}" for v, c in coeffs.items() if c != 0])
        lp_lines.append(f" {con.name.replace(' ', '_')}: {terms} {rel} {adj_rhs}")

    lp_lines.append("Bounds")
    for v in req.variables:
        lb = f"{v.lower_bound} <=" if v.lower_bound is not None else "-inf <="
        ub = f"<= {v.upper_bound}" if v.upper_bound is not None else "<= +inf"
        lp_lines.append(f" {lb} {v.name} {ub}")

    integers = [v.name for v in req.variables if v.variable_type == "integer"]
    binaries = [v.name for v in req.variables if v.variable_type == "binary"]

    if integers:
        lp_lines.append("General")
        for invar in integers:
            lp_lines.append(f" {invar}")
    if binaries:
        lp_lines.append("Binary")
        for bvar in binaries:
            lp_lines.append(f" {bvar}")

    lp_lines.append("End")
    lp_str = "\n".join(lp_lines)

    return ModelExportResponse(
        lp_format=lp_str,
        json_schema_format=req.model_dump(),
        variables_count=len(req.variables),
        constraints_count=len(req.constraints)
    )

@router.post("/solve")
def solve_universal_model(req: UniversalModelDefinition):
    var_names = [v.name for v in req.variables]
    has_integers = any(v.variable_type in ("integer", "binary") for v in req.variables)

    # Parse objective
    obj_coeffs, obj_const = SafeExpressionParser.extract_linear_coefficients(req.objective_expression, var_names)

    # Parse constraints
    parsed_cons = []
    for con in req.constraints:
        raw_expr = con.expression
        rel = con.relation or "<="
        rhs = con.rhs if con.rhs is not None else 0.0
        expr_part = raw_expr

        for candidate_rel in ["<=", ">=", "==", "=", "<", ">"]:
            if candidate_rel in raw_expr:
                parts = raw_expr.split(candidate_rel, 1)
                expr_part = parts[0].strip()
                rel = candidate_rel if candidate_rel != "=" else "=="
                try:
                    rhs = float(parts[1].strip())
                except Exception:
                    pass
                break

        coeffs, const_term = SafeExpressionParser.extract_linear_coefficients(expr_part, var_names)
        parsed_cons.append({
            "name": con.name,
            "coefficients": coeffs,
            "relation": rel,
            "rhs": rhs - const_term
        })

    if has_integers or req.problem_type == "mixed_integer":
        milp_vars = [
            MILPVariable(
                name=v.name,
                variable_type=v.variable_type,
                lower_bound=v.lower_bound,
                upper_bound=v.upper_bound
            ) for v in req.variables
        ]
        milp_cons = [
            MILPConstraint(
                name=c["name"],
                coefficients=c["coefficients"],
                relation=c["relation"],
                rhs=c["rhs"]
            ) for c in parsed_cons
        ]
        milp_req = MILPModelRequest(
            name=req.name,
            sense=req.sense,
            variables=milp_vars,
            objective_coefficients=obj_coeffs,
            objective_constant=obj_const,
            constraints=milp_cons,
            time_limit_sec=req.time_limit_sec
        )
        return milp_solver.solve(milp_req)
    else:
        lp_vars = [
            VariableDefinition(
                name=v.name,
                variable_type="continuous",
                lower_bound=v.lower_bound,
                upper_bound=v.upper_bound
            ) for v in req.variables
        ]
        lp_cons = [
            ConstraintDefinition(
                name=c["name"],
                coefficients=c["coefficients"],
                relation=c["relation"],
                rhs=c["rhs"]
            ) for c in parsed_cons
        ]
        lp_req = LPModelRequest(
            name=req.name,
            sense=req.sense,
            variables=lp_vars,
            objective_coefficients=obj_coeffs,
            objective_constant=obj_const,
            constraints=lp_cons,
            time_limit_sec=req.time_limit_sec
        )
        return lp_solver.solve(lp_req)
