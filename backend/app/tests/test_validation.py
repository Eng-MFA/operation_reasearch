import pytest
from app.core.validation import validator, MathematicalValidator

def test_validation_optimal_solution():
    v = MathematicalValidator()
    report = v.validate_solution(
        solver_status="Optimal",
        solver_objective=2160.0,
        solution_dict={"x1": 42.0, "x2": 16.0},
        objective_coeffs={"x1": 40.0, "x2": 30.0},
        objective_sense="maximize",
        constraints=[
            {"name": "C1", "coefficients": {"x1": 2.0, "x2": 1.0}, "relation": "<=", "rhs": 100.0},
            {"name": "C2", "coefficients": {"x1": 1.0, "x2": 3.0}, "relation": "<=", "rhs": 90.0}
        ],
        variable_bounds={"x1": (0.0, None), "x2": (0.0, None)},
        variable_types={"x1": "continuous", "x2": "continuous"},
        optimality_proven=True
    )
    assert report.is_valid is True
    assert report.is_feasible is True
    assert report.is_optimal_proven is True
    assert report.status_classification == "OPTIMAL"
    assert report.max_constraint_violation <= 1e-6
    assert abs(report.objective_discrepancy) <= 1e-6

def test_validation_detects_infeasible_violation():
    v = MathematicalValidator()
    report = v.validate_solution(
        solver_status="Optimal",
        solver_objective=2160.0,
        solution_dict={"x1": 60.0, "x2": 20.0},  # Violates C1: 2*60 + 20 = 140 > 100
        objective_coeffs={"x1": 40.0, "x2": 30.0},
        objective_sense="maximize",
        constraints=[
            {"name": "C1", "coefficients": {"x1": 2.0, "x2": 1.0}, "relation": "<=", "rhs": 100.0}
        ],
        variable_bounds={"x1": (0.0, None), "x2": (0.0, None)},
        optimality_proven=True
    )
    assert report.is_valid is False
    assert report.is_feasible is False
    assert report.max_constraint_violation >= 39.9
    assert report.status_classification == "FEASIBILITY_VIOLATION"

def test_validation_integrality_check():
    v = MathematicalValidator()
    report = v.validate_solution(
        solver_status="Optimal",
        solver_objective=10.0,
        solution_dict={"y": 1.45},  # Fractional integer
        objective_coeffs={"y": 10.0},
        objective_sense="maximize",
        constraints=[],
        variable_types={"y": "integer"},
        optimality_proven=True
    )
    assert report.is_valid is False
    assert report.max_integrality_violation >= 0.4
