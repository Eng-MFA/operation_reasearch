from fastapi import APIRouter, HTTPException
from app.engine.energy_solver import (
    energy_solver,
    EconomicDispatchParam,
    EnergyDispatchResult,
    MicrogridDispatchParam,
    MicrogridScheduleResult
)

router = APIRouter(prefix="/energy", tags=["Electrical & Energy Systems"])

@router.post("/economic-dispatch", response_model=EnergyDispatchResult)
def run_economic_dispatch(req: EconomicDispatchParam):
    try:
        return energy_solver.solve_economic_dispatch(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Economic Dispatch Error: {str(e)}")

@router.post("/microgrid-dispatch", response_model=MicrogridScheduleResult)
def run_microgrid_dispatch(req: MicrogridDispatchParam):
    try:
        return energy_solver.solve_microgrid_battery(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Microgrid Battery Dispatch Error: {str(e)}")
