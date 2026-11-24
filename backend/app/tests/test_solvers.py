import pytest
from app.engine.lp_solver import lp_solver, LPModelRequest, VariableDefinition, ConstraintDefinition
from app.engine.milp_solver import milp_solver, MILPModelRequest, MILPVariable, MILPConstraint
from app.engine.nlp_solver import nlp_solver, NLPModelRequest, NLPVariable, NLPConstraint
from app.engine.energy_solver import energy_solver, EconomicDispatchParam, GeneratorUnit
from app.engine.dp_solver import dp_solver, DPModelRequest, KnapsackItem
from app.engine.transport_solver import transport_solver, TransportationRequest, AssignmentRequest
from app.engine.inventory_solver import inventory_solver, InventoryModelRequest
from app.engine.queuing_solver import queuing_solver, QueuingModelRequest
from app.engine.network_solver import network_solver, NetworkModelRequest, NetworkNode, NetworkEdge
from app.engine.project_mgmt_solver import project_mgmt_solver, ProjectModelRequest, ProjectActivity

def test_lp_infeasible_problem():
    # Infeasible: x1 + x2 >= 10 and x1 + x2 <= 5
    req = LPModelRequest(
        variables=[VariableDefinition(name="x1"), VariableDefinition(name="x2")],
        objective_coefficients={"x1": 1.0, "x2": 1.0},
        constraints=[
            ConstraintDefinition(name="C1", coefficients={"x1": 1.0, "x2": 1.0}, relation=">=", rhs=10.0),
            ConstraintDefinition(name="C2", coefficients={"x1": 1.0, "x2": 1.0}, relation="<=", rhs=5.0)
        ]
    )
    res = lp_solver.solve(req)
    assert res.is_optimal is False
    assert "Infeasible" in res.status or not res.validation_report.is_valid

def test_lp_unbounded_problem():
    # Maximize x1 with no upper bound
    req = LPModelRequest(
        sense="maximize",
        variables=[VariableDefinition(name="x1", lower_bound=0.0, upper_bound=None)],
        objective_coefficients={"x1": 10.0},
        constraints=[]
    )
    res = lp_solver.solve(req)
    assert res.is_optimal is False
    assert "Unbounded" in res.status or not res.validation_report.is_optimal_proven

def test_milp_integer_restriction():
    # Maximize x + y, x + 2y <= 5.5, x, y integers >= 0
    req = MILPModelRequest(
        sense="maximize",
        variables=[
            MILPVariable(name="x", variable_type="integer", lower_bound=0),
            MILPVariable(name="y", variable_type="integer", lower_bound=0)
        ],
        objective_coefficients={"x": 1.0, "y": 1.0},
        constraints=[
            MILPConstraint(name="C1", coefficients={"x": 1.0, "y": 2.0}, relation="<=", rhs=5.5)
        ]
    )
    res = milp_solver.solve(req)
    assert res.is_optimal is True
    # For integer solution: (x=5, y=0) -> 5; or (x=3, y=1) -> 4; or (x=1, y=2) -> 3.
    # Max is x=5, y=0 -> objective 5.0
    assert abs(res.objective_value - 5.0) < 1e-4

def test_assignment_hungarian():
    req = AssignmentRequest(
        agents=["A1", "A2"],
        tasks=["T1", "T2"],
        cost_matrix=[[10, 5], [4, 8]]
    )
    res = transport_solver.solve_assignment(req)
    # Optimum: A1 -> T2 (5), A2 -> T1 (4) = 9
    assert res.optimal_total_cost == 9.0

def test_project_mgmt_cpm():
    req = ProjectModelRequest(
        method="cpm",
        activities=[
            ProjectActivity(id="A", name="Task A", duration=4),
            ProjectActivity(id="B", name="Task B", duration=6, predecessors=["A"]),
            ProjectActivity(id="C", name="Task C", duration=2, predecessors=["A"]),
            ProjectActivity(id="D", name="Task D", duration=3, predecessors=["B", "C"])
        ]
    )
    res = project_mgmt_solver.solve(req)
    # A(4) -> B(6) -> D(3) = 13
    assert res.project_duration == 13.0
    assert res.critical_path == ["A", "B", "D"]
