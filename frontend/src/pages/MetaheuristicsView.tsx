import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { Play, RotateCcw, Dna, Zap, TrendingDown, CheckCircle2, Settings } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type AlgorithmType = 'genetic_algorithm' | 'pso' | 'simulated_annealing' | 'differential_evolution';
type ProblemType   = 'tsp' | 'continuous_function' | 'knapsack';

interface GAParams   { population_size: number; max_generations: number; mutation_rate: number; crossover_rate: number; }
interface PSOParams  { num_particles: number; max_iterations: number; w: number; c1: number; c2: number; }
interface SAParams   { initial_temp: number; cooling_rate: number; max_iterations: number; min_temp: number; }
interface DEParams   { population_size: number; max_generations: number; F: number; CR: number; }

// ─── Component ───────────────────────────────────────────────────────────────

export const MetaheuristicsView: React.FC = () => {
  const { t } = useLanguage();

  // ── Core state ────────────────────────────────────────────────────────────
  const [algorithm, setAlgorithm]       = useState<AlgorithmType>('genetic_algorithm');
  const [problemType, setProblemType]   = useState<ProblemType>('continuous_function');
  const [targetFunction, setTargetFunction] = useState('Rastrigin: f(x) = 10n + sum(xi^2 - 10*cos(2*pi*xi))');
  const [dimensions, setDimensions]     = useState(5);
  const [result, setResult]             = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Algorithm parameters ─────────────────────────────────────────────────
  const [gaParams, setGaParams]   = useState<GAParams>({  population_size: 100, max_generations: 200, mutation_rate: 0.01, crossover_rate: 0.8 });
  const [psoParams, setPsoParams] = useState<PSOParams>({ num_particles: 50, max_iterations: 200, w: 0.729, c1: 1.49, c2: 1.49 });
  const [saParams, setSaParams]   = useState<SAParams>({  initial_temp: 1000, cooling_rate: 0.95, max_iterations: 5000, min_temp: 0.01 });
  const [deParams, setDeParams]   = useState<DEParams>({  population_size: 50, max_generations: 200, F: 0.8, CR: 0.9 });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getAlgorithmParams = () => {
    switch (algorithm) {
      case 'genetic_algorithm':      return gaParams;
      case 'pso':                    return psoParams;
      case 'simulated_annealing':    return saParams;
      case 'differential_evolution': return deParams;
    }
  };

  const setParamValue = (key: string, value: number) => {
    switch (algorithm) {
      case 'genetic_algorithm':      setGaParams(p  => ({ ...p, [key]: value })); break;
      case 'pso':                    setPsoParams(p => ({ ...p, [key]: value })); break;
      case 'simulated_annealing':    setSaParams(p  => ({ ...p, [key]: value })); break;
      case 'differential_evolution': setDeParams(p  => ({ ...p, [key]: value })); break;
    }
  };

  const algorithmMeta: Record<AlgorithmType, { label: string; icon: React.ReactNode; color: string }> = {
    genetic_algorithm:      { label: 'Genetic Algorithm',      icon: <Dna  className="w-4 h-4" />, color: 'emerald' },
    pso:                    { label: 'Particle Swarm (PSO)',    icon: <Zap  className="w-4 h-4" />, color: 'cyan'    },
    simulated_annealing:    { label: 'Simulated Annealing',    icon: <TrendingDown className="w-4 h-4" />, color: 'amber' },
    differential_evolution: { label: 'Differential Evolution', icon: <Settings className="w-4 h-4" />, color: 'violet' },
  };

  const colorClass: Record<string, string> = {
    emerald: 'bg-emerald-600 text-white',
    cyan:    'bg-cyan-600 text-white',
    amber:   'bg-amber-600 text-white',
    violet:  'bg-violet-600 text-white',
  };

  const problemFormulations: Record<ProblemType, string> = {
    continuous_function: 'Rastrigin Function (n-D)\nf(x) = 10n + Σ[xi² - 10·cos(2π·xi)]\nxi ∈ [-5.12, 5.12], Global min = 0 at x=0',
    tsp: 'Travelling Salesman Problem\nMinimize total tour distance:\nmin Σ d(ci, ci+1) over all city permutations',
    knapsack: '0/1 Knapsack Problem\nmax Σ vi·xi  s.t. Σ wi·xi ≤ W\nxi ∈ {0,1}, binary selection',
  };

  // ── Solve ─────────────────────────────────────────────────────────────────
  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const bounds = Array(dimensions).fill([-5.12, 5.12]);
      const res = await api.solveMetaheuristics({
        algorithm,
        problem_type: problemType,
        dimensions,
        algorithm_params: getAlgorithmParams(),
        bounds,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Solver error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setDimensions(5);
    setAlgorithm('genetic_algorithm');
    setProblemType('continuous_function');
    setGaParams({  population_size: 100, max_generations: 200, mutation_rate: 0.01, crossover_rate: 0.8 });
    setPsoParams({ num_particles: 50, max_iterations: 200, w: 0.729, c1: 1.49, c2: 1.49 });
    setSaParams({  initial_temp: 1000, cooling_rate: 0.95, max_iterations: 5000, min_temp: 0.01 });
    setDeParams({  population_size: 50, max_generations: 200, F: 0.8, CR: 0.9 });
  };

  // ── Convergence SVG chart ─────────────────────────────────────────────────
  const renderConvergenceChart = (history: number[]) => {
    if (!history || history.length < 2) return null;
    const W = 460, H = 180;
    const PAD = { top: 15, right: 15, bottom: 30, left: 55 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top  - PAD.bottom;
    const minV = Math.min(...history);
    const maxV = Math.max(...history);
    const range = maxV - minV || 1;
    const n = history.length;

    const toX = (i: number) => (i / (n - 1)) * innerW;
    const toY = (v: number) => innerH - ((v - minV) / range) * innerH;

    const pathD = history
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(' ');

    // Y-axis ticks (5 evenly spaced)
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ frac: f, val: minV + f * range }));
    // X-axis ticks (5 evenly spaced)
    const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ frac: f, idx: Math.round(f * (n - 1)) }));

    return (
      <svg width={W} height={H} className="w-full">
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid */}
          {yTicks.map(t => (
            <line key={t.frac} x1={0} y1={toY(t.val)} x2={innerW} y2={toY(t.val)}
              stroke="#334155" strokeWidth={1} strokeDasharray="4,4" />
          ))}
          {/* Axes */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#475569" strokeWidth={1} />
          <line x1={0} y1={0}      x2={0}      y2={innerH} stroke="#475569" strokeWidth={1} />

          {/* Area fill */}
          <path
            d={`${pathD} L${toX(n - 1).toFixed(1)},${innerH} L0,${innerH} Z`}
            fill="url(#convGrad)"
            opacity={0.15}
          />
          {/* Line */}
          <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth={2} strokeLinejoin="round" />

          {/* Gradient def */}
          <defs>
            <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Y labels */}
          {yTicks.map(t => (
            <text key={t.frac} x={-6} y={toY(t.val) + 3}
              fill="#94a3b8" fontSize={9} textAnchor="end">
              {t.val.toFixed(2)}
            </text>
          ))}
          {/* X labels */}
          {xTicks.map(t => (
            <text key={t.frac} x={toX(t.idx)} y={innerH + 18}
              fill="#94a3b8" fontSize={9} textAnchor="middle">
              {t.idx}
            </text>
          ))}

          {/* Axis labels */}
          <text x={innerW / 2} y={innerH + 28} fill="#64748b" fontSize={9} textAnchor="middle">Iteration</text>
          <text transform={`rotate(-90) translate(${-innerH / 2}, -44)`} fill="#64748b" fontSize={9} textAnchor="middle">Best Fitness</text>
        </g>
      </svg>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const currentParams = getAlgorithmParams();
  const meta = algorithmMeta[algorithm];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Dna className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Metaheuristic Optimization</h1>
          <p className="text-slate-400 text-sm">Nature-inspired algorithms for complex, non-convex optimization problems</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ═══════════════════════════════ LEFT PANEL (2/5) ═══════════════════ */}
        <div className="xl:col-span-2 space-y-5">
          {/* Algorithm selector */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Algorithm</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(algorithmMeta) as AlgorithmType[]).map(alg => {
                const m = algorithmMeta[alg];
                const active = algorithm === alg;
                return (
                  <button
                    key={alg}
                    onClick={() => setAlgorithm(alg)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? colorClass[m.color] : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.icon}
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Problem type */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Problem Type</h2>
            <div className="flex flex-col gap-2">
              {(['continuous_function', 'tsp', 'knapsack'] as ProblemType[]).map(pt => (
                <button
                  key={pt}
                  onClick={() => setProblemType(pt)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                    problemType === pt
                      ? 'bg-slate-600 text-white border border-slate-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {pt.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Mathematical formulation */}
            <div className="mt-4 bg-slate-900 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-500 mb-2 font-medium">Mathematical Formulation</p>
              <pre className="text-xs text-cyan-300 font-mono whitespace-pre-wrap leading-relaxed">
                {problemFormulations[problemType]}
              </pre>
            </div>
          </div>

          {/* Algorithm parameters */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
              <Settings className="w-4 h-4 text-slate-400" /> {meta.label} Parameters
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(currentParams).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-xs text-slate-400 mb-1">{key.replace(/_/g, ' ')}</label>
                  <input
                    type="number"
                    value={val as number}
                    step={key.includes('rate') || key === 'w' || key === 'c1' || key === 'c2' || key === 'F' || key === 'CR' || key === 'cooling_rate' || key === 'min_temp' ? 0.01 : 1}
                    onChange={e => setParamValue(key, parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Dimension slider */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm uppercase tracking-wide">Dimensions</h2>
              <span className="text-cyan-400 font-bold">{dimensions}D</span>
            </div>
            <input
              type="range" min={2} max={20} step={1}
              value={dimensions}
              onChange={e => setDimensions(+e.target.value)}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1"><span>2</span><span>20</span></div>
          </div>

          {/* Execute button */}
          <div className="flex gap-3">
            <button
              onClick={handleSolve}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
            >
              {loading ? <span className="animate-spin">⏳</span> : <Play className="w-4 h-4" />}
              {loading ? 'Optimizing…' : 'Execute Metaheuristic'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════ RIGHT PANEL (3/5) ══════════════════ */}
        <div className="xl:col-span-3 space-y-5">
          {result ? (
            <>
              {/* Best solution value */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Best Objective Value</p>
                <p className="text-5xl font-black text-cyan-400 my-2">
                  {typeof result.best_fitness === 'number' ? result.best_fitness.toFixed(6) : '—'}
                </p>
                {result.converged && (
                  <div className="inline-flex items-center gap-1 text-emerald-400 text-xs mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Converged
                  </div>
                )}
              </div>

              {/* Solution vector */}
              {result.best_solution && (
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <h2 className="text-white font-semibold mb-3 text-sm">Best Solution Vector</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700">
                          {result.best_solution.map((_: any, i: number) => (
                            <th key={i} className="pb-2 text-center font-medium min-w-[60px]">x{i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {result.best_solution.map((v: number, i: number) => (
                            <td key={i} className="py-2 text-center text-cyan-300 font-mono text-xs">
                              {v.toFixed(4)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Convergence chart */}
              {result.convergence_history && result.convergence_history.length > 1 && (
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <h2 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                    <TrendingDown className="w-4 h-4 text-cyan-400" /> Convergence History
                  </h2>
                  <div className="w-full overflow-x-auto">
                    {renderConvergenceChart(result.convergence_history)}
                  </div>
                </div>
              )}

              {/* Heuristic warning */}
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 flex items-start gap-3">
                <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-amber-300 font-semibold text-sm">Heuristic Method</p>
                  <p className="text-amber-200/70 text-xs mt-1">
                    Cannot guarantee global optimality. This result is a high-quality approximate solution.
                    Re-running may yield different results depending on stochastic initialisation.
                  </p>
                </div>
              </div>

              {/* Execution info */}
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <h2 className="text-white font-semibold mb-3 text-sm">Execution Summary</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    { label: 'Algorithm', value: meta.label },
                    { label: 'Problem Dimensions', value: `${dimensions}D` },
                    { label: 'Iterations Completed', value: result.iterations_completed ?? result.generations_completed ?? '—' },
                    { label: 'Convergence Achieved', value: result.converged ? 'Yes ✓' : 'No (max iterations reached)' },
                    ...(algorithm === 'simulated_annealing'
                      ? [{ label: 'Final Temperature', value: typeof result.final_temperature === 'number' ? result.final_temperature.toFixed(4) : '—' }]
                      : []),
                    ...(algorithm === 'genetic_algorithm' || algorithm === 'differential_evolution'
                      ? [{ label: 'Final Generation', value: result.iterations_completed ?? '—' }]
                      : []),
                    { label: 'Solve Time (ms)', value: result.solve_time_ms ?? '—' },
                  ].map((row, i) => (
                    <React.Fragment key={i}>
                      <span className="text-slate-400">{row.label}</span>
                      <span className="text-slate-200 font-medium">{String(row.value)}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-800 rounded-xl p-16 border border-slate-700 flex flex-col items-center justify-center text-center gap-4 h-full min-h-[400px]">
              <Dna className="w-14 h-14 text-slate-600" />
              <div>
                <p className="text-slate-300 font-medium">Ready to Optimize</p>
                <p className="text-slate-500 text-sm mt-1">
                  Select an algorithm, configure parameters, and click <span className="text-emerald-400">Execute Metaheuristic</span>.
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg px-4 py-3 text-xs text-slate-400 font-mono text-left w-full max-w-sm">
                <p className="text-slate-500 mb-1">// Current setup</p>
                <p><span className="text-cyan-400">algorithm</span>: {meta.label}</p>
                <p><span className="text-cyan-400">problem</span>: {problemType.replace(/_/g, ' ')}</p>
                <p><span className="text-cyan-400">dimensions</span>: {dimensions}</p>
                <p><span className="text-cyan-400">bounds</span>: [-5.12, 5.12]^{dimensions}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
