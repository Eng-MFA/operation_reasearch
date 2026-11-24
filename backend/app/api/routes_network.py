from fastapi import APIRouter, HTTPException
from app.engine.network_solver import network_solver, NetworkModelRequest, NetworkResultResponse

router = APIRouter(prefix="/network", tags=["Network Optimization"])

@router.post("/solve", response_model=NetworkResultResponse)
def solve_network(req: NetworkModelRequest):
    try:
        return network_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Network Solver Error: {str(e)}")
