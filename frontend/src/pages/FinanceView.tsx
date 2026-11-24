import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { Play, RotateCcw, DollarSign, TrendingUp, PieChart, CheckCircle2, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Asset {
  name: string;
  expected_return: number;
  std_dev: number;
}

interface PortfolioResult {
  weights: number[];
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  diversification_ratio?: number;
  asset_contributions?: { return_contribution: number; risk_contribution: number }[];
}

interface FrontierPoint {
  volatility: number;
  expected_return: number;
  sharpe_ratio?: number;
  weights?: number[];
}

interface FrontierResult {
  frontier_points: FrontierPoint[];
  min_variance_portfolio?: FrontierPoint;
  max_sharpe_portfolio?: FrontierPoint;
  risk_free_rate?: number;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
const DEFAULT_ASSETS: Asset[] = [
  { name: 'AAPL',  expected_return: 0.15, std_dev: 0.25 },
  { name: 'MSFT',  expected_return: 0.12, std_dev: 0.20 },
  { name: 'GOOGL', expected_return: 0.18, std_dev: 0.30 },
  { name: 'BONDS', expected_return: 0.04, std_dev: 0.05 },
  { name: 'GOLD',  expected_return: 0.08, std_dev: 0.18 },
];

const DEFAULT_CORR: number[][] = [
  [1,    0.7,  0.65, -0.2,  0.1 ],
  [0.7,  1,    0.75, -0.15, 0.05],
  [0.65, 0.75, 1,    -0.1,  0.15],
  [-0.2,-0.15,-0.1,   1,    0.2 ],
  [0.1,  0.05, 0.15,  0.2,  1   ],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function corrColor(val: number): string {
  if (val >= 0.6)  return 'bg-emerald-900/60 text-emerald-300';
  if (val >= 0.2)  return 'bg-emerald-900/30 text-emerald-400';
  if (val >= -0.1) return 'bg-slate-700 text-slate-300';
  if (val >= -0.4) return 'bg-rose-900/30 text-rose-400';
  return 'bg-rose-900/60 text-rose-300';
}

function fmt(n: number, digits = 2) {
  return (n * 100).toFixed(digits) + '%';
}

function fmtRaw(n: number, digits = 4) {
  return n.toFixed(digits);
}

// ---------------------------------------------------------------------------
// SVG Efficient Frontier Chart
// ---------------------------------------------------------------------------
interface FrontierChartProps {
  result: FrontierResult;
  rfr: number;
}
const FrontierChart: React.FC<FrontierChartProps> = ({ result, rfr }) => {
  const W = 600, H = 380;
  const PAD = { top: 30, right: 30, bottom: 50, left: 60 };
  const pts = result.frontier_points ?? [];
  if (pts.length === 0) return null;

  const xs = pts.map(p => p.volatility);
  const ys = pts.map(p => p.expected_return);
  const minX = Math.min(...xs) * 0.9;
  const maxX = Math.max(...xs) * 1.05;
  const minY = Math.min(...ys) * 0.9;
  const maxY = Math.max(...ys) * 1.05;

  const toSvgX = (v: number) => PAD.left + ((v - minX) / (maxX - minX)) * (W - PAD.left - PAD.right);
  const toSvgY = (v: number) => H - PAD.bottom - ((v - minY) / (maxY - minY)) * (H - PAD.top - PAD.bottom);

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toSvgX(p.volatility).toFixed(1)},${toSvgY(p.expected_return).toFixed(1)}`).join(' ');

  const mvp = result.min_variance_portfolio;
  const msp = result.max_sharpe_portfolio;

  // Capital Market Line
  let cmlPath = '';
  if (msp) {
    const x0 = toSvgX(0);
    const y0 = toSvgY(rfr);
    const x1 = toSvgX(maxX);
    const slope = (msp.expected_return - rfr) / msp.volatility;
    const y1 = toSvgY(rfr + slope * maxX);
    cmlPath = `M${x0},${y0} L${x1},${y1}`;
  }

  // Axis ticks
  const xTicks = 5;
  const yTicks = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl mx-auto">
      {/* Background */}
      <rect width={W} height={H} fill="#020617" rx="8" />
      {/* Grid lines */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = minY + (i / yTicks) * (maxY - minY);
        const y = toSvgY(val);
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{fmt(val, 0)}</text>
          </g>
        );
      })}
      {Array.from({ length: xTicks + 1 }, (_, i) => {
        const val = minX + (i / xTicks) * (maxX - minX);
        const x = toSvgX(val);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={PAD.top} y2={H - PAD.bottom} stroke="#1e293b" strokeWidth="1" />
            <text x={x} y={H - PAD.bottom + 16} textAnchor="middle" fill="#94a3b8" fontSize="10">{fmt(val, 0)}</text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#475569" strokeWidth="1.5" />
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} stroke="#475569" strokeWidth="1.5" />
      {/* Axis labels */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fill="#94a3b8" fontSize="12">Portfolio Volatility (Risk)</text>
      <text x={16} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize="12" transform={`rotate(-90, 16, ${H / 2})`}>Expected Return</text>
      <text x={W / 2} y={22} textAnchor="middle" fill="#22d3ee" fontSize="14" fontWeight="bold">Efficient Frontier</text>
      {/* CML */}
      {cmlPath && <path d={cmlPath} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,4" fill="none" />}
      {/* Frontier curve */}
      <path d={pathD} stroke="#22d3ee" strokeWidth="2" fill="none" />
      {/* Frontier dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={toSvgX(p.volatility)} cy={toSvgY(p.expected_return)} r="3" fill="#0e7490" />
      ))}
      {/* Min Variance Portfolio */}
      {mvp && (
        <g>
          <circle cx={toSvgX(mvp.volatility)} cy={toSvgY(mvp.expected_return)} r="7" fill="#f43f5e" />
          <text x={toSvgX(mvp.volatility) + 10} y={toSvgY(mvp.expected_return) + 4} fill="#f43f5e" fontSize="10">Min Var</text>
        </g>
      )}
      {/* Max Sharpe Portfolio */}
      {msp && (
        <g>
          {/* Star shape */}
          {[0, 72, 144, 216, 288].map((angle, i) => {
            const outer = 9, inner = 4;
            const a1 = (angle - 90) * Math.PI / 180;
            const a2 = (angle + 36 - 90) * Math.PI / 180;
            const cx = toSvgX(msp.volatility), cy = toSvgY(msp.expected_return);
            if (i === 0) return null;
            return null;
          })}
          <polygon
            points={[0, 1, 2, 3, 4].map(i => {
              const a = (i * 72 - 90) * Math.PI / 180;
              const b = (i * 72 + 36 - 90) * Math.PI / 180;
              const cx = toSvgX(msp.volatility), cy = toSvgY(msp.expected_return);
              return `${(cx + 9 * Math.cos(a)).toFixed(1)},${(cy + 9 * Math.sin(a)).toFixed(1)} ${(cx + 4 * Math.cos(b)).toFixed(1)},${(cy + 4 * Math.sin(b)).toFixed(1)}`;
            }).join(' ')}
            fill="#f59e0b"
          />
          <text x={toSvgX(msp.volatility) + 12} y={toSvgY(msp.expected_return) + 4} fill="#f59e0b" fontSize="10">Max Sharpe</text>
        </g>
      )}
      {/* Legend */}
      <g transform={`translate(${W - PAD.right - 130}, ${PAD.top + 10})`}>
        <rect width="130" height="72" fill="#0f172a" rx="4" stroke="#1e293b" />
        <circle cx="14" cy="16" r="4" fill="#0e7490" />
        <text x="24" y="20" fill="#94a3b8" fontSize="10">Frontier Portfolios</text>
        <circle cx="14" cy="34" r="6" fill="#f43f5e" />
        <text x="24" y="38" fill="#94a3b8" fontSize="10">Min Variance</text>
        <polygon points="14,43 17,50 24,50 18,55 20,62 14,58 8,62 10,55 4,50 11,50" fill="#f59e0b" />
        <text x="24" y="56" fill="#94a3b8" fontSize="10">Max Sharpe</text>
        <line x1="6" x2="22" y1="68" y2="68" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x="24" y="72" fill="#94a3b8" fontSize="10">Capital Mkt Line</text>
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const FinanceView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'optimizer' | 'frontier'>('optimizer');

  // Shared state
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [corrMatrix, setCorrMatrix] = useState<number[][]>(DEFAULT_CORR.map(r => [...r]));
  const [riskFreeRate, setRiskFreeRate] = useState(0.03);

  // Optimizer state
  const [optimTarget, setOptimTarget] = useState<'min_variance' | 'max_sharpe' | 'target_return'>('max_sharpe');
  const [targetReturnVal, setTargetReturnVal] = useState(0.12);
  const [portfolioResult, setPortfolioResult] = useState<PortfolioResult | null>(null);
  const [optimLoading, setOptimLoading] = useState(false);
  const [optimError, setOptimError] = useState<string | null>(null);

  // Frontier state
  const [frontierResult, setFrontierResult] = useState<FrontierResult | null>(null);
  const [frontierLoading, setFrontierLoading] = useState(false);
  const [frontierError, setFrontierError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Asset editing
  // ---------------------------------------------------------------------------
  const updateAsset = (i: number, field: keyof Asset, raw: string) => {
    setAssets(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === 'name' ? raw : parseFloat(raw) / 100 };
      return next;
    });
  };

  const updateCorr = (r: number, c: number, raw: string) => {
    const val = Math.max(-1, Math.min(1, parseFloat(raw) || 0));
    setCorrMatrix(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = val;
      next[c][r] = val; // keep symmetric
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Solve
  // ---------------------------------------------------------------------------
  const handleSolvePortfolio = async () => {
    setOptimLoading(true);
    setOptimError(null);
    try {
      const res = await (api as any).solvePortfolio({
        problem_type: 'portfolio',
        assets,
        correlation_matrix: corrMatrix,
        optimization_target: optimTarget,
        target_return: targetReturnVal,
        risk_free_rate: riskFreeRate,
      });
      setPortfolioResult(res);
    } catch (err: any) {
      setOptimError(err.message || 'Portfolio optimization failed');
    } finally {
      setOptimLoading(false);
    }
  };

  const handleSolveFrontier = async () => {
    setFrontierLoading(true);
    setFrontierError(null);
    try {
      const res = await (api as any).solvePortfolio({
        problem_type: 'efficient_frontier',
        assets,
        correlation_matrix: corrMatrix,
        risk_free_rate: riskFreeRate,
        num_points: 50,
      });
      setFrontierResult(res);
    } catch (err: any) {
      setFrontierError(err.message || 'Efficient frontier computation failed');
    } finally {
      setFrontierLoading(false);
    }
  };

  const handleReset = () => {
    setAssets(DEFAULT_ASSETS);
    setCorrMatrix(DEFAULT_CORR.map(r => [...r]));
    setPortfolioResult(null);
    setFrontierResult(null);
    setOptimError(null);
    setFrontierError(null);
  };

  // ---------------------------------------------------------------------------
  // Shared input panels
  // ---------------------------------------------------------------------------
  const AssetTable = () => (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">Asset Parameters</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Asset Name</th>
              <th className="px-4 py-2 text-center">Expected Return (%)</th>
              <th className="px-4 py-2 text-center">Std Dev (%)</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                <td className="px-4 py-2">
                  <input
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-24 text-slate-200 focus:outline-none focus:border-cyan-500"
                    value={a.name}
                    onChange={e => updateAsset(i, 'name', e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.1"
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-24 text-center text-emerald-400 focus:outline-none focus:border-cyan-500"
                    value={(a.expected_return * 100).toFixed(1)}
                    onChange={e => updateAsset(i, 'expected_return', e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.1"
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-24 text-center text-rose-400 focus:outline-none focus:border-cyan-500"
                    value={(a.std_dev * 100).toFixed(1)}
                    onChange={e => updateAsset(i, 'std_dev', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const CorrMatrixPanel = () => (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">Correlation Matrix</h3>
        <p className="text-xs text-slate-400 mt-0.5">Matrix is kept symmetric automatically</p>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="w-16" />
              {assets.map((a, i) => (
                <th key={i} className="px-2 py-1 text-center text-slate-400 font-medium w-16">{a.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {corrMatrix.map((row, r) => (
              <tr key={r}>
                <td className="px-2 py-1 text-slate-400 font-medium text-right pr-3">{assets[r]?.name}</td>
                {row.map((val, c) => (
                  <td key={c} className="p-0.5">
                    {r === c ? (
                      <div className="w-16 h-8 flex items-center justify-center rounded bg-slate-600 text-slate-300 font-bold">1.00</div>
                    ) : (
                      <input
                        type="number"
                        step="0.05"
                        min="-1"
                        max="1"
                        className={`w-16 h-8 text-center rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500 ${corrColor(val)}`}
                        value={val.toFixed(2)}
                        onChange={e => updateCorr(r, c, e.target.value)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Portfolio results
  // ---------------------------------------------------------------------------
  const PortfolioResults = ({ res }: { res: PortfolioResult }) => {
    const maxWeight = Math.max(...res.weights);
    return (
      <div className="space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Expected Return', value: fmt(res.expected_return), icon: <TrendingUp className="w-5 h-5" />, color: 'emerald' },
            { label: 'Portfolio Volatility', value: fmt(res.volatility), icon: <PieChart className="w-5 h-5" />, color: 'cyan' },
            { label: 'Sharpe Ratio', value: fmtRaw(res.sharpe_ratio), icon: <DollarSign className="w-5 h-5" />, color: 'amber' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className={`bg-slate-800 rounded-xl border border-${color}-800/50 p-4 flex items-center gap-4`}>
              <div className={`w-10 h-10 rounded-lg bg-${color}-900/40 flex items-center justify-center text-${color}-400`}>{icon}</div>
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-2xl font-bold text-${color}-400`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Optimal Asset Weights</h3>
          <div className="space-y-3">
            {assets.map((a, i) => {
              const w = res.weights[i] ?? 0;
              const pct = (w * 100).toFixed(1);
              const barW = maxWeight > 0 ? (w / maxWeight) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-14 text-right shrink-0">{a.name}</span>
                  <div className="flex-1 bg-slate-900 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-5 rounded-full bg-gradient-to-r from-cyan-700 to-cyan-400 flex items-center justify-end pr-2 transition-all duration-500"
                      style={{ width: `${barW}%` }}
                    >
                      {barW > 20 && <span className="text-xs font-bold text-white">{pct}%</span>}
                    </div>
                  </div>
                  {barW <= 20 && <span className="text-xs text-slate-300 w-10">{pct}%</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Weight table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200">Weight Decomposition</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-2 text-left">Asset</th>
                <th className="px-4 py-2 text-center">Weight</th>
                <th className="px-4 py-2 text-center">Return Contribution</th>
                <th className="px-4 py-2 text-center">Risk Contribution</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => {
                const w = res.weights[i] ?? 0;
                const rc = res.asset_contributions?.[i]?.return_contribution ?? w * a.expected_return;
                const rk = res.asset_contributions?.[i]?.risk_contribution ?? null;
                return (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20 text-xs">
                    <td className="px-4 py-2 font-medium text-slate-200">{a.name}</td>
                    <td className="px-4 py-2 text-center font-mono text-cyan-400">{fmt(w)}</td>
                    <td className="px-4 py-2 text-center font-mono text-emerald-400">{fmt(rc)}</td>
                    <td className="px-4 py-2 text-center font-mono text-rose-400">{rk !== null ? fmt(rk) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Diversification ratio */}
        {res.diversification_ratio !== undefined && (
          <div className="flex items-center gap-3 bg-slate-800 rounded-xl border border-slate-700 p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-sm text-slate-400">Diversification Ratio: </span>
              <span className="text-sm font-bold text-emerald-400">{fmtRaw(res.diversification_ratio)}</span>
              <p className="text-xs text-slate-500 mt-0.5">Ratio of weighted-avg individual volatility to portfolio volatility (higher = better diversified)</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-900/40 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Markowitz Portfolio Optimization</h1>
            <p className="text-sm text-slate-400">Mean-variance optimization with quadratic programming</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl mb-6 w-fit">
        {[
          { key: 'optimizer', label: 'Portfolio Optimizer' },
          { key: 'frontier', label: 'Efficient Frontier' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-cyan-700 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- TAB 1: Optimizer ---- */}
      {activeTab === 'optimizer' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div className="space-y-6">
            <AssetTable />
            <CorrMatrixPanel />

            {/* Optimization settings */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Optimization Settings</h3>

              {/* Target */}
              <div>
                <p className="text-xs text-slate-400 mb-2">Optimization Target</p>
                <div className="space-y-2">
                  {[
                    { value: 'max_sharpe', label: 'Maximum Sharpe Ratio (Tangency Portfolio)' },
                    { value: 'min_variance', label: 'Minimum Variance Portfolio' },
                    { value: 'target_return', label: 'Target Return' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="optim_target"
                        value={opt.value}
                        checked={optimTarget === opt.value}
                        onChange={() => setOptimTarget(opt.value as typeof optimTarget)}
                        className="accent-cyan-500"
                      />
                      <span className="text-sm text-slate-300 group-hover:text-slate-100">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Target return input */}
              {optimTarget === 'target_return' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Return (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-emerald-400 focus:outline-none focus:border-cyan-500 w-32"
                    value={(targetReturnVal * 100).toFixed(1)}
                    onChange={e => setTargetReturnVal(parseFloat(e.target.value) / 100)}
                  />
                </div>
              )}

              {/* Risk-free rate */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Risk-Free Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 w-32"
                  value={(riskFreeRate * 100).toFixed(2)}
                  onChange={e => setRiskFreeRate(parseFloat(e.target.value) / 100)}
                />
              </div>

              {/* Solve button */}
              <button
                onClick={handleSolvePortfolio}
                disabled={optimLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-cyan-900/30"
              >
                {optimLoading
                  ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <Play className="w-4 h-4" />}
                {optimLoading ? 'Optimizing…' : 'Solve Portfolio'}
              </button>
            </div>

            {/* Error */}
            {optimError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{optimError}</span>
              </div>
            )}
          </div>

          {/* Right: results */}
          <div>
            {portfolioResult ? (
              <PortfolioResults res={portfolioResult} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 py-20">
                <PieChart className="w-12 h-12 opacity-30" />
                <p className="text-sm">Configure assets and click <strong className="text-slate-400">Solve Portfolio</strong></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- TAB 2: Efficient Frontier ---- */}
      {activeTab === 'frontier' && (
        <div className="space-y-6">
          {/* Description */}
          <div className="bg-slate-800/60 border border-cyan-900/40 rounded-xl p-4 flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-cyan-400 mb-1">Efficient Frontier Analysis</h3>
              <p className="text-sm text-slate-400">
                Computing <strong className="text-slate-200">50 portfolios</strong> across the risk-return spectrum using quadratic programming.
                Each point represents a Pareto-optimal portfolio that maximises return for a given level of risk.
                The <span className="text-rose-400">Global Minimum Variance Portfolio</span> (red) anchors the frontier's left end,
                while the <span className="text-amber-400">Maximum Sharpe Ratio portfolio</span> (gold star) lies on the Capital Market Line.
              </p>
            </div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <AssetTable />
            <CorrMatrixPanel />
          </div>

          {/* Risk-free rate + solve */}
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Risk-Free Rate (%)</label>
              <input
                type="number"
                step="0.01"
                className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 w-32"
                value={(riskFreeRate * 100).toFixed(2)}
                onChange={e => setRiskFreeRate(parseFloat(e.target.value) / 100)}
              />
            </div>
            <button
              onClick={handleSolveFrontier}
              disabled={frontierLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-cyan-900/30"
            >
              {frontierLoading
                ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <Play className="w-4 h-4" />}
              {frontierLoading ? 'Computing…' : 'Compute Efficient Frontier'}
            </button>
          </div>

          {/* Error */}
          {frontierError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{frontierError}</span>
            </div>
          )}

          {/* Chart */}
          {frontierResult ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4">
              <FrontierChart result={frontierResult} rfr={riskFreeRate} />

              {/* Key portfolios summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {frontierResult.min_variance_portfolio && (
                  <div className="bg-slate-800 rounded-xl border border-rose-900/40 p-3">
                    <p className="text-xs font-semibold text-rose-400 mb-2">Global Minimum Variance Portfolio</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-slate-400">Return:</span>
                      <span className="text-slate-200 font-mono">{fmt(frontierResult.min_variance_portfolio.expected_return)}</span>
                      <span className="text-slate-400">Volatility:</span>
                      <span className="text-slate-200 font-mono">{fmt(frontierResult.min_variance_portfolio.volatility)}</span>
                    </div>
                  </div>
                )}
                {frontierResult.max_sharpe_portfolio && (
                  <div className="bg-slate-800 rounded-xl border border-amber-900/40 p-3">
                    <p className="text-xs font-semibold text-amber-400 mb-2">Maximum Sharpe Ratio Portfolio</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-slate-400">Return:</span>
                      <span className="text-slate-200 font-mono">{fmt(frontierResult.max_sharpe_portfolio.expected_return)}</span>
                      <span className="text-slate-400">Volatility:</span>
                      <span className="text-slate-200 font-mono">{fmt(frontierResult.max_sharpe_portfolio.volatility)}</span>
                      {frontierResult.max_sharpe_portfolio.sharpe_ratio !== undefined && (
                        <>
                          <span className="text-slate-400">Sharpe:</span>
                          <span className="text-slate-200 font-mono">{fmtRaw(frontierResult.max_sharpe_portfolio.sharpe_ratio)}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 py-20 bg-slate-900 rounded-2xl border border-slate-800">
              <TrendingUp className="w-12 h-12 opacity-30" />
              <p className="text-sm">Click <strong className="text-slate-400">Compute Efficient Frontier</strong> to generate the chart</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
