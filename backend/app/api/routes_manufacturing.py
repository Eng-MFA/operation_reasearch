from fastapi import APIRouter, HTTPException
from app.engine.manufacturing_solver import (
    manufacturing_solver,
    ProductionPlanRequest,
    ProductionPlanResult,
    JobShopRequest,
    JobShopScheduleResult
)

router = APIRouter(prefix="/manufacturing", tags=["Industrial & Manufacturing Optimization"])

@router.post("/production-plan", response_model=ProductionPlanResult)
def solve_production_plan(req: ProductionPlanRequest):
    try:
        return manufacturing_solver.solve_production_planning(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Production Planning Error: {str(e)}")

@router.post("/job-shop", response_model=JobShopScheduleResult)
def solve_job_shop(req: JobShopRequest):
    try:
        return manufacturing_solver.solve_job_shop(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Job Shop Scheduling Error: {str(e)}")
