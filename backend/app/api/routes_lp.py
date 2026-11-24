from fastapi import APIRouter, HTTPException
from app.engine.lp_solver import lp_solver, LPModelRequest, LPResultResponse

router = APIRouter(prefix="/lp", tags=["Linear Programming"])

@router.post("/solve", response_model=LPResultResponse)
def solve_linear_program(req: LPModelRequest):
    try:
        return lp_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Linear Programming Solver Error: {str(e)}")
