from fastapi import APIRouter, HTTPException
from app.engine.metaheuristics_solver import (
    metaheuristics_solver,
    MetaheuristicRequest,
    MetaheuristicResultResponse
)

router = APIRouter(prefix="/metaheuristics", tags=["Metaheuristic Optimization"])

@router.post("/optimize", response_model=MetaheuristicResultResponse)
def solve_metaheuristic(req: MetaheuristicRequest):
    try:
        return metaheuristics_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Metaheuristic Error: {str(e)}")
