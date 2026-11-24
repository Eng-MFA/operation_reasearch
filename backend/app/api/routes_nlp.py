from fastapi import APIRouter, HTTPException
from app.engine.nlp_solver import nlp_solver, NLPModelRequest, NLPResultResponse

router = APIRouter(prefix="/nlp", tags=["Nonlinear Programming"])

@router.post("/solve", response_model=NLPResultResponse)
def solve_nlp(req: NLPModelRequest):
    try:
        return nlp_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Nonlinear Solver Error: {str(e)}")
