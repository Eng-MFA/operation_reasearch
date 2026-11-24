import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import {
  Play,
  RotateCcw,
  LineChart,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

type ForecastMethod =
  | 'moving_average'
  | 'exponential_smoothing'
  | 'holt'
  | 'holt_winters'
  | 'arima';

interface MovingAverageParams {
  window: number;
}

interface ExponentialSmoothingParams {
  alpha: number;
}

interface HoltParams {
  alpha: number;
  beta: number;
}

interface HoltWintersParams {
  alpha: number;
  beta: number;
  gamma: number;
  periods: number;
}

interface ArimaParams {
  p: number;
  d: number;
  q: number;
}

interface ForecastResult {
  forecast: number[];
  fitted?: number[];
  mae?: number;
  rmse?: number;
  mape?: number;
  solver?: string;
  execution_time?: number;
  model_info?: Record<string, unknown>;
}

const METHOD_LABELS: Record<ForecastMethod, string> = {
  moving_average: 'Moving Average',
  exponential_smoothing: 'Exponential Smoothing',
  holt: "Holt's Linear Trend",
  holt_winters: "Holt-Winters",
  arima: 'ARIMA',
};

const DEFAULT_HISTORICAL = '142,153,167,159,180,194,185,201,210,222,215,230';

export const ForecastingView: React.FC = () => {
  const { t } = useLanguage();

  // Core state
  const [method, setMethod] = useState<ForecastMethod>('holt_winters');
  const [historicalData, setHistoricalData] = useState(DEFAULT_HISTORICAL);
  const [horizon, setHorizon] = useState(6);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Method-specific params
  const [maParams, setMaParams] = useState<MovingAverageParams>({ window: 3 });
  const [esParams, setEsParams] = useState<ExponentialSmoothingParams>({ alpha: 0.3 });
  const [holtParams, setHoltParams] = useState<HoltParams>({ alpha: 0.3, beta: 0.1 });
  const [hwParams, setHwParams] = useState<HoltWintersParams>({
    alpha: 0.3,
    beta: 0.1,
    gamma: 0.2,
    periods: 4,
  });
  const [arimaParams, setArimaParams] = useState<ArimaParams>({ p: 1, d: 1, q: 1 });

  const parseHistorical = (): number[] => {
    return historicalData
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n));
  };

  const getMethodParams = () => {
    switch (method) {
      case 'moving_average':
        return maParams;
      case 'exponential_smoothing':
        return esParams;
      case 'holt':
        return holtParams;
      case 'holt_winters':
        return hwParams;
      case 'arima':
        return arimaParams;
    }
  };

  const handleSolve = async () => {
    const data = parseHistorical();
    if (data.length < 2) {
      setError('Please enter at least 2 historical data points.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.solveForecast({
        method,
        data,
        horizon,
        ...getMethodParams(),
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? 'An error occurred while computing the forecast.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMethod('holt_winters');
    setHistoricalData(DEFAULT_HISTORICAL);
    setHorizon(6);
    setResult(null);
    setError(null);
    setMaParams({ window: 3 });
    setEsParams({ alpha: 0.3 });
    setHoltParams({ alpha: 0.3, beta: 0.1 });
    setHwParams({ alpha: 0.3, beta: 0.1, gamma: 0.2, periods: 4 });
    setArimaParams({ p: 1, d: 1, q: 1 });
  };

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-cyan-500 transition-colors';
  const labelClass = 'block text-xs font-medium text-slate-400 mb-1';

  // Build SVG chart data
  const buildChartData = () => {
    const historical = parseHistorical();
    const forecast = result?.forecast ?? [];
    const allValues = [...historical, ...forecast].filter(v => !isNaN(v));
    if (allValues.length === 0) return null;
    const minV = Math.min(...allValues);
    const maxV = Math.max(...allValues);
    const range = maxV - minV || 1;
    const totalPoints = historical.length + forecast.length;
    const svgW = 600;
    const svgH = 180;
    const padX = 40;
    const padY = 16;
    const plotW = svgW - padX * 2;
    const plotH = svgH - padY * 2;

    const toX = (i: number) => padX + (i / (totalPoints - 1)) * plotW;
    const toY = (v: number) => padY + plotH - ((v - minV) / range) * plotH;

    const histPoints = historical
      .map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(' ');

    const forecastPoints = forecast
      .map((v, i) => `${toX(historical.length + i).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(' ');

    // Connection point
    const lastHist = historical[historical.length - 1];
    const connX = toX(historical.length - 1);
    const connY = toY(lastHist);
    const firstFcX = forecast.length > 0 ? toX(historical.length) : connX;
    const firstFcY = forecast.length > 0 ? toY(forecast[0]) : connY;

    // Y-axis labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
      value: minV + f * range,
      y: padY + plotH - f * plotH,
    }));

    // X-axis labels (every ~4 points)
    const step = Math.max(1, Math.floor(totalPoints / 6));
    const xLabels = Array.from({ length: totalPoints }, (_, i) => i).filter(
      i => i % step === 0 || i === totalPoints - 1
    );

    return {
      histPoints,
      forecastPoints,
      connX,
      connY,
      firstFcX,
      firstFcY,
      yLabels,
      xLabels: xLabels.map(i => ({ i, x: toX(i) })),
      toX,
      toY,
      historical,
      forecast,
      svgW,
      svgH,
      padX,
      padY,
    };
  };

  const chartData = result ? buildChartData() : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          <span className="text-cyan-400">Forecasting</span> &amp; Time Series
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Predict future values using statistical and exponential smoothing models.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ===== LEFT PANEL ===== */}
        <div className="xl:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 h-fit">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" /> Configuration
          </h2>

          {/* Method Selector */}
          <div>
            <label className={labelClass}>Forecast Method</label>
            <select
              value={method}
              onChange={e => {
                setMethod(e.target.value as ForecastMethod);
                setResult(null);
                setError(null);
              }}
              className={`${inputClass} cursor-pointer`}
            >
              {(Object.entries(METHOD_LABELS) as [ForecastMethod, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Historical Data */}
          <div>
            <label className={labelClass}>Historical Data (comma-separated)</label>
            <textarea
              value={historicalData}
              onChange={e => setHistoricalData(e.target.value)}
              rows={3}
              placeholder="e.g. 142,153,167,159..."
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-slate-500 mt-1">
              {parseHistorical().length} data points
            </p>
          </div>

          {/* Horizon Slider */}
          <div>
            <label className={labelClass}>
              Forecast Horizon:{' '}
              <span className="text-cyan-400 font-semibold">{horizon} periods</span>
            </label>
            <input
              type="range"
              min={1}
              max={24}
              value={horizon}
              onChange={e => setHorizon(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-0.5">
              <span>1</span>
              <span>24</span>
            </div>
          </div>

          {/* Method-specific Params */}
          {method === 'moving_average' && (
            <div>
              <label className={labelClass}>Window Size</label>
              <input
                type="number"
                min={2}
                max={20}
                value={maParams.window}
                onChange={e => setMaParams({ window: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          )}

          {method === 'exponential_smoothing' && (
            <div>
              <label className={labelClass}>
                Alpha (α):{' '}
                <span className="text-cyan-400">{esParams.alpha.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0.01}
                max={0.99}
                step={0.01}
                value={esParams.alpha}
                onChange={e => setEsParams({ alpha: Number(e.target.value) })}
                className="w-full accent-cyan-400"
              />
            </div>
          )}

          {method === 'holt' && (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>
                  Alpha (α): <span className="text-cyan-400">{holtParams.alpha.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  value={holtParams.alpha}
                  onChange={e => setHoltParams(p => ({ ...p, alpha: Number(e.target.value) }))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Beta (β): <span className="text-cyan-400">{holtParams.beta.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  value={holtParams.beta}
                  onChange={e => setHoltParams(p => ({ ...p, beta: Number(e.target.value) }))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          )}

          {method === 'holt_winters' && (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>
                  Alpha (α): <span className="text-cyan-400">{hwParams.alpha.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  value={hwParams.alpha}
                  onChange={e => setHwParams(p => ({ ...p, alpha: Number(e.target.value) }))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Beta (β): <span className="text-cyan-400">{hwParams.beta.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  value={hwParams.beta}
                  onChange={e => setHwParams(p => ({ ...p, beta: Number(e.target.value) }))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Gamma (γ): <span className="text-cyan-400">{hwParams.gamma.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  value={hwParams.gamma}
                  onChange={e => setHwParams(p => ({ ...p, gamma: Number(e.target.value) }))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <label className={labelClass}>Seasonal Periods</label>
                <input
                  type="number"
                  min={2}
                  value={hwParams.periods}
                  onChange={e => setHwParams(p => ({ ...p, periods: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {method === 'arima' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>p (AR)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={arimaParams.p}
                  onChange={e => setArimaParams(a => ({ ...a, p: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>d (I)</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  value={arimaParams.d}
                  onChange={e => setArimaParams(a => ({ ...a, d: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>q (MA)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={arimaParams.q}
                  onChange={e => setArimaParams(a => ({ ...a, q: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-rose-900/30 border border-rose-700 text-rose-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSolve}
              disabled={loading}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-xl transition-colors flex-1 justify-center"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {loading ? 'Computing…' : 'Solve'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="xl:col-span-2 space-y-5">

          {/* Loading */}
          {loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center gap-4">
              <span className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Running {METHOD_LABELS[method]}…</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !result && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 flex flex-col items-center justify-center text-slate-600">
              <LineChart className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm font-medium">Configure parameters and run the solver.</p>
              <p className="text-xs mt-1 opacity-60">
                Forecast values, error metrics, and a chart will appear here.
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* SVG Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-cyan-400" /> Forecast Chart
                </h2>

                {chartData ? (
                  <div className="w-full overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${chartData.svgW} ${chartData.svgH + 20}`}
                      className="w-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Grid lines */}
                      {chartData.yLabels.map((yl, i) => (
                        <g key={i}>
                          <line
                            x1={chartData.padX}
                            y1={yl.y}
                            x2={chartData.svgW - chartData.padX}
                            y2={yl.y}
                            stroke="#334155"
                            strokeWidth="0.5"
                          />
                          <text
                            x={chartData.padX - 4}
                            y={yl.y + 4}
                            textAnchor="end"
                            fontSize="8"
                            fill="#64748b"
                          >
                            {Math.round(yl.value)}
                          </text>
                        </g>
                      ))}

                      {/* X-axis labels */}
                      {chartData.xLabels.map(({ i, x }) => (
                        <text
                          key={i}
                          x={x}
                          y={chartData.svgH + 14}
                          textAnchor="middle"
                          fontSize="8"
                          fill="#64748b"
                        >
                          {i < chartData.historical.length ? `H${i + 1}` : `F${i - chartData.historical.length + 1}`}
                        </text>
                      ))}

                      {/* Historical line */}
                      {chartData.historical.length > 1 && (
                        <polyline
                          points={chartData.histPoints}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Historical dots */}
                      {chartData.historical.map((v, i) => (
                        <circle
                          key={i}
                          cx={chartData.toX(i)}
                          cy={chartData.toY(v)}
                          r="3"
                          fill="#38bdf8"
                        />
                      ))}

                      {/* Forecast connector */}
                      {chartData.forecast.length > 0 && (
                        <line
                          x1={chartData.connX}
                          y1={chartData.connY}
                          x2={chartData.firstFcX}
                          y2={chartData.firstFcY}
                          stroke="#fb923c"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* Forecast line */}
                      {chartData.forecast.length > 1 && (
                        <polyline
                          points={chartData.forecastPoints}
                          fill="none"
                          stroke="#fb923c"
                          strokeWidth="2"
                          strokeDasharray="5 3"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Forecast dots */}
                      {chartData.forecast.map((v, i) => (
                        <circle
                          key={i}
                          cx={chartData.toX(chartData.historical.length + i)}
                          cy={chartData.toY(v)}
                          r="3"
                          fill="#fb923c"
                        />
                      ))}

                      {/* Legend */}
                      <g>
                        <line x1={chartData.padX} y1={chartData.svgH - 2} x2={chartData.padX + 16} y2={chartData.svgH - 2} stroke="#38bdf8" strokeWidth="2" />
                        <text x={chartData.padX + 20} y={chartData.svgH + 2} fontSize="8" fill="#94a3b8">Historical</text>
                        <line x1={chartData.padX + 70} y1={chartData.svgH - 2} x2={chartData.padX + 86} y2={chartData.svgH - 2} stroke="#fb923c" strokeWidth="2" strokeDasharray="4 2" />
                        <text x={chartData.padX + 90} y={chartData.svgH + 2} fontSize="8" fill="#94a3b8">Forecast</text>
                      </g>
                    </svg>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Not enough data to render chart.</p>
                )}
              </div>

              {/* Error Metrics */}
              {(result.mae !== undefined || result.rmse !== undefined || result.mape !== undefined) && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Error Metrics
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    {result.mae !== undefined && (
                      <div className="bg-slate-800 rounded-xl p-4 text-center">
                        <div className="text-xl font-bold text-cyan-400">
                          {result.mae.toFixed(3)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">MAE</div>
                        <div className="text-xs text-slate-500">Mean Abs. Error</div>
                      </div>
                    )}
                    {result.rmse !== undefined && (
                      <div className="bg-slate-800 rounded-xl p-4 text-center">
                        <div className="text-xl font-bold text-amber-400">
                          {result.rmse.toFixed(3)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">RMSE</div>
                        <div className="text-xs text-slate-500">Root Mean Sq. Error</div>
                      </div>
                    )}
                    {result.mape !== undefined && (
                      <div className="bg-slate-800 rounded-xl p-4 text-center">
                        <div className="text-xl font-bold text-violet-400">
                          {result.mape.toFixed(2)}%
                        </div>
                        <div className="text-xs text-slate-400 mt-1">MAPE</div>
                        <div className="text-xs text-slate-500">Mean Abs. % Error</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Forecast Values Table */}
              {result.forecast && result.forecast.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-cyan-400" /> Forecast Values
                  </h2>
                  <div className="overflow-auto max-h-56 rounded-xl border border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 sticky top-0">
                          <th className="px-4 py-2 text-left text-slate-400 font-medium">Period</th>
                          <th className="px-4 py-2 text-right text-slate-400 font-medium">
                            Forecast Value
                          </th>
                          <th className="px-4 py-2 text-right text-slate-400 font-medium">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.forecast.map((val, i) => {
                          const prev =
                            i === 0
                              ? parseHistorical().slice(-1)[0]
                              : result.forecast[i - 1];
                          const change = val - (prev ?? val);
                          const pct = prev ? ((change / prev) * 100).toFixed(1) : null;
                          return (
                            <tr
                              key={i}
                              className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}
                            >
                              <td className="px-4 py-2 text-slate-300">
                                <span className="bg-orange-900/40 text-orange-300 border border-orange-700 text-xs px-2 py-0.5 rounded-full">
                                  F+{i + 1}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-semibold text-slate-100">
                                {typeof val === 'number' ? val.toFixed(2) : val}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {pct !== null && (
                                  <span
                                    className={`text-xs font-medium ${
                                      change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {change >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(pct))}%
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Model Info */}
              {(result.solver || result.execution_time !== undefined) && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="text-sm font-semibold text-slate-400 mb-3">Model Info</h2>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {result.solver && (
                      <div>
                        <span className="text-slate-500">Solver: </span>
                        <span className="text-slate-200 font-mono">{result.solver}</span>
                      </div>
                    )}
                    {result.execution_time !== undefined && (
                      <div>
                        <span className="text-slate-500">Execution Time: </span>
                        <span className="text-cyan-400 font-mono">
                          {result.execution_time.toFixed(4)}s
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Method: </span>
                      <span className="text-slate-200">{METHOD_LABELS[method]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Horizon: </span>
                      <span className="text-slate-200">{horizon} periods</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
