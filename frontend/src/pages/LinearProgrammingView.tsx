import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { LPResult } from '../types';
import { MathView } from '../utils/katex';
import { 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Table, 
  TrendingUp, 
  Sliders,
  FileSpreadsheet,
  FileText
} from 'lucide-react';

export const LinearProgrammingView: React.FC = () => {
  const { t } = useLanguage();

  // Model state (Dantzig classic manufacturing default)
  const [sense, setSense] = useState<'maximize' | 'minimize'>('maximize');
  const [method, setMethod] = useState<string>('dual-simplex');
  
  const [variables, setVariables] = useState([
    { name: 'x1', lower_bound: 0, upper_bound: null as number | null },
    { name: 'x2', lower_bound: 0, upper_bound: null as number | null }
  ]);

  const [objCoeffs, setObjCoeffs] = useState<Record<string, number>>({
    x1: 40,
    x2: 30
  });

  const [constraints, setConstraints] = useState([
    { name: 'Machine_Hours', coefficients: { x1: 2, x2: 1 }, relation: '<=', rhs: 100 },
    { name: 'Material_Limit', coefficients: { x1: 1, x2: 3 }, relation: '<=', rhs: 90 }
  ]);

  const [result, setResult] = useState<LPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveLP({
        name: 'Production Allocation LP',
        sense,
        method,
        variables,
        objective_coefficients: objCoeffs,
        constraints
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Solver failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!result) return;
    const blob = await api.exportPDF({
      title: 'Linear Programming Solution',
      category: 'Linear Programming',
      solver_name: result.solver_name,
      status: result.status,
      objective_value: result.objective_value,
      execution_time_sec: result.execution_time_sec,
      mathematical_summary: result.mathematical_summary,
      variable_values: result.variable_values,
      reduced_costs: result.reduced_costs,
      variable_basis_status: result.variable_basis_status,
      validation_report: result.validation_report
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OptiVerse_LP_Report.pdf`;
    a.click();
  };

  const handleExportExcel = async () => {
    if (!result) return;
    const blob = await api.exportExcel({
      title: 'Linear Programming Solution',
      solver_name: result.solver_name,
      status: result.status,
      objective_value: result.objective_value,
      execution_time_sec: result.execution_time_sec,
      mathematical_summary: result.mathematical_summary,
      variable_values: result.variable_values,
      reduced_costs: result.reduced_costs,
      variable_basis_status: result.variable_basis_status
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OptiVerse_LP_Report.xlsx`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <h1 className="text-2xl font-extrabold text-white">Module A: Linear Programming (LP)</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
              HiGHS 1.16 Native Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exact Simplex, Dual Simplex, and Interior Point solvers with sensitivity ranges and 2D geometry.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
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

      {/* Model Formulation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Objective & Constraints */}
        <div className="lg:col-span-5 space-y-5">
          {/* Objective Function Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Objective Function</h3>
              <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                <button
                  onClick={() => setSense('maximize')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    sense === 'maximize' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Maximize
                </button>
                <button
                  onClick={() => setSense('minimize')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    sense === 'minimize' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Minimize
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
              <MathView math={`\\text{${sense === 'maximize' ? 'Maximize' : 'Minimize'}} \\; Z = ${objCoeffs['x1']} x_1 + ${objCoeffs['x2']} x_2`} block />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400">Coeff x1</label>
                <input
                  type="number"
                  value={objCoeffs['x1']}
                  onChange={(e) => setObjCoeffs({ ...objCoeffs, x1: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Coeff x2</label>
                <input
                  type="number"
                  value={objCoeffs['x2']}
                  onChange={(e) => setObjCoeffs({ ...objCoeffs, x2: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400">Algorithm Strategy</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
              >
                <option value="dual-simplex">HiGHS Dual Simplex (Industry Standard)</option>
                <option value="primal-simplex">HiGHS Primal Simplex</option>
                <option value="interior-point">HiGHS Interior Point Method (IPM)</option>
              </select>
            </div>
          </div>

          {/* Constraints Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Functional Constraints</h3>

            <div className="space-y-3">
              {constraints.map((con, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                    <span>{con.name}</span>
                    <MathView math={`${con.coefficients.x1}x_1 + ${con.coefficients.x2}x_2 \\le ${con.rhs}`} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="x1"
                      value={con.coefficients.x1}
                      onChange={(e) => {
                        const newC = [...constraints];
                        newC[idx].coefficients.x1 = parseFloat(e.target.value) || 0;
                        setConstraints(newC);
                      }}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono text-center"
                    />
                    <input
                      type="number"
                      placeholder="x2"
                      value={con.coefficients.x2}
                      onChange={(e) => {
                        const newC = [...constraints];
                        newC[idx].coefficients.x2 = parseFloat(e.target.value) || 0;
                        setConstraints(newC);
                      }}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono text-center"
                    />
                    <input
                      type="number"
                      placeholder="RHS"
                      value={con.rhs}
                      onChange={(e) => {
                        const newC = [...constraints];
                        newC[idx].rhs = parseFloat(e.target.value) || 0;
                        setConstraints(newC);
                      }}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono text-center"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400">
              Implicit Non-Negativity: <span className="text-cyan-400 font-mono">x1 &ge; 0, x2 &ge; 0</span>
            </div>
          </div>
        </div>

        {/* Right Output: Results & Graphical Visualizer */}
        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <>
              {/* Solution Overview Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{result.status}</span>
                  </div>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={handleExportPDF}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 rtl:space-x-reverse border border-slate-700"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 rtl:space-x-reverse border border-slate-700"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Excel</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Optimal Value Z*</div>
                    <div className="text-xl font-bold text-white mt-0.5">{result.objective_value.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Optimal (x1, x2)</div>
                    <div className="text-xl font-bold text-cyan-400 mt-0.5">
                      ({result.variable_values['x1']}, {result.variable_values['x2']})
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Execution Time</div>
                    <div className="text-xl font-bold text-slate-200 mt-0.5">{(result.execution_time_sec * 1000).toFixed(2)} ms</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Iterations</div>
                    <div className="text-xl font-bold text-slate-200 mt-0.5">{result.iterations}</div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  {result.mathematical_summary}
                </p>
              </div>

              {/* 2D Graphical Method Visualizer */}
              {result.graphical_data && result.graphical_data.is_applicable && (
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2 rtl:space-x-reverse">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span>2D Graphical Feasible Region & Optimal Vertex</span>
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      Vertices: {result.graphical_data.feasible_vertices.length}
                    </span>
                  </div>

                  {/* SVG Canvas */}
                  <div className="w-full h-64 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex items-center justify-center p-4">
                    <svg className="w-full h-full" viewBox="0 0 500 250">
                      {/* Grid Lines */}
                      <line x1="40" y1="210" x2="480" y2="210" stroke="#334155" strokeWidth="1.5" />
                      <line x1="40" y1="20" x2="40" y2="210" stroke="#334155" strokeWidth="1.5" />
                      <text x="470" y="225" fill="#64748b" fontSize="10">x1</text>
                      <text x="25" y="25" fill="#64748b" fontSize="10">x2</text>

                      {/* Feasible Polygon */}
                      {result.graphical_data.feasible_vertices.length > 2 && (
                        <polygon
                          points={result.graphical_data.feasible_vertices.map(([vx, vy]) => {
                            const scaleX = 400 / (result.graphical_data!.x_bounds[1] || 100);
                            const scaleY = 180 / (result.graphical_data!.y_bounds[1] || 100);
                            const px = 40 + vx * scaleX;
                            const py = 210 - vy * scaleY;
                            return `${px},${py}`;
                          }).join(' ')}
                          fill="rgba(59, 130, 246, 0.25)"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                      )}

                      {/* Optimal Vertex Point */}
                      {result.graphical_data.optimal_vertex && (() => {
                        const [ox, oy] = result.graphical_data.optimal_vertex;
                        const scaleX = 400 / (result.graphical_data.x_bounds[1] || 100);
                        const scaleY = 180 / (result.graphical_data.y_bounds[1] || 100);
                        const px = 40 + ox * scaleX;
                        const py = 210 - oy * scaleY;
                        return (
                          <g>
                            <circle cx={px} cy={py} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                            <text x={px + 8} y={py - 6} fill="#38bdf8" fontSize="11" fontWeight="bold">
                              Optimum ({ox}, {oy})
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              )}

              {/* Sensitivity Analysis & Shadow Prices Table */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Duality & Shadow Prices (RHS Sensitivity)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2">Constraint</th>
                        <th className="pb-2">RHS</th>
                        <th className="pb-2">Slack</th>
                        <th className="pb-2">Shadow Price</th>
                        <th className="pb-2">Allowable Increase</th>
                        <th className="pb-2">Allowable Decrease</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {result.sensitivity_rhs.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-2 font-sans font-medium text-slate-200">{s.name}</td>
                          <td className="py-2 text-slate-300">{s.current_value}</td>
                          <td className="py-2 text-slate-300">{result.slack_surplus_values[s.name]?.toFixed(2) ?? '0.00'}</td>
                          <td className="py-2 font-bold text-cyan-400">${result.shadow_prices[s.name]?.toFixed(2) ?? '0.00'}</td>
                          <td className="py-2 text-slate-400">+{s.allowable_increase?.toFixed(2) ?? 'Infinity'}</td>
                          <td className="py-2 text-slate-400">-{s.allowable_decrease?.toFixed(2) ?? 'Infinity'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <Sliders className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">No Solution Generated Yet</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Click "Execute Mathematical Solver" above to run HiGHS Simplex on the formulation and compute exact optimal vertex coordinates and sensitivity tables.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
