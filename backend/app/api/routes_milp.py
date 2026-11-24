from fastapi import APIRouter, HTTPException
from app.engine.milp_solver import milp_solver, MILPModelRequest, MILPResultResponse

router = APIRouter(prefix="/milp", tags=["Mixed Integer Programming"])

@router.post("/solve", response_model=MILPResultResponse)
def solve_milp(req: MILPModelRequest):
    try:
        return milp_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"MILP Solver Error: {str(e)}")
