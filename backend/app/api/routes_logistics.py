from fastapi import APIRouter, HTTPException
from app.engine.logistics_solver import (
    logistics_solver,
    CVRPRequest,
    CVRPResultResponse,
    FacilityLocationRequest,
    FacilityLocationResult
)

router = APIRouter(prefix="/logistics", tags=["Logistics & Supply Chain"])

@router.post("/cvrp", response_model=CVRPResultResponse)
def solve_cvrp(req: CVRPRequest):
    try:
        return logistics_solver.solve_cvrp(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CVRP Solver Error: {str(e)}")

@router.post("/facility-location", response_model=FacilityLocationResult)
def solve_facility_location(req: FacilityLocationRequest):
    try:
        return logistics_solver.solve_facility_location(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Facility Location Error: {str(e)}")
