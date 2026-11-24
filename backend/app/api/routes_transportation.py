from fastapi import APIRouter, HTTPException
from app.engine.transport_solver import (
    transport_solver,
    TransportationRequest,
    TransportationResultResponse,
    AssignmentRequest,
    AssignmentResultResponse
)

router = APIRouter(prefix="/transport", tags=["Transportation & Assignment"])

@router.post("/transportation", response_model=TransportationResultResponse)
def solve_transportation(req: TransportationRequest):
    try:
        return transport_solver.solve_transportation(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Transportation Solver Error: {str(e)}")

@router.post("/assignment", response_model=AssignmentResultResponse)
def solve_assignment(req: AssignmentRequest):
    try:
        return transport_solver.solve_assignment(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Assignment Solver Error: {str(e)}")
