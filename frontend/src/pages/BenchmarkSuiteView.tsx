import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { BenchmarkSuiteResponse } from '../types';
import { ShieldCheck, Play, CheckCircle2, XCircle, Clock, BookOpen, AlertCircle } from 'lucide-react';

export const BenchmarkSuiteView: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<BenchmarkSuiteResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runAllBenchmarks = async () => {
    setLoading(true);
    try {
      const res = await api.runBenchmarks();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAllBenchmarks();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-extrabold text-white">Scientific Benchmark & Verification Suite</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time validation against canonical published benchmark problems comparing solver output to analytical exact solutions.
          </p>
        </div>

        <button
          onClick={runAllBenchmarks}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 flex items-center space-x-2 rtl:space-x-reverse transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{loading ? "Executing Solvers Against Benchmarks..." : "Re-Run All Benchmark Tests"}</span>
        </button>
      </div>

      {data && (
        <div className="space-y-6">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Total Benchmark Tests</div>
              <div className="text-2xl font-bold text-white">{data.total_tests}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-emerald-400 font-semibold">Passed Benchmarks</div>
              <div className="text-2xl font-bold text-emerald-400">{data.passed_tests}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-rose-400 font-semibold">Failed Benchmarks</div>
              <div className="text-2xl font-bold text-rose-400">{data.failed_tests}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Total Run Execution Time</div>
              <div className="text-2xl font-bold text-cyan-400">{data.execution_time_sec}s</div>
            </div>
          </div>

          {/* Benchmark Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Verification Ledger (Analytically Validated Reference Problems)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3">ID & Benchmark Name</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Published Reference Source</th>
                    <th className="pb-3 font-mono text-center">Expected Z*</th>
                    <th className="pb-3 font-mono text-center">Solver Calculated</th>
                    <th className="pb-3 font-mono text-center">Absolute Error</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {data.benchmarks.map((bm) => (
                    <tr key={bm.id} className="hover:bg-slate-800/30">
                      <td className="py-3 font-sans font-medium text-slate-200">
                        <div>{bm.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{bm.id}</div>
                      </td>
                      <td className="py-3 font-sans text-slate-300">{bm.category}</td>
                      <td className="py-3 font-sans text-slate-400 max-w-xs truncate" title={bm.reference_source}>
                        {bm.reference_source}
                      </td>
                      <td className="py-3 text-center text-slate-300 font-bold">{bm.analytical_expected_value.toFixed(4)}</td>
                      <td className="py-3 text-center text-cyan-300 font-bold">{bm.solver_calculated_value.toFixed(4)}</td>
                      <td className="py-3 text-center text-slate-400">{bm.absolute_error.toExponential(2)}</td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex items-center space-x-1 rtl:space-x-reverse px-2.5 py-1 rounded-full text-[10px] font-sans font-bold ${
                          bm.status === 'PASSED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {bm.status === 'PASSED' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{bm.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
