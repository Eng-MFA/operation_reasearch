import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { Play, RotateCcw, Dice5, TrendingUp, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scenario {
  name: string;
  probability: number;
  demand: number;
}

type Distribution = 'normal' | 'uniform' | 'triangular';

// ─── Component ───────────────────────────────────────────────────────────────

export const StochasticView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  // ── Tab 1: Two-Stage Stochastic LP ────────────────────────────────────────
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { name: 'Low',    probability: 0.3, demand: 80  },
    { name: 'Medium', probability: 0.5, demand: 100 },
    { name: 'High',   probability: 0.2, demand: 120 },
  ]);
  const [firstStage, setFirstStage] = useState({ production_capacity: 100, unit_cost: 5 });
  const [secondStage, setSecondStage] = useState({ selling_price: 12, salvage_value: 2, penalty_cost: 8 });
  const [stochasticResult, setStochasticResult] = useState<any>(null);
  const [stochasticLoading, setStochasticLoading] = useState(false);
  const [stochasticError, setStochasticError] = useState<string | null>(null);

  // ── Tab 2: Monte Carlo ────────────────────────────────────────────────────
  const [numSimulations, setNumSimulations] = useState(1000);
  const [distribution, setDistribution] = useState<Distribution>('normal');
  const [distParams, setDistParams] = useState({ mean: 100, std: 20, min_val: 60, max_val: 140, mode: 100 });
  const [objectiveFunction, setObjectiveFunction] = useState('profit = price * min(demand, quantity) - cost * quantity');
  const [decisionVars, setDecisionVars] = useState({ quantity: 90, price: 15, cost: 8 });
  const [mcResult, setMcResult] = useState<any>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);

  // ── Handlers: Two-Stage ───────────────────────────────────────────────────
  const addScenario = () =>
    setScenarios(prev => [...prev, { name: `S${prev.length + 1}`, probability: 0.1, demand: 100 }]);

  const removeScenario = (idx: number) =>
    setScenarios(prev => prev.filter((_, i) => i !== idx));

  const updateScenario = (idx: number, field: keyof Scenario, value: string) =>
    setScenarios(prev =>
      prev.map((s, i) =>
        i === idx ? { ...s, [field]: field === 'name' ? value : parseFloat(value) || 0 } : s
      )
    );

  const handleSolveStochastic = async () => {
    setStochasticLoading(true);
    setStochasticError(null);
    setStochasticResult(null);
    try {
      const res = await api.solveStochastic({
        problem_type: 'two_stage',
        scenarios,
        first_stage_vars: firstStage,
        second_stage: secondStage,
      });
      setStochasticResult(res);
    } catch (err: any) {
      setStochasticError(err.message || 'Solver error');
    } finally {
      setStochasticLoading(false);
    }
  };

  const handleResetStochastic = () => {
    setScenarios([
      { name: 'Low',    probability: 0.3, demand: 80  },
      { name: 'Medium', probability: 0.5, demand: 100 },
      { name: 'High',   probability: 0.2, demand: 120 },
    ]);
    setFirstStage({ production_capacity: 100, unit_cost: 5 });
    setSecondStage({ selling_price: 12, salvage_value: 2, penalty_cost: 8 });
    setStochasticResult(null);
    setStochasticError(null);
  };

  // ── Handlers: Monte Carlo ─────────────────────────────────────────────────
  const handleSolveMC = async () => {
    setMcLoading(true);
    setMcError(null);
    setMcResult(null);
    try {
      const res = await api.solveStochastic({
        problem_type: 'monte_carlo',
        num_simulations: numSimulations,
        distribution,
        params: distParams,
        decision_vars: decisionVars,
      });
      setMcResult(res);
    } catch (err: any) {
      setMcError(err.message || 'Solver error');
    } finally {
      setMcLoading(false);
    }
  };

  const handleResetMC = () => {
    setNumSimulations(1000);
    setDistribution('normal');
    setDistParams({ mean: 100, std: 20, min_val: 60, max_val: 140, mode: 100 });
    setObjectiveFunction('profit = price * min(demand, quantity) - cost * quantity');
    setDecisionVars({ quantity: 90, price: 15, cost: 8 });
    setMcResult(null);
    setMcError(null);
  };

  // ── SVG Histogram ─────────────────────────────────────────────────────────
  const renderHistogram = (samples: number[]) => {
    if (!samples || samples.length === 0) return null;
    const BINS = 20;
    const W = 480, H = 160, PAD = { top: 10, right: 10, bottom: 30, left: 40 };
    const minV = Math.min(...samples);
    const maxV = Math.max(...samples);
    const binW = (maxV - minV) / BINS || 1;
    const counts = Array(BINS).fill(0);
    samples.forEach(v => {
      const idx = Math.min(Math.floor((v - minV) / binW), BINS - 1);
      counts[idx]++;
    });
    const maxCount = Math.max(...counts);
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const barW = innerW / BINS;

    return (
      <svg width={W} height={H} className="w-full">
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Bars */}
          {counts.map((c, i) => {
            const bh = maxCount > 0 ? (c / maxCount) * innerH : 0;
            return (
              <rect
                key={i}
                x={i * barW + 1}
                y={innerH - bh}
                width={barW - 2}
                height={bh}
                fill="#06b6d4"
                opacity={0.8}
              />
            );
          })}
          {/* X-axis */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#475569" strokeWidth={1} />
          {/* Y-axis */}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#475569" strokeWidth={1} />
          {/* X labels */}
          {[0, 5, 10, 15, 20].map(i => (
            <text
              key={i}
              x={i * barW}
              y={innerH + 18}
              fill="#94a3b8"
              fontSize={9}
              textAnchor="middle"
            >
              {(minV + i * binW).toFixed(0)}
            </text>
          ))}
          {/* Y labels */}
          {[0, 0.5, 1].map(frac => (
            <text
              key={frac}
              x={-6}
              y={innerH - frac * innerH + 3}
              fill="#94a3b8"
              fontSize={9}
              textAnchor="end"
            >
              {Math.round(frac * maxCount)}
            </text>
          ))}
        </g>
      </svg>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Dice5 className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Stochastic &amp; Robust Optimization</h1>
          <p className="text-slate-400 text-sm">Optimize decisions under uncertainty using stochastic programming and simulation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {['Two-Stage Stochastic LP', 'Monte Carlo Simulation'].map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx as 0 | 1)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === idx
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 0 : Two-Stage Stochastic LP                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div className="space-y-5">
            {/* Scenario Table */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" /> Scenarios
                </h2>
                <button
                  onClick={addScenario}
                  className="text-xs px-3 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded-md transition-colors"
                >
                  + Add Scenario
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left pb-2 font-medium">Name</th>
                      <th className="text-left pb-2 font-medium">Probability</th>
                      <th className="text-left pb-2 font-medium">Demand</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {scenarios.map((s, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-2">
                          <input
                            value={s.name}
                            onChange={e => updateScenario(i, 'name', e.target.value)}
                            className="w-20 bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            value={s.probability}
                            min={0} max={1} step={0.05}
                            onChange={e => updateScenario(i, 'probability', e.target.value)}
                            className="w-20 bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            value={s.demand}
                            onChange={e => updateScenario(i, 'demand', e.target.value)}
                            className="w-20 bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => removeScenario(i)}
                            disabled={scenarios.length <= 2}
                            className="text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Σ p = {scenarios.reduce((acc, s) => acc + s.probability, 0).toFixed(2)} (must equal 1.0)
              </p>
            </div>

            {/* First-stage params */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> First-Stage Parameters
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(firstStage).map(([k, v]) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-400 mb-1 capitalize">{k.replace(/_/g, ' ')}</label>
                    <input
                      type="number"
                      value={v}
                      onChange={e => setFirstStage(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Second-stage params */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Second-Stage Parameters
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(secondStage).map(([k, v]) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-400 mb-1 capitalize">{k.replace(/_/g, ' ')}</label>
                    <input
                      type="number"
                      value={v}
                      onChange={e => setSecondStage(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSolveStochastic}
                disabled={stochasticLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
              >
                {stochasticLoading
                  ? <span className="animate-spin text-lg">⏳</span>
                  : <Play className="w-4 h-4" />}
                {stochasticLoading ? 'Solving…' : 'Solve Two-Stage SP'}
              </button>
              <button
                onClick={handleResetStochastic}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {stochasticError && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {stochasticError}
              </div>
            )}
          </div>

          {/* Right: results */}
          <div className="space-y-5">
            {stochasticResult ? (
              <>
                {/* Expected Value Metrics */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Expected Value Metrics
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'EEV', desc: 'EV Solution', value: stochasticResult.eev, color: 'text-amber-400' },
                      { label: 'RP',  desc: 'Recourse Problem', value: stochasticResult.rp, color: 'text-cyan-400' },
                      { label: 'WS',  desc: 'Wait-and-See', value: stochasticResult.ws, color: 'text-emerald-400' },
                    ].map(m => (
                      <div key={m.label} className="bg-slate-700/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                        <p className={`text-xl font-bold ${m.color}`}>
                          {typeof m.value === 'number' ? m.value.toFixed(2) : '—'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* EVPI */}
                <div className="bg-cyan-900/20 border border-cyan-700/40 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-cyan-300 font-semibold text-sm">EVPI — Value of Perfect Information</p>
                      <p className="text-xs text-slate-400 mt-0.5">EVPI = WS − RP</p>
                    </div>
                    <p className="text-3xl font-bold text-cyan-400">
                      {stochasticResult.evpi != null ? stochasticResult.evpi.toFixed(2) : '—'}
                    </p>
                  </div>
                </div>

                {/* VSS */}
                <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-300 font-semibold text-sm">VSS — Value of Stochastic Solution</p>
                      <p className="text-xs text-slate-400 mt-0.5">VSS = RP − EEV</p>
                    </div>
                    <p className="text-3xl font-bold text-emerald-400">
                      {stochasticResult.vss != null ? stochasticResult.vss.toFixed(2) : '—'}
                    </p>
                  </div>
                </div>

                {/* Per-scenario decisions */}
                {stochasticResult.scenario_decisions && (
                  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h2 className="text-white font-semibold mb-3">Second-Stage Decisions by Scenario</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-700">
                            <th className="text-left pb-2 font-medium">Scenario</th>
                            <th className="text-right pb-2 font-medium">Sold</th>
                            <th className="text-right pb-2 font-medium">Salvaged</th>
                            <th className="text-right pb-2 font-medium">Shortfall</th>
                            <th className="text-right pb-2 font-medium">Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {stochasticResult.scenario_decisions.map((d: any, i: number) => (
                            <tr key={i} className="text-slate-300">
                              <td className="py-2">{d.scenario}</td>
                              <td className="py-2 text-right">{d.sold?.toFixed(1) ?? '—'}</td>
                              <td className="py-2 text-right">{d.salvaged?.toFixed(1) ?? '—'}</td>
                              <td className="py-2 text-right text-red-400">{d.shortfall?.toFixed(1) ?? '—'}</td>
                              <td className="py-2 text-right text-emerald-400">{d.profit?.toFixed(2) ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-slate-800 rounded-xl p-10 border border-slate-700 flex flex-col items-center justify-center text-center gap-3">
                <Dice5 className="w-10 h-10 text-slate-600" />
                <p className="text-slate-400">Configure your scenarios and parameters, then click <span className="text-cyan-400">Solve</span> to compute the stochastic solution.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 : Monte Carlo Simulation                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div className="space-y-5">
            {/* Distribution selector */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" /> Demand Distribution
              </h2>
              <div className="flex gap-2 mb-4">
                {(['normal', 'uniform', 'triangular'] as Distribution[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDistribution(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      distribution === d
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {distribution === 'normal' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Mean (μ)</label>
                      <input type="number" value={distParams.mean}
                        onChange={e => setDistParams(p => ({ ...p, mean: +e.target.value }))}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Std Dev (σ)</label>
                      <input type="number" value={distParams.std}
                        onChange={e => setDistParams(p => ({ ...p, std: +e.target.value }))}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                  </>
                )}
                {distribution === 'uniform' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min</label>
                      <input type="number" value={distParams.min_val}
                        onChange={e => setDistParams(p => ({ ...p, min_val: +e.target.value }))}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max</label>
                      <input type="number" value={distParams.max_val}
                        onChange={e => setDistParams(p => ({ ...p, max_val: +e.target.value }))}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                  </>
                )}
                {distribution === 'triangular' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min</label>
                      <input type="number" value={distParams.min_val}
                        onChange={e => setDistParams(p => ({ ...p, min_val: +e.target.value }))}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Mode</label>
                      <input type="number" value={distParams.mode}
                        onChange={e => setDistParams(p => ({ ...p, mode: +e.target.value }))}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max</label>
                      <input type="number" value={distParams.max_val}
                        onChange={e => setDistParams(p => ({ ...p, max_val: +e.target.value }))}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Decision variables */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> Decision Variables
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(decisionVars).map(([k, v]) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-400 mb-1 capitalize">{k}</label>
                    <input type="number" value={v}
                      onChange={e => setDecisionVars(prev => ({ ...prev, [k]: +e.target.value }))}
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Objective function */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h2 className="text-white font-semibold mb-3">Objective Function</h2>
              <textarea
                value={objectiveFunction}
                onChange={e => setObjectiveFunction(e.target.value)}
                rows={2}
                className="w-full bg-slate-700 text-cyan-300 font-mono px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>

            {/* Simulations slider */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-sm">Number of Simulations</h2>
                <span className="text-cyan-400 font-bold">{numSimulations.toLocaleString()}</span>
              </div>
              <input
                type="range" min={100} max={10000} step={100}
                value={numSimulations}
                onChange={e => setNumSimulations(+e.target.value)}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>100</span><span>10,000</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSolveMC}
                disabled={mcLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
              >
                {mcLoading ? <span className="animate-spin">⏳</span> : <Play className="w-4 h-4" />}
                {mcLoading ? 'Simulating…' : 'Run Monte Carlo'}
              </button>
              <button
                onClick={handleResetMC}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {mcError && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {mcError}
              </div>
            )}
          </div>

          {/* Right: results */}
          <div className="space-y-5">
            {mcResult ? (
              <>
                {/* Summary metrics */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Mean', value: mcResult.mean, color: 'text-cyan-400' },
                    { label: 'Std Dev', value: mcResult.std_dev, color: 'text-amber-400' },
                    { label: '5th Percentile', value: mcResult.percentile_5, color: 'text-slate-300' },
                    { label: '95th Percentile', value: mcResult.percentile_95, color: 'text-emerald-400' },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                      <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                      <p className={`text-xl font-bold ${m.color}`}>
                        {typeof m.value === 'number' ? m.value.toFixed(2) : '—'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Histogram */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" /> Outcome Distribution
                  </h2>
                  <div className="w-full overflow-x-auto">
                    {renderHistogram(mcResult.samples || [])}
                  </div>
                  {(!mcResult.samples || mcResult.samples.length === 0) && (
                    <p className="text-slate-500 text-sm text-center">No sample data returned.</p>
                  )}
                </div>

                {/* Risk metrics */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Risk Metrics
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'P(loss)', value: mcResult.prob_loss != null ? `${(mcResult.prob_loss * 100).toFixed(1)}%` : '—', color: 'text-red-400' },
                      { label: 'VaR (95%)', value: mcResult.var_95 != null ? mcResult.var_95.toFixed(2) : '—', color: 'text-orange-400' },
                      { label: 'CVaR (95%)', value: mcResult.cvar_95 != null ? mcResult.cvar_95.toFixed(2) : '—', color: 'text-rose-400' },
                    ].map(m => (
                      <div key={m.label} className="bg-slate-700/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                        <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-800 rounded-xl p-10 border border-slate-700 flex flex-col items-center justify-center text-center gap-3">
                <Dice5 className="w-10 h-10 text-slate-600" />
                <p className="text-slate-400">Set up your distribution and decision variables, then click <span className="text-cyan-400">Run Monte Carlo</span>.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
