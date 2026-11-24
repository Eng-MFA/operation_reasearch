import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, Box, CheckCircle2, AlertTriangle, TrendingDown } from 'lucide-react';

export const InventoryOptimizationView: React.FC = () => {
  const { t } = useLanguage();
  const [modelType, setModelType] = useState<'eoq' | 'epq' | 'newsvendor' | 'abc_analysis'>('eoq');
  
  // EOQ / EPQ inputs
  const [annualDemand, setAnnualDemand] = useState(10000);
  const [orderingCost, setOrderingCost] = useState(50);
  const [holdingRate, setHoldingRate] = useState(0.20);
  const [unitCost, setUnitCost] = useState(10);
  const [serviceLevel, setServiceLevel] = useState(0.95);
  const [leadTimeDays, setLeadTimeDays] = useState(5);
  const [demandStdDev, setDemandStdDev] = useState(10);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveInventory({
        model_type: modelType,
        annual_demand: annualDemand,
        ordering_cost: orderingCost,
        holding_cost_rate: holdingRate,
        unit_cost: unitCost,
        service_level: serviceLevel,
        lead_time_days: leadTimeDays,
        daily_demand_std_dev: demandStdDev,
        abc_items: [
          { sku: "SKU-A101 (Microcontroller)", annual_demand: 12000, unit_cost: 45.0 },
          { sku: "SKU-A102 (Power IC)", annual_demand: 8000, unit_cost: 30.0 },
          { sku: "SKU-B201 (Capacitor Bank)", annual_demand: 25000, unit_cost: 2.5 },
          { sku: "SKU-B202 (Resistor Pack)", annual_demand: 50000, unit_cost: 0.8 },
          { sku: "SKU-C301 (Mounting Screw)", annual_demand: 100000, unit_cost: 0.05 },
        ]
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Inventory solver failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Module G: Inventory Optimization</h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic EOQ/EPQ, stochastic Safety Stock & Reorder Point (ROP), Newsvendor critical fractile, and ABC classification.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
          >
            <option value="eoq">Economic Order Quantity (EOQ)</option>
            <option value="epq">Economic Production Quantity (EPQ)</option>
            <option value="newsvendor">Newsvendor Single-Period</option>
            <option value="abc_analysis">ABC Pareto Classification</option>
          </select>
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : 'Calculate Optimal Policy'}</span>
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Inventory Model Parameters</h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
              <MathView math="Q^* = \sqrt{\frac{2 D S}{H}}, \quad \text{ROP} = \bar{d} \cdot L + z \cdot \sigma_L" block />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Annual Demand (D)</label>
                <input
                  type="number"
                  value={annualDemand}
                  onChange={(e) => setAnnualDemand(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Ordering Cost (S)</label>
                <input
                  type="number"
                  value={orderingCost}
                  onChange={(e) => setOrderingCost(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Unit Cost ($)</label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Holding Rate (%/yr)</label>
                <input
                  type="number"
                  step="0.05"
                  value={holdingRate}
                  onChange={(e) => setHoldingRate(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Lead Time (days)</label>
                <input
                  type="number"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Service Level (Z)</label>
                <select
                  value={serviceLevel}
                  onChange={(e) => setServiceLevel(parseFloat(e.target.value))}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-semibold"
                >
                  <option value={0.90}>90% (Z = 1.282)</option>
                  <option value={0.95}>95% (Z = 1.645)</option>
                  <option value={0.99}>99% (Z = 2.326)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Optimal Inventory Policy</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">Model: {result.model_type.toUpperCase()}</span>
              </div>

              {result.model_type !== 'abc_analysis' ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Optimal Batch Q*</div>
                      <div className="text-xl font-bold text-white mt-0.5">{result.optimal_order_quantity}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Reorder Point (ROP)</div>
                      <div className="text-xl font-bold text-cyan-400 mt-0.5">{result.reorder_point ?? 'N/A'}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Safety Stock</div>
                      <div className="text-xl font-bold text-amber-400 mt-0.5">{result.safety_stock ?? '0'}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Total Policy Cost</div>
                      <div className="text-xl font-bold text-emerald-400 mt-0.5">${(result.annual_ordering_cost + result.annual_holding_cost).toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                    <div>&bull; Orders per year: {result.orders_per_year} (Cycle interval: every {result.cycle_time_days} days)</div>
                    <div>&bull; Annual Ordering Expenditure: ${result.annual_ordering_cost}</div>
                    <div>&bull; Annual Holding Expenditure: ${result.annual_holding_cost}</div>
                  </div>
                </>
              ) : (
                /* ABC Classification Table */
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-300">ABC Pareto Analysis Table</h4>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2">SKU Item</th>
                        <th className="pb-2">Annual Value</th>
                        <th className="pb-2">Cumulative %</th>
                        <th className="pb-2">Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {result.abc_classification.map((item: any) => (
                        <tr key={item.sku}>
                          <td className="py-2 text-slate-200 font-sans">{item.sku}</td>
                          <td className="py-2 text-cyan-400">${item.annual_value.toLocaleString()}</td>
                          <td className="py-2 text-slate-300">{item.cumulative_percentage}%</td>
                          <td className="py-2 font-bold font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${item.classification === 'A' ? 'bg-rose-500/20 text-rose-300' : item.classification === 'B' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                              Class {item.classification}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {result.mathematical_summary}
              </p>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <Box className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">Run Inventory Policy Optimizer</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Compute the exact trade-off between ordering setup costs and inventory carrying costs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
