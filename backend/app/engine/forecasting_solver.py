import time
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing, Holt
from statsmodels.tsa.arima.model import ARIMA
from sklearn.metrics import mean_absolute_error, mean_squared_error

class ForecastRequest(BaseModel):
    model_name: str = "arima"  # "moving_average", "weighted_moving_average", "exponential_smoothing", "holt", "holt_winters", "arima"
    historical_data: List[float]
    forecast_horizon: int = 5
    # Parameters for moving average
    window_size: int = 3
    weights: Optional[List[float]] = None
    # Exponential smoothing parameters
    alpha: Optional[float] = 0.3
    beta: Optional[float] = 0.1
    gamma: Optional[float] = 0.1
    seasonal_periods: Optional[int] = 4
    seasonal_type: Optional[str] = "add"  # "add" or "mul"
    # ARIMA parameters (p, d, q)
    arima_order: Tuple[int, int, int] = (1, 1, 1)

class ForecastMetrics(BaseModel):
    mae: float
    mse: float
    rmse: float
    mape: float

class ForecastResultResponse(BaseModel):
    status: str
    model_name: str
    historical_fitted: List[float]
    forecast_values: List[float]
    metrics: ForecastMetrics
    execution_time_sec: float
    mathematical_summary: str


class ForecastingSolver:
    """
    Time Series & Demand Forecasting engine using Statsmodels,
    providing exact statistical models (ARIMA, Holt-Winters, SES)
    with MAE, MSE, RMSE, MAPE error decomposition.
    """

    def solve(self, req: ForecastRequest) -> ForecastResultResponse:
        start_time = time.perf_counter()
        data = np.array(req.historical_data, dtype=float)
        n = len(data)
        if n < 4:
            raise ValueError("Historical data must contain at least 4 observations for time-series forecasting.")

        mname = req.model_name.lower().strip()
        h = req.forecast_horizon

        fitted = []
        forecast = []

        if mname == "moving_average":
            k = max(1, min(req.window_size, n - 1))
            fitted = [float(data[0])] * k
            for i in range(k, n):
                fitted.append(float(np.mean(data[i - k:i])))
            # Future forecast is constant average of last k
            last_avg = float(np.mean(data[-k:]))
            forecast = [last_avg] * h

        elif mname == "weighted_moving_average":
            k = max(1, min(req.window_size, n - 1))
            weights = req.weights or list(range(1, k + 1))
            w_norm = np.array(weights[:k], dtype=float) / sum(weights[:k])
            fitted = [float(data[0])] * k
            for i in range(k, n):
                fitted.append(float(np.dot(data[i - k:i], w_norm)))
            last_w = float(np.dot(data[-k:], w_norm))
            forecast = [last_w] * h

        elif mname == "exponential_smoothing":
            model = SimpleExpSmoothing(data).fit(smoothing_level=req.alpha, optimized=req.alpha is None)
            fitted = list(map(float, model.fittedvalues))
            forecast = list(map(float, model.forecast(h)))

        elif mname == "holt":
            model = Holt(data).fit(smoothing_level=req.alpha, smoothing_trend=req.beta, optimized=(req.alpha is None))
            fitted = list(map(float, model.fittedvalues))
            forecast = list(map(float, model.forecast(h)))

        elif mname == "holt_winters":
            s_periods = min(req.seasonal_periods or 4, n // 2)
            model = ExponentialSmoothing(
                data,
                trend="add",
                seasonal=req.seasonal_type or "add",
                seasonal_periods=s_periods
            ).fit()
            fitted = list(map(float, model.fittedvalues))
            forecast = list(map(float, model.forecast(h)))

        elif mname == "arima":
            p, d, q = req.arima_order
            model = ARIMA(data, order=(p, d, q)).fit()
            fitted = list(map(float, model.fittedvalues))
            forecast = list(map(float, model.forecast(h)))

        else:
            raise ValueError(f"Unsupported forecasting model: {mname}")

        # Compute error metrics on historical fit
        valid_idx = min(len(data), len(fitted))
        y_true = data[:valid_idx]
        y_pred = np.array(fitted[:valid_idx])

        mae = float(mean_absolute_error(y_true, y_pred))
        mse = float(mean_squared_error(y_true, y_pred))
        rmse = float(np.sqrt(mse))
        # Non-zero division safe MAPE
        non_zero = np.abs(y_true) > 1e-6
        if np.any(non_zero):
            mape = float(np.mean(np.abs((y_true[non_zero] - y_pred[non_zero]) / y_true[non_zero])) * 100.0)
        else:
            mape = 0.0

        exec_time = time.perf_counter() - start_time

        summary = (
            f"Forecast computed using {req.model_name.upper()} over {h} future periods. "
            f"Model Accuracy: MAE = {mae:.2f}, RMSE = {rmse:.2f}, MAPE = {mape:.2f}%. "
            f"Next period forecast: {forecast[0]:.2f} units."
        )

        return ForecastResultResponse(
            status="SUCCESS",
            model_name=req.model_name,
            historical_fitted=[round(x, 2) for x in fitted],
            forecast_values=[round(x, 2) for x in forecast],
            metrics=ForecastMetrics(mae=round(mae, 4), mse=round(mse, 4), rmse=round(rmse, 4), mape=round(mape, 2)),
            execution_time_sec=exec_time,
            mathematical_summary=summary
        )

forecasting_solver = ForecastingSolver()
