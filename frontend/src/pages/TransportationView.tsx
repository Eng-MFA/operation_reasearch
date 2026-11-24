import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, Truck, Users, CheckCircle2, AlertTriangle } from 'lucide-react';

export const TransportationView: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'transport' | 'assignment'>('transport');
  const [initMethod, setInitMethod] = useState<'vam' | 'least_cost' | 'north_west'>('vam');
  
  // Canonical Hitchcock 3x4 Problem
  const [supply, setSupply] = useState([250, 130, 235]);
  const [demand, setDemand] = useState([125, 65, 225, 200]);
  const [costs, setCosts] = useState([
    [10, 2, 20, 11],
    [12, 7, 9, 20],
    [4, 14, 16, 18]
  ]);

  // Assignment Hungarian
  const [assignCosts, setAssignCosts] = useState([
    [10, 5, 8],
    [4, 8, 3],
    [6, 7, 9]
  ]);

  const [tResult, setTResult] = useState<any>(null);
  const [aResult, setAResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolveTransport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveTransportation({
        sources: ["Factory 1", "Factory 2", "Factory 3"],
        destinations: ["Warehouse A", "Warehouse B", "Warehouse C", "Warehouse D"],
        supply,
        demand,
        costs,
        initial_method: initMethod
      });
      setTResult(res);
    } catch (e: any) {
      setError(e.message || "Transportation solve failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSolveAssignment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveAssignment({
        agents: ["Worker 1", "Worker 2", "Worker 3"],
        tasks: ["Task A", "Task B", "Task C"],
        cost_matrix: assignCosts,
        sense: "minimize"
      });
      setAResult(res);
    } catch (e: any) {
      setError(e.message || "Assignment solve failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Module F: Transportation & Assignment</h1>
          <p className="text-xs text-slate-400 mt-1">
            Vogel's Approximation (VAM), MODI u-v multipliers, stepping stone cycles, and Hungarian algorithm.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            <button
              onClick={() => setTab('transport')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                tab === 'transport' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              Transportation Problem
            </button>
            <button
              onClick={() => setTab('assignment')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                tab === 'assignment' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              Hungarian Assignment
            </button>
          </div>
          <button
            onClick={tab === 'transport' ? handleSolveTransport : handleSolveAssignment}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : 'Solve Problem'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 rtl:space-x-reverse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tab === 'transport' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Transportation Cost Matrix & Supply/Demand</h3>
                <select
                  value={initMethod}
                  onChange={(e) => setInitMethod(e.target.value as any)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="vam">Vogel's Approximation (VAM)</option>
                  <option value="least_cost">Least Cost Method</option>
                  <option value="north_west">North-West Corner</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2">Source</th>
                      <th className="py-2">Whse A</th>
                      <th className="py-2">Whse B</th>
                      <th className="py-2">Whse C</th>
                      <th className="py-2">Whse D</th>
                      <th className="py-2 text-cyan-400">Supply</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {costs.map((row, i) => (
                      <tr key={i}>
                        <td className="py-2 text-slate-300 font-sans font-bold">Factory {i+1}</td>
                        {row.map((c, j) => (
                          <td key={j} className="py-2 text-slate-200">${c}</td>
                        ))}
                        <td className="py-2 text-cyan-400 font-bold">{supply[i]}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-700">
                      <td className="py-2 text-amber-400 font-sans font-bold">Demand</td>
                      {demand.map((d, j) => (
                        <td key={j} className="py-2 text-amber-400 font-bold">{d}</td>
                      ))}
                      <td className="py-2 text-white font-bold">{supply.reduce((a,b)=>a+b,0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            {tResult ? (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{tResult.status}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">MODI Simplex Method</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Initial Feasible Cost</div>
                    <div className="text-lg font-bold text-slate-300 mt-0.5">${tResult.initial_cost}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Optimal Cost (MODI)</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-0.5">${tResult.optimal_cost}</div>
                  </div>
                </div>

                {/* Allocation Matrix Table */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-300">Optimal Allocation Matrix (Units Shipped)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-1.5">Source</th>
                          <th className="py-1.5">Whse A</th>
                          <th className="py-1.5">Whse B</th>
                          <th className="py-1.5">Whse C</th>
                          <th className="py-1.5">Whse D</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {tResult.optimal_allocation_matrix.map((row: number[], i: number) => (
                          <tr key={i}>
                            <td className="py-1.5 font-bold text-slate-400">Factory {i+1}</td>
                            {row.map((qty, j) => (
                              <td key={j} className={`py-1.5 ${qty > 0 ? 'text-cyan-400 font-bold bg-cyan-500/10' : 'text-slate-600'}`}>
                                {qty}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  {tResult.mathematical_summary}
                </p>
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                <Truck className="w-10 h-10 text-slate-600" />
                <div className="text-sm font-semibold text-slate-300">Run Transportation Solver</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click 'Solve Problem' to compute VAM initial allocation and MODI u-v optimal solution.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Hungarian Assignment Tab */
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Hungarian Assignment Algorithm (O(N³) Minimal Bipartite Matching)
            </h3>
            <span className="text-xs text-cyan-400 font-mono font-semibold">linear_sum_assignment</span>
          </div>

          {aResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {aResult.assignments.map((as: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{as.agent}</div>
                    <div className="text-xs text-cyan-400 mt-0.5">&rarr; {as.task}</div>
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-400">${as.cost}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
