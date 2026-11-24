import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, Layers, AlertTriangle, CheckCircle2, Cpu } from 'lucide-react';

export const MILPView: React.FC = () => {
  const { t } = useLanguage();
  const [engine, setEngine] = useState<'highs' | 'cpsat'>('highs');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 0-1 Knapsack problem default
  const [capacity, setCapacity] = useState(50);
  const [items, setItems] = useState([
    { name: 'Item 1', weight: 10, value: 60, type: 'binary' },
    { name: 'Item 2', weight: 20, value: 100, type: 'binary' },
    { name: 'Item 3', weight: 30, value: 120, type: 'binary' },
  ]);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const vars = items.map((it, idx) => ({
        name: `x${idx + 1}`,
        variable_type: it.type,
        lower_bound: 0,
        upper_bound: 1
      }));

      const objCoeffs: Record<string, number> = {};
      items.forEach((it, idx) => {
        objCoeffs[`x${idx + 1}`] = it.value;
      });

      const capCoeffs: Record<string, number> = {};
      items.forEach((it, idx) => {
        capCoeffs[`x${idx + 1}`] = it.weight;
      });

      const res = await api.solveMILP({
        name: '0-1 Knapsack MILP Benchmark',
        sense: 'maximize',
        engine,
        variables: vars,
        objective_coefficients: objCoeffs,
        constraints: [
          { name: 'Knapsack_Capacity', coefficients: capCoeffs, relation: '<=', rhs: capacity }
        ]
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'MILP Solver Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Module B: Mixed-Integer Programming (MILP)</h1>
          <p className="text-xs text-slate-400 mt-1">
            Exact Branch-and-Cut with HiGHS & Constraint Integer Programming with Google OR-Tools CP-SAT.
          </p>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
          >
            <option value="highs">HiGHS 1.16 Branch-and-Cut</option>
            <option value="cpsat">Google OR-Tools CP-SAT</option>
          </select>
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : t('solve')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 rtl:space-x-reverse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Knapsack Formulation Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">0-1 Knapsack Benchmark</h3>
            
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
              <MathView math="\text{Max} \; Z = \sum v_i x_i \quad \text{s.t.} \quad \sum w_i x_i \le W, \; x_i \in \{0, 1\}" block />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400">Total Weight Capacity (W)</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-400">Items Catalog</div>
              {items.map((it, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-200">{it.name} (x{idx+1})</div>
                  <div className="flex items-center space-x-3 rtl:space-x-reverse text-xs">
                    <span className="text-emerald-400 font-mono">${it.value}</span>
                    <span className="text-slate-400 font-mono">{it.weight} kg</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold">
                      {it.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{result.status}</span>
                </div>
                <span className="text-xs font-mono text-slate-400">{result.solver_name}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Optimal Value Z*</div>
                  <div className="text-xl font-bold text-white mt-0.5">${result.objective_value}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Nodes Explored</div>
                  <div className="text-xl font-bold text-cyan-400 mt-0.5">{result.nodes_explored}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">MIP Gap</div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">{result.optimality_gap * 100}%</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase text-slate-300">Binary Selection Decisions</h4>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(result.variable_values).map(([v, val]: any) => (
                    <div key={v} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-300">{v}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${val > 0.5 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                        {val > 0.5 ? 'SELECTED (1)' : 'EXCLUDED (0)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                {result.mathematical_summary}
              </p>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">Run Integer Solver</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Click Solve to evaluate Branch-and-Cut tree search and prove 0-1 optimality.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
