from fastapi import APIRouter, HTTPException
from app.engine.forecasting_solver import forecasting_solver, ForecastRequest, ForecastResultResponse

router = APIRouter(prefix="/forecasting", tags=["Time Series & Demand Forecasting"])

@router.post("/forecast", response_model=ForecastResultResponse)
def compute_forecast(req: ForecastRequest):
    try:
        return forecasting_solver.solve(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Forecasting Error: {str(e)}")
