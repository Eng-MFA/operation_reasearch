import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { Play, RotateCcw, Table2, GitBranch, Package } from 'lucide-react';

interface KnapsackItem {
  name: string;
  weight: number;
  value: number;
}

interface AllocationOption {
  resources: number;
  profit: number;
}

interface Project {
  name: string;
  allocations: AllocationOption[];
}

interface KnapsackResult {
  optimal_value: number;
  selected_items: string[];
  dp_table: number[][];
  valid?: boolean;
}

interface ResourceResult {
  optimal_allocation: { project: string; resources: number; profit: number }[];
  total_profit: number;
}

interface InventoryResult {
  order_schedule: {
    period: number;
    demand: number;
    order_quantity: number;
    inventory_level: number;
    cost: number;
  }[];
  total_cost: number;
}

type ActiveTab = 'knapsack' | 'resource' | 'inventory';

export const DynamicProgrammingView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>('knapsack');

  // --- Knapsack State ---
  const [capacity, setCapacity] = useState(10);
  const [items, setItems] = useState<KnapsackItem[]>([
    { name: 'Item-1', weight: 2, value: 6 },
    { name: 'Item-2', weight: 2, value: 10 },
    { name: 'Item-3', weight: 3, value: 12 },
    { name: 'Item-4', weight: 4, value: 15 },
  ]);
  const [knapsackResult, setKnapsackResult] = useState<KnapsackResult | null>(null);
  const [knapsackLoading, setKnapsackLoading] = useState(false);
  const [knapsackError, setKnapsackError] = useState<string | null>(null);

  // --- Resource Allocation State ---
  const [totalResources, setTotalResources] = useState(5);
  const [projects, setProjects] = useState<Project[]>([
    {
      name: 'Project A',
      allocations: [
        { resources: 0, profit: 0 },
        { resources: 1, profit: 5 },
        { resources: 2, profit: 15 },
        { resources: 3, profit: 25 },
        { resources: 4, profit: 30 },
        { resources: 5, profit: 35 },
      ],
    },
    {
      name: 'Project B',
      allocations: [
        { resources: 0, profit: 0 },
        { resources: 1, profit: 8 },
        { resources: 2, profit: 18 },
        { resources: 3, profit: 22 },
        { resources: 4, profit: 28 },
        { resources: 5, profit: 32 },
      ],
    },
    {
      name: 'Project C',
      allocations: [
        { resources: 0, profit: 0 },
        { resources: 1, profit: 6 },
        { resources: 2, profit: 12 },
        { resources: 3, profit: 20 },
        { resources: 4, profit: 27 },
        { resources: 5, profit: 33 },
      ],
    },
  ]);
  const [resourceResult, setResourceResult] = useState<ResourceResult | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);

  // --- Inventory DP State ---
  const [periods, setPeriods] = useState(4);
  const [demandsStr, setDemandsStr] = useState('3,4,2,5');
  const [setupCost, setSetupCost] = useState(50);
  const [holdingCost, setHoldingCost] = useState(2);
  const [inventoryResult, setInventoryResult] = useState<InventoryResult | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // ---- Handlers ----

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { name: `Item-${prev.length + 1}`, weight: 1, value: 1 },
    ]);
  };

  const updateItem = (index: number, field: keyof KnapsackItem, value: string | number) => {
    setItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const solveKnapsack = async () => {
    setKnapsackLoading(true);
    setKnapsackError(null);
    setKnapsackResult(null);
    try {
      const result = await api.solveDP({ problem_type: 'knapsack', capacity, items });
      setKnapsackResult(result);
    } catch (err: any) {
      setKnapsackError(err?.message ?? 'An error occurred while solving Knapsack DP.');
    } finally {
      setKnapsackLoading(false);
    }
  };

  const resetKnapsack = () => {
    setCapacity(10);
    setItems([
      { name: 'Item-1', weight: 2, value: 6 },
      { name: 'Item-2', weight: 2, value: 10 },
      { name: 'Item-3', weight: 3, value: 12 },
      { name: 'Item-4', weight: 4, value: 15 },
    ]);
    setKnapsackResult(null);
    setKnapsackError(null);
  };

  const solveResource = async () => {
    setResourceLoading(true);
    setResourceError(null);
    setResourceResult(null);
    try {
      const result = await api.solveDP({
        problem_type: 'resource_allocation',
        total_resources: totalResources,
        projects,
      });
      setResourceResult(result);
    } catch (err: any) {
      setResourceError(err?.message ?? 'An error occurred while solving Resource Allocation.');
    } finally {
      setResourceLoading(false);
    }
  };

  const resetResource = () => {
    setTotalResources(5);
    setResourceResult(null);
    setResourceError(null);
  };

  const solveInventory = async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    setInventoryResult(null);
    try {
      const demands = demandsStr
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));
      const result = await api.solveDP({
        problem_type: 'inventory',
        periods,
        demands,
        setup_cost: setupCost,
        holding_cost: holdingCost,
      });
      setInventoryResult(result);
    } catch (err: any) {
      setInventoryError(err?.message ?? 'An error occurred while solving Inventory DP.');
    } finally {
      setInventoryLoading(false);
    }
  };

  const resetInventory = () => {
    setPeriods(4);
    setDemandsStr('3,4,2,5');
    setSetupCost(50);
    setHoldingCost(2);
    setInventoryResult(null);
    setInventoryError(null);
  };

  // ---- Sub-components ----

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'knapsack', label: 'Knapsack DP', icon: <Package className="w-4 h-4" /> },
    { id: 'resource', label: 'Resource Allocation', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory DP', icon: <Table2 className="w-4 h-4" /> },
  ];

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-cyan-500 transition-colors';

  const labelClass = 'block text-xs font-medium text-slate-400 mb-1';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          <span className="text-cyan-400">Dynamic</span> Programming
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Solve sequential optimization problems with tabulation and memoization.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== KNAPSACK TAB ===== */}
      {activeTab === 'knapsack' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Input Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" /> Configuration
            </h2>

            {/* Capacity */}
            <div>
              <label className={labelClass}>Knapsack Capacity</label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}>Items</label>
                <button
                  onClick={addItem}
                  className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-700 rounded-lg px-3 py-1 transition-colors"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => updateItem(i, 'name', e.target.value)}
                      placeholder="Name"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.weight}
                      onChange={e => updateItem(i, 'weight', Number(e.target.value))}
                      placeholder="Wt"
                      className={inputClass}
                      title="Weight"
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.value}
                      onChange={e => updateItem(i, 'value', Number(e.target.value))}
                      placeholder="Val"
                      className={inputClass}
                      title="Value"
                    />
                    <button
                      onClick={() => removeItem(i)}
                      className="text-rose-500 hover:text-rose-400 text-lg leading-none font-bold"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 mt-1 px-1">
                <span className="text-xs text-slate-500">Name</span>
                <span className="text-xs text-slate-500 text-center">Weight</span>
                <span className="text-xs text-slate-500 text-center">Value</span>
                <span />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={solveKnapsack}
                disabled={knapsackLoading || items.length === 0}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-xl transition-colors"
              >
                {knapsackLoading ? (
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Solve
              </button>
              <button
                onClick={resetKnapsack}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>

            {knapsackError && (
              <div className="bg-rose-900/30 border border-rose-700 text-rose-300 rounded-xl px-4 py-3 text-sm">
                {knapsackError}
              </div>
            )}
          </div>

          {/* Results Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Table2 className="w-5 h-5 text-cyan-400" /> Results
            </h2>

            {!knapsackResult && !knapsackLoading && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-600">
                <Table2 className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Run the solver to see DP table and results.</p>
              </div>
            )}

            {knapsackLoading && (
              <div className="flex items-center justify-center h-48">
                <span className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {knapsackResult && (
              <div className="space-y-5">
                {/* Summary */}
                <div className="flex items-center gap-4">
                  <div className="bg-slate-800 rounded-xl px-5 py-3 text-center flex-1">
                    <div className="text-2xl font-bold text-cyan-400">
                      {knapsackResult.optimal_value}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Optimal Value</div>
                  </div>
                  <div className="bg-slate-800 rounded-xl px-5 py-3 text-center flex-1">
                    <div className="text-2xl font-bold text-emerald-400">
                      {knapsackResult.selected_items?.length ?? 0}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Items Selected</div>
                  </div>
                  {knapsackResult.valid !== false && (
                    <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium bg-emerald-900/30 border border-emerald-700 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Valid
                    </div>
                  )}
                </div>

                {/* Selected Items */}
                {knapsackResult.selected_items && knapsackResult.selected_items.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2 font-medium">Selected Items</p>
                    <div className="flex flex-wrap gap-2">
                      {knapsackResult.selected_items.map((item, i) => (
                        <span
                          key={i}
                          className="bg-cyan-900/40 border border-cyan-700 text-cyan-300 text-xs px-3 py-1 rounded-full"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* DP Table */}
                {knapsackResult.dp_table && knapsackResult.dp_table.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2 font-medium">DP Table</p>
                    <div className="overflow-auto max-h-64 rounded-xl border border-slate-700">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="bg-slate-800 sticky top-0">
                            <th className="px-2 py-1.5 text-slate-400 font-medium text-left">
                              Item \ Cap
                            </th>
                            {knapsackResult.dp_table[0].map((_, ci) => (
                              <th
                                key={ci}
                                className="px-2 py-1.5 text-slate-400 font-medium text-center"
                              >
                                {ci}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {knapsackResult.dp_table.map((row, ri) => (
                            <tr
                              key={ri}
                              className={ri % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}
                            >
                              <td className="px-2 py-1 text-slate-400 font-medium text-left">
                                {ri}
                              </td>
                              {row.map((cell, ci) => (
                                <td
                                  key={ci}
                                  className={`px-2 py-1 text-center ${
                                    cell > 0 ? 'text-cyan-300' : 'text-slate-500'
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== RESOURCE ALLOCATION TAB ===== */}
      {activeTab === 'resource' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Input Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-cyan-400" /> Configuration
            </h2>

            <div>
              <label className={labelClass}>Total Resources</label>
              <input
                type="number"
                min={1}
                value={totalResources}
                onChange={e => setTotalResources(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {projects.map((proj, pi) => (
                <div key={pi} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={proj.name}
                      onChange={e =>
                        setProjects(prev =>
                          prev.map((p, i) =>
                            i === pi ? { ...p, name: e.target.value } : p
                          )
                        )
                      }
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 w-40"
                    />
                    <span className="text-xs text-slate-500">
                      {proj.allocations.length} options
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {proj.allocations.map((alloc, ai) => (
                      <div key={ai} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 w-14">r={alloc.resources}:</span>
                        <input
                          type="number"
                          value={alloc.profit}
                          onChange={e =>
                            setProjects(prev =>
                              prev.map((p, i) =>
                                i === pi
                                  ? {
                                      ...p,
                                      allocations: p.allocations.map((a, j) =>
                                        j === ai
                                          ? { ...a, profit: Number(e.target.value) }
                                          : a
                                      ),
                                    }
                                  : p
                              )
                            )
                          }
                          className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-slate-200 w-16 focus:outline-none focus:border-cyan-500"
                        />
                        <span className="text-slate-500">profit</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={solveResource}
                disabled={resourceLoading}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-xl transition-colors"
              >
                {resourceLoading ? (
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Solve
              </button>
              <button
                onClick={resetResource}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>

            {resourceError && (
              <div className="bg-rose-900/30 border border-rose-700 text-rose-300 rounded-xl px-4 py-3 text-sm">
                {resourceError}
              </div>
            )}
          </div>

          {/* Results Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Table2 className="w-5 h-5 text-cyan-400" /> Results
            </h2>

            {!resourceResult && !resourceLoading && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-600">
                <GitBranch className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Run the solver to see optimal allocation.</p>
              </div>
            )}

            {resourceLoading && (
              <div className="flex items-center justify-center h-48">
                <span className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {resourceResult && (
              <div className="space-y-5">
                <div className="bg-slate-800 rounded-xl px-5 py-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">
                    {resourceResult.total_profit}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Total Optimal Profit</div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800">
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">Project</th>
                        <th className="px-4 py-2 text-center text-slate-400 font-medium">
                          Resources
                        </th>
                        <th className="px-4 py-2 text-right text-slate-400 font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resourceResult.optimal_allocation.map((row, i) => (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}
                        >
                          <td className="px-4 py-2 text-slate-200">{row.project}</td>
                          <td className="px-4 py-2 text-center text-cyan-400">{row.resources}</td>
                          <td className="px-4 py-2 text-right text-emerald-400 font-medium">
                            {row.profit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== INVENTORY DP TAB ===== */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Input Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Table2 className="w-5 h-5 text-cyan-400" /> Configuration
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Periods</label>
                <input
                  type="number"
                  min={1}
                  value={periods}
                  onChange={e => setPeriods(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Setup Cost</label>
                <input
                  type="number"
                  min={0}
                  value={setupCost}
                  onChange={e => setSetupCost(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Holding Cost per Unit</label>
              <input
                type="number"
                min={0}
                value={holdingCost}
                onChange={e => setHoldingCost(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Demands (comma-separated)</label>
              <input
                type="text"
                value={demandsStr}
                onChange={e => setDemandsStr(e.target.value)}
                placeholder="e.g. 3,4,2,5"
                className={inputClass}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={solveInventory}
                disabled={inventoryLoading}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-xl transition-colors"
              >
                {inventoryLoading ? (
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Solve
              </button>
              <button
                onClick={resetInventory}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>

            {inventoryError && (
              <div className="bg-rose-900/30 border border-rose-700 text-rose-300 rounded-xl px-4 py-3 text-sm">
                {inventoryError}
              </div>
            )}
          </div>

          {/* Results Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Table2 className="w-5 h-5 text-cyan-400" /> Order Schedule
            </h2>

            {!inventoryResult && !inventoryLoading && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-600">
                <Table2 className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Run the solver to see the order schedule.</p>
              </div>
            )}

            {inventoryLoading && (
              <div className="flex items-center justify-center h-48">
                <span className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {inventoryResult && (
              <div className="space-y-5">
                <div className="bg-slate-800 rounded-xl px-5 py-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">
                    {inventoryResult.total_cost}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Total Cost</div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800">
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">Period</th>
                        <th className="px-3 py-2 text-center text-slate-400 font-medium">Demand</th>
                        <th className="px-3 py-2 text-center text-slate-400 font-medium">Order Qty</th>
                        <th className="px-3 py-2 text-center text-slate-400 font-medium">Inventory</th>
                        <th className="px-3 py-2 text-right text-slate-400 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryResult.order_schedule.map((row, i) => (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}
                        >
                          <td className="px-3 py-2 text-slate-200">{row.period}</td>
                          <td className="px-3 py-2 text-center text-slate-300">{row.demand}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`font-semibold ${
                                row.order_quantity > 0 ? 'text-cyan-400' : 'text-slate-500'
                              }`}
                            >
                              {row.order_quantity}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-slate-300">
                            {row.inventory_level}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-400 font-medium">
                            {row.cost}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
