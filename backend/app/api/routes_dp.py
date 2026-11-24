from fastapi import APIRouter, HTTPException
from app.engine.dp_solver import dp_solver, DPModelRequest, DPResultResponse

router = APIRouter(prefix="/dp", tags=["Dynamic Programming"])

@router.post("/solve", response_model=DPResultResponse)
def solve_dp(req: DPModelRequest):
    try:
        return dp_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dynamic Programming Error: {str(e)}")
