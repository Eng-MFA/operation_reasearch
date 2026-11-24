from fastapi import APIRouter, HTTPException
from app.engine.queuing_solver import queuing_solver, QueuingModelRequest, QueuingResultResponse

router = APIRouter(prefix="/queuing", tags=["Queuing Theory"])

@router.post("/solve", response_model=QueuingResultResponse)
def solve_queuing(req: QueuingModelRequest):
    try:
        return queuing_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Queuing Solver Error: {str(e)}")
