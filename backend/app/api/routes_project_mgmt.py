from fastapi import APIRouter, HTTPException
from app.engine.project_mgmt_solver import project_mgmt_solver, ProjectModelRequest, ProjectResultResponse

router = APIRouter(prefix="/project-mgmt", tags=["Project Management (CPM/PERT)"])

@router.post("/solve", response_model=ProjectResultResponse)
def solve_project(req: ProjectModelRequest):
    try:
        return project_mgmt_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Project Management Solver Error: {str(e)}")
