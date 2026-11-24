import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, Clock, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

export const QueuingTheoryView: React.FC = () => {
  const { t } = useLanguage();
  const [modelType, setModelType] = useState<string>('M/M/1');
  const [arrivalRate, setArrivalRate] = useState(8.0);
  const [serviceRate, setServiceRate] = useState(10.0);
  const [servers, setServers] = useState(1);
  const [capacity, setCapacity] = useState(10);
  
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveQueuing({
        model_type: modelType,
        arrival_rate: arrivalRate,
        service_rate: serviceRate,
        servers,
        system_capacity: capacity
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Queuing solve failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Module H: Queuing Theory & Waiting Line Models</h1>
          <p className="text-xs text-slate-400 mt-1">
            M/M/1, M/M/c (Erlang-C), M/M/1/K finite capacity, and M/G/1 Pollaczek-Khinchine formula with Little's Law verification.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <select
            value={modelType}
            onChange={(e) => {
              setModelType(e.target.value);
              if (e.target.value === 'M/M/c' && servers === 1) setServers(3);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
          >
            <option value="M/M/1">M/M/1 Single-Server</option>
            <option value="M/M/c">M/M/c Multi-Server (Erlang-C)</option>
            <option value="M/M/1/K">M/M/1/K Finite Capacity</option>
            <option value="M/G/1">M/G/1 General Service (Pollaczek-Khinchine)</option>
          </select>
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : 'Compute Queuing Metrics'}</span>
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
        {/* Parameters Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Queuing Parameters</h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
              <MathView math="\rho = \frac{\lambda}{c \mu} < 1, \quad L = \lambda W, \quad L_q = \lambda W_q" block />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400">Arrival Rate &lambda; (customers/hour)</label>
                <input
                  type="number"
                  value={arrivalRate}
                  onChange={(e) => setArrivalRate(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Service Rate &mu; per Server (customers/hour)</label>
                <input
                  type="number"
                  value={serviceRate}
                  onChange={(e) => setServiceRate(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>

              {modelType === 'M/M/c' && (
                <div>
                  <label className="text-[11px] text-slate-400">Number of Parallel Servers (c)</label>
                  <input
                    type="number"
                    min={1}
                    value={servers}
                    onChange={(e) => setServers(parseInt(e.target.value) || 1)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              )}

              {modelType === 'M/M/1/K' && (
                <div>
                  <label className="text-[11px] text-slate-400">Maximum System Capacity (K)</label>
                  <input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  {result.is_stable ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  )}
                  <span className={`text-xs font-bold uppercase tracking-wider ${result.is_stable ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.is_stable ? "STABLE QUEUING SYSTEM" : "OVERLOADED SYSTEM (UNSTABLE)"}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">Utilization &rho; = {(result.traffic_intensity * 100).toFixed(1)}%</span>
              </div>

              {result.is_stable && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Wait in Queue (Wq)</div>
                      <div className="text-xl font-bold text-white mt-0.5">{result.average_wait_in_queue_wq.toFixed(3)} h</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Total Time (W)</div>
                      <div className="text-xl font-bold text-cyan-400 mt-0.5">{result.average_time_in_system_w.toFixed(3)} h</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Avg in Queue (Lq)</div>
                      <div className="text-xl font-bold text-amber-400 mt-0.5">{result.average_number_in_queue_lq.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Avg in System (L)</div>
                      <div className="text-xl font-bold text-emerald-400 mt-0.5">{result.average_number_in_system_l.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* State Probabilities */}
                  {result.state_probabilities.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold uppercase text-slate-300">State Probability Distribution P(n)</h4>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {result.state_probabilities.slice(0, 6).map((st: any) => (
                          <div key={st.state_n} className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                            <div className="text-[10px] text-slate-400">n = {st.state_n}</div>
                            <div className="text-xs font-bold text-cyan-300">{(st.probability * 100).toFixed(1)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {result.mathematical_summary}
              </p>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <Clock className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">Run Queuing Model</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Evaluate server utilization, queue length, and verify Little's Law.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
