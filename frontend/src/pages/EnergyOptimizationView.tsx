import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, Zap, BatteryCharging, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

export const EnergyOptimizationView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'economic_dispatch' | 'microgrid'>('economic_dispatch');
  const [demandMW, setDemandMW] = useState(850);
  const [includeLosses, setIncludeLosses] = useState(false);
  const [loading, setLoading] = useState(false);
  const [edResult, setEdResult] = useState<any>(null);
  const [microgridResult, setMicrogridResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Canonical Wood & Wollenberg 3-generator thermal fleet
  const [generators, setGenerators] = useState([
    { id: 'G1', name: 'Coal Steam Unit 1', p_min_mw: 100, p_max_mw: 600, cost_a: 0.001562, cost_b: 7.92, cost_c: 561 },
    { id: 'G2', name: 'Oil Steam Unit 2', p_min_mw: 100, p_max_mw: 400, cost_a: 0.001940, cost_b: 7.85, cost_c: 310 },
    { id: 'G3', name: 'Gas Turbine Peaker', p_min_mw: 50, p_max_mw: 200, cost_a: 0.004820, cost_b: 7.97, cost_c: 78 },
  ]);

  const handleSolveED = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveEconomicDispatch({
        demand_mw: demandMW,
        generators,
        include_transmission_losses: includeLosses,
        b_loss_matrix: [
          [0.00003, 0.00001, 0.00001],
          [0.00001, 0.00004, 0.00001],
          [0.00001, 0.00001, 0.00005]
        ]
      });
      setEdResult(res);
    } catch (err: any) {
      setError(err.message || 'Economic Dispatch failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSolveMicrogrid = async () => {
    setLoading(true);
    setError(null);
    try {
      // 24-hr load curve with solar PV and wind profiles
      const loadProfile = [12, 11, 10, 10, 12, 15, 18, 22, 25, 26, 24, 23, 22, 21, 22, 24, 28, 30, 29, 25, 22, 18, 15, 13];
      const solarProfile = [0, 0, 0, 0, 0, 1, 4, 8, 14, 18, 20, 20, 18, 15, 10, 5, 1, 0, 0, 0, 0, 0, 0, 0];
      const windProfile = [5, 6, 7, 6, 5, 4, 3, 3, 4, 5, 6, 7, 8, 7, 6, 5, 6, 7, 8, 8, 7, 6, 5, 5];
      // Time-of-Use tariffs: high peak between 17-21
      const buyPrice = [40, 40, 40, 40, 50, 60, 70, 80, 85, 90, 85, 80, 75, 75, 80, 95, 130, 150, 145, 120, 90, 70, 50, 40];
      const sellPrice = buyPrice.map(p => p * 0.6);

      const res = await api.solveMicrogrid({
        hours: 24,
        load_profile_mw: loadProfile,
        solar_pv_profile_mw: solarProfile,
        wind_profile_mw: windProfile,
        grid_buy_price_per_mwh: buyPrice,
        grid_sell_price_per_mwh: sellPrice,
        generators: [
          { id: 'DG1', name: 'Microturbine Backup', p_min_mw: 0, p_max_mw: 10, cost_a: 0.005, cost_b: 65, cost_c: 50 }
        ],
        battery: {
          capacity_mwh: 30.0,
          max_charge_power_mw: 8.0,
          max_discharge_power_mw: 8.0,
          charge_efficiency: 0.94,
          discharge_efficiency: 0.94,
          initial_soc_mwh: 12.0,
          min_soc_pct: 0.15,
          max_soc_pct: 0.95
        }
      });
      setMicrogridResult(res);
    } catch (err: any) {
      setError(err.message || 'Microgrid Optimization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <h1 className="text-2xl font-extrabold text-white">Electrical Engineering & Energy Optimization</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
              Power Systems Suite
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Economic Dispatch with transmission losses (B-matrix), generator operating limits, and 24-hour battery microgrid scheduling.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            <button
              onClick={() => setActiveTab('economic_dispatch')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                activeTab === 'economic_dispatch' ? 'bg-amber-600 text-white' : 'text-slate-400'
              }`}
            >
              Economic Dispatch
            </button>
            <button
              onClick={() => setActiveTab('microgrid')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                activeTab === 'microgrid' ? 'bg-amber-600 text-white' : 'text-slate-400'
              }`}
            >
              Microgrid Battery Storage
            </button>
          </div>
          <button
            onClick={activeTab === 'economic_dispatch' ? handleSolveED : handleSolveMicrogrid}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-lg shadow-amber-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : 'Optimize Power Flow'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 rtl:space-x-reverse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'economic_dispatch' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Dispatch Parameters */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Active Power Demand & Grid Model</h3>
              
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <MathView math="\min \sum (a_i P_i^2 + b_i P_i + c_i) \quad \text{s.t.} \quad \sum P_i = P_D + P_L, \; P_{i}^{\min} \le P_i \le P_{i}^{\max}" block />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400">Total System Active Load Demand (MW)</label>
                <input
                  type="number"
                  value={demandMW}
                  onChange={(e) => setDemandMW(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold"
                />
              </div>

              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <input
                  type="checkbox"
                  id="lossCheck"
                  checked={includeLosses}
                  onChange={(e) => setIncludeLosses(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                />
                <label htmlFor="lossCheck" className="text-xs text-slate-300">
                  Include Kron's B-Matrix Transmission Losses (<MathView math="P_L = \sum_i \sum_j P_i B_{ij} P_j" />)
                </label>
              </div>
            </div>

            {/* Generator Fleet Specs */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Thermal Generation Fleet</h3>
              <div className="space-y-3">
                {generators.map((g, idx) => (
                  <div key={g.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                      <span>{g.name}</span>
                      <span className="text-slate-400 font-mono">[{g.p_min_mw}, {g.p_max_mw}] MW</span>
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400">
                      C(P) = {g.cost_a} P² + {g.cost_b} P + {g.cost_c}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Solution Setpoints & Physical Verification */}
          <div className="lg:col-span-7 space-y-4">
            {edResult ? (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      {edResult.is_physically_feasible ? "PHYSICALLY FEASIBLE & OPTIMAL" : "FEASIBILITY VIOLATION"}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">
                    System &lambda;: ${edResult.system_lambda_incremental_cost}/MWh
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Total Generation</div>
                    <div className="text-xl font-bold text-white mt-0.5">{edResult.total_generation_mw} MW</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Transmission Loss</div>
                    <div className="text-xl font-bold text-amber-400 mt-0.5">{edResult.transmission_loss_mw} MW</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Total Fuel Cost</div>
                    <div className="text-xl font-bold text-emerald-400 mt-0.5">${edResult.total_fuel_cost_per_hour}/h</div>
                  </div>
                </div>

                {/* Generator Allocation Table */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-300">Optimal Generator Dispatch Setpoints</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-2">Generator</th>
                          <th className="pb-2">Dispatch (MW)</th>
                          <th className="pb-2">Marginal &lambda;</th>
                          <th className="pb-2">Operating Cost</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {edResult.generator_setpoints.map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-800/30">
                            <td className="py-2 font-sans font-medium text-slate-200">{s.name}</td>
                            <td className="py-2 text-cyan-300 font-bold">{s.generation_mw} MW</td>
                            <td className="py-2 text-slate-300">${s.generator_lambda}</td>
                            <td className="py-2 text-slate-300">${s.fuel_cost_per_hour}/h</td>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${s.is_at_limit ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                {s.is_at_limit ? 'AT LIMIT' : 'OPTIMAL'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-white">Physical Validation Logs:</div>
                  {edResult.physical_checks.map((c: string, i: number) => (
                    <div key={i} className="text-slate-400 font-mono text-[11px]">&bull; {c}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                <Zap className="w-10 h-10 text-slate-600" />
                <div className="text-sm font-semibold text-slate-300">Run Power Dispatch</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click 'Optimize Power Flow' to calculate exact economic dispatch setpoints satisfying active power balance.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Microgrid 24-hr Battery Tab */
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">24-Hour Battery Storage Arbitrage & Microgrid Schedule</h3>
              <p className="text-xs text-slate-400">Optimizing battery charge/discharge cycles under dynamic Time-of-Use tariffs</p>
            </div>
            <button
              onClick={handleSolveMicrogrid}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md"
            >
              {loading ? "Optimizing Schedule..." : "Run 24h Microgrid Dispatch"}
            </button>
          </div>

          {microgridResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Total Daily Operating Cost</div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">${microgridResult.total_cost}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Grid Import Cost</div>
                  <div className="text-xl font-bold text-white mt-0.5">${microgridResult.grid_import_cost}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Backup Generation Cost</div>
                  <div className="text-xl font-bold text-white mt-0.5">${microgridResult.generator_cost}</div>
                </div>
              </div>

              {/* 24-hr Schedule Table */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-300">24-Hour Power Flow & State-of-Charge Table</h4>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-2 px-2">Hour</th>
                        <th className="py-2 px-2">Load (MW)</th>
                        <th className="py-2 px-2">Solar PV</th>
                        <th className="py-2 px-2">Wind</th>
                        <th className="py-2 px-2">Charge</th>
                        <th className="py-2 px-2">Discharge</th>
                        <th className="py-2 px-2 text-cyan-400">Battery SoC</th>
                        <th className="py-2 px-2">Grid Import</th>
                        <th className="py-2 px-2">Tariff ($/MWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {microgridResult.hourly_schedule.map((h: any) => (
                        <tr key={h.hour} className="hover:bg-slate-800/40">
                          <td className="py-1.5 px-2 font-bold text-white">{h.hour}:00</td>
                          <td className="py-1.5 px-2 text-slate-300">{h.load_mw}</td>
                          <td className="py-1.5 px-2 text-amber-300">{h.solar_mw}</td>
                          <td className="py-1.5 px-2 text-sky-300">{h.wind_mw}</td>
                          <td className="py-1.5 px-2 text-rose-300">{h.battery_charge_mw}</td>
                          <td className="py-1.5 px-2 text-emerald-300">{h.battery_discharge_mw}</td>
                          <td className="py-1.5 px-2 font-bold text-cyan-400">{h.battery_soc_mwh} MWh</td>
                          <td className="py-1.5 px-2 text-slate-300">{h.grid_import_mw}</td>
                          <td className="py-1.5 px-2 text-slate-400">${h.electricity_tariff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              Click 'Run 24h Microgrid Dispatch' above to solve multi-period battery scheduling using HiGHS.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
