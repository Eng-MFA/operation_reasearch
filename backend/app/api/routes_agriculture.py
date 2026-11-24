from fastapi import APIRouter, HTTPException
from app.engine.agriculture_solver import (
    agriculture_solver,
    DietBlendingRequest,
    DietBlendingResult,
    CropPlanningRequest,
    CropPlanningResult
)

router = APIRouter(prefix="/agriculture", tags=["Agricultural & Food Optimization"])

@router.post("/feed-blending", response_model=DietBlendingResult)
def solve_feed_blending(req: DietBlendingRequest):
    try:
        return agriculture_solver.solve_feed_blending(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Feed Blending Error: {str(e)}")

@router.post("/crop-planning", response_model=CropPlanningResult)
def solve_crop_planning(req: CropPlanningRequest):
    try:
        return agriculture_solver.solve_crop_planning(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Crop Planning Error: {str(e)}")
