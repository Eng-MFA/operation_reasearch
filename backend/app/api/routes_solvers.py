from fastapi import APIRouter
from typing import List
from app.engine.solver_registry import solver_registry, SolverInfo

router = APIRouter(prefix="/solvers", tags=["Solver Center & Registry"])

@router.get("/list", response_model=List[SolverInfo])
def list_available_solvers():
    return solver_registry.list_solvers()
