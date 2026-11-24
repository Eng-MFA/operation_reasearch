import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import {
  Play,
  RotateCcw,
  Factory,
  Calendar,
  Clock,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  name: string;
  profit: number;
  machine_hours_per_unit: number;
  material_per_unit: number;
  min_demand: number;
  max_demand: number;
}

interface Resources {
  total_machine_hours_per_period: number;
  total_material_per_period: number;
}

interface ProductionPlanResult {
  status: string;
  total_profit: number;
  plan: Record<string, number[]>;
  resource_utilization: {
    machine_hours: number[];
    material: number[];
  };
}

interface Operation {
  machine: string;
  duration: number;
}

interface Job {
  name: string;
  operations: Operation[];
}

interface ScheduledTask {
  job: string;
  machine: string;
  start: number;
  end: number;
  duration: number;
}

interface JobShopResult {
  status: string;
  makespan: number;
  schedule: ScheduledTask[];
  machine_utilization: Record<string, number>;
}

// ─── Default Data ────────────────────────────────────────────────────────────

const DEFAULT_PRODUCTS: Product[] = [
  { name: 'Product A', profit: 25, machine_hours_per_unit: 2, material_per_unit: 3, min_demand: 10, max_demand: 50 },
  { name: 'Product B', profit: 30, machine_hours_per_unit: 3, material_per_unit: 2, min_demand: 15, max_demand: 40 },
  { name: 'Product C', profit: 20, machine_hours_per_unit: 1.5, material_per_unit: 4, min_demand: 5, max_demand: 60 },
];

const DEFAULT_RESOURCES: Resources = {
  total_machine_hours_per_period: 200,
  total_material_per_period: 300,
};

const DEFAULT_JOBS: Job[] = [
  { name: 'Job 1', operations: [{ machine: 'M1', duration: 3 }, { machine: 'M2', duration: 2 }, { machine: 'M3', duration: 2 }] },
  { name: 'Job 2', operations: [{ machine: 'M1', duration: 2 }, { machine: 'M3', duration: 1 }, { machine: 'M2', duration: 4 }] },
  { name: 'Job 3', operations: [{ machine: 'M2', duration: 4 }, { machine: 'M1', duration: 3 }] },
];

// ─── Colour Helpers ───────────────────────────────────────────────────────────

const MACHINE_COLORS: Record<string, string> = {
  M1: '#06b6d4',
  M2: '#10b981',
  M3: '#f59e0b',
  M4: '#a78bfa',
  M5: '#f43f5e',
};

function machineColor(machine: string): string {
  return MACHINE_COLORS[machine] ?? '#94a3b8';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UtilizationBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(1)} / {max} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Gantt Chart ─────────────────────────────────────────────────────────────

function GanttChart({ schedule, makespan }: { schedule: ScheduledTask[]; makespan: number }) {
  const W = 600;
  const ROW_H = 36;
  const PAD_LEFT = 60;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 24;
  const jobs = Array.from(new Set(schedule.map((t) => t.job)));
  const scale = makespan > 0 ? (W - PAD_LEFT - 8) / makespan : 1;
  const H = PAD_TOP + jobs.length * ROW_H + PAD_BOTTOM;

  const ticks = Array.from({ length: makespan + 1 }, (_, i) => i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-slate-900 border border-slate-700">
      {/* Y-axis labels */}
      {jobs.map((job, i) => (
        <text
          key={job}
          x={PAD_LEFT - 6}
          y={PAD_TOP + i * ROW_H + ROW_H / 2 + 4}
          textAnchor="end"
          fill="#94a3b8"
          fontSize="11"
        >
          {job}
        </text>
      ))}
      {/* Grid lines */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD_LEFT + t * scale}
            y1={PAD_TOP}
            x2={PAD_LEFT + t * scale}
            y2={PAD_TOP + jobs.length * ROW_H}
            stroke="#334155"
            strokeWidth="1"
          />
          {t % Math.max(1, Math.round(makespan / 10)) === 0 && (
            <text x={PAD_LEFT + t * scale} y={H - 6} textAnchor="middle" fill="#64748b" fontSize="10">
              {t}
            </text>
          )}
        </g>
      ))}
      {/* Task bars */}
      {schedule.map((task, idx) => {
        const row = jobs.indexOf(task.job);
        const x = PAD_LEFT + task.start * scale;
        const w = task.duration * scale;
        const y = PAD_TOP + row * ROW_H + 4;
        const bh = ROW_H - 8;
        const color = machineColor(task.machine);
        return (
          <g key={idx}>
            <rect x={x} y={y} width={w} height={bh} fill={color} rx="3" opacity="0.85" />
            {w > 20 && (
              <text x={x + w / 2} y={y + bh / 2 + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600">
                {task.machine}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const ManufacturingView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'production' | 'jobshop'>('production');

  // ── Production Planning State ──────────────────────────────────────────────
  const [planningHorizon, setPlanningHorizon] = useState(4);
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [resources, setResources] = useState<Resources>(DEFAULT_RESOURCES);
  const [ppLoading, setPpLoading] = useState(false);
  const [ppError, setPpError] = useState<string | null>(null);
  const [ppResult, setPpResult] = useState<ProductionPlanResult | null>(null);

  // ── Job Shop State ─────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Job[]>(DEFAULT_JOBS);
  const [numMachines, setNumMachines] = useState(3);
  const [jsLoading, setJsLoading] = useState(false);
  const [jsError, setJsError] = useState<string | null>(null);
  const [jsResult, setJsResult] = useState<JobShopResult | null>(null);

  // ── Production Planning Handlers ───────────────────────────────────────────
  const handleProductChange = (idx: number, field: keyof Product, value: string) => {
    setProducts((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, [field]: field === 'name' ? value : parseFloat(value) || 0 } : p
      )
    );
  };

  const addProduct = () =>
    setProducts((prev) => [
      ...prev,
      { name: `Product ${String.fromCharCode(65 + prev.length)}`, profit: 20, machine_hours_per_unit: 2, material_per_unit: 3, min_demand: 0, max_demand: 50 },
    ]);

  const removeProduct = (idx: number) => setProducts((prev) => prev.filter((_, i) => i !== idx));

  const solvePP = async () => {
    setPpLoading(true);
    setPpError(null);
    setPpResult(null);
    try {
      const result = await api.solveManufacturing({
        problem_type: 'production_planning',
        planning_horizon: planningHorizon,
        products,
        resources,
      });
      setPpResult(result as ProductionPlanResult);
    } catch (err: unknown) {
      setPpError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setPpLoading(false);
    }
  };

  const resetPP = () => {
    setProducts(DEFAULT_PRODUCTS);
    setResources(DEFAULT_RESOURCES);
    setPlanningHorizon(4);
    setPpResult(null);
    setPpError(null);
  };

  // ── Job Shop Handlers ──────────────────────────────────────────────────────
  const handleJobOpChange = (jIdx: number, opIdx: number, field: keyof Operation, value: string) => {
    setJobs((prev) =>
      prev.map((j, ji) =>
        ji === jIdx
          ? {
              ...j,
              operations: j.operations.map((op, oi) =>
                oi === opIdx
                  ? { ...op, [field]: field === 'machine' ? value : parseInt(value) || 0 }
                  : op
              ),
            }
          : j
      )
    );
  };

  const addJob = () =>
    setJobs((prev) => [
      ...prev,
      { name: `Job ${prev.length + 1}`, operations: [{ machine: 'M1', duration: 2 }] },
    ]);

  const removeJob = (idx: number) => setJobs((prev) => prev.filter((_, i) => i !== idx));

  const addOperation = (jIdx: number) =>
    setJobs((prev) =>
      prev.map((j, i) =>
        i === jIdx ? { ...j, operations: [...j.operations, { machine: 'M1', duration: 1 }] } : j
      )
    );

  const removeOperation = (jIdx: number, opIdx: number) =>
    setJobs((prev) =>
      prev.map((j, i) =>
        i === jIdx ? { ...j, operations: j.operations.filter((_, oi) => oi !== opIdx) } : j
      )
    );

  const solveJS = async () => {
    setJsLoading(true);
    setJsError(null);
    setJsResult(null);
    try {
      const result = await api.solveManufacturing({
        problem_type: 'job_shop',
        jobs,
        num_machines: numMachines,
      });
      setJsResult(result as JobShopResult);
    } catch (err: unknown) {
      setJsError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setJsLoading(false);
    }
  };

  const resetJS = () => {
    setJobs(DEFAULT_JOBS);
    setNumMachines(3);
    setJsResult(null);
    setJsError(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Factory className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('manufacturing.title', 'Manufacturing Optimization')}</h1>
          <p className="text-sm text-slate-400">{t('manufacturing.subtitle', 'Production planning and job-shop scheduling')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('production')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'production'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {t('manufacturing.tab.production', 'Production Planning (LP)')}
        </button>
        <button
          onClick={() => setActiveTab('jobshop')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'jobshop'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          {t('manufacturing.tab.jobshop', 'Job Shop Scheduling (CP-SAT)')}
        </button>
      </div>

      {/* ── Tab 1: Production Planning ── */}
      {activeTab === 'production' && (
        <div className="space-y-6">
          {/* Config row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Planning horizon */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                {t('manufacturing.horizon', 'Planning Horizon')}
              </h3>
              <input
                type="number"
                min={1}
                max={12}
                value={planningHorizon}
                onChange={(e) => setPlanningHorizon(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-slate-500 mt-1">{t('manufacturing.periods', 'periods')}</p>
            </div>

            {/* Resources */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                {t('manufacturing.resources', 'Resources per Period')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t('manufacturing.machine_hours', 'Machine Hours')}</label>
                  <input
                    type="number"
                    value={resources.total_machine_hours_per_period}
                    onChange={(e) => setResources((r) => ({ ...r, total_machine_hours_per_period: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t('manufacturing.material', 'Material (units)')}</label>
                  <input
                    type="number"
                    value={resources.total_material_per_period}
                    onChange={(e) => setResources((r) => ({ ...r, total_material_per_period: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Product Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">{t('manufacturing.products', 'Products')}</h3>
              <button
                onClick={addProduct}
                className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg px-3 py-1 transition-colors"
              >
                + {t('manufacturing.add_product', 'Add Product')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-3">{t('col.name', 'Name')}</th>
                    <th className="text-right pb-2 px-3">{t('col.profit', 'Profit/unit')}</th>
                    <th className="text-right pb-2 px-3">{t('col.machine_h', 'Machine Hrs')}</th>
                    <th className="text-right pb-2 px-3">{t('col.material', 'Material')}</th>
                    <th className="text-right pb-2 px-3">{t('col.min_demand', 'Min Demand')}</th>
                    <th className="text-right pb-2 px-3">{t('col.max_demand', 'Max Demand')}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50">
                      {(['name', 'profit', 'machine_hours_per_unit', 'material_per_unit', 'min_demand', 'max_demand'] as (keyof Product)[]).map((field) => (
                        <td key={field} className={`py-1.5 ${field === 'name' ? 'pr-3' : 'px-3'}`}>
                          <input
                            type={field === 'name' ? 'text' : 'number'}
                            value={p[field]}
                            onChange={(e) => handleProductChange(idx, field, e.target.value)}
                            className={`w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 ${field !== 'name' ? 'text-right' : ''}`}
                            step={field === 'machine_hours_per_unit' ? '0.5' : '1'}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeProduct(idx)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded hover:bg-rose-500/10">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={solvePP}
              disabled={ppLoading}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {ppLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {ppLoading ? t('solving', 'Solving…') : t('solve', 'Solve')}
            </button>
            <button
              onClick={resetPP}
              className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset', 'Reset')}
            </button>
          </div>

          {/* Error */}
          {ppError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
              {ppError}
            </div>
          )}

          {/* Results */}
          {ppResult && (
            <div className="space-y-4">
              {/* Total profit */}
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">{t('result.total_profit', 'Total Profit')}</p>
                  <p className="text-2xl font-bold text-emerald-400">${ppResult.total_profit?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Production plan matrix */}
              {ppResult.plan && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.production_plan', 'Production Plan')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-slate-800">
                          <th className="text-left pb-2 pr-3">{t('col.product', 'Product')}</th>
                          {Array.from({ length: planningHorizon }, (_, i) => (
                            <th key={i} className="text-right pb-2 px-3">{t('col.period', 'P')}{i + 1}</th>
                          ))}
                          <th className="text-right pb-2 pl-3">{t('col.total', 'Total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(ppResult.plan).map(([prod, periods]) => (
                          <tr key={prod} className="border-b border-slate-800/50">
                            <td className="py-1.5 pr-3 text-slate-300">{prod}</td>
                            {(periods as number[]).map((val, pi) => (
                              <td key={pi} className="py-1.5 px-3 text-right text-cyan-400 font-mono">{val}</td>
                            ))}
                            <td className="py-1.5 pl-3 text-right text-slate-300 font-mono font-semibold">
                              {(periods as number[]).reduce((a, b) => a + b, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resource utilization */}
              {ppResult.resource_utilization && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.resource_utilization', 'Resource Utilization')}</h3>
                  <div className="space-y-4">
                    {ppResult.resource_utilization.machine_hours?.map((val, i) => (
                      <UtilizationBar
                        key={`mh-${i}`}
                        label={`${t('col.machine_h', 'Machine Hours')} P${i + 1}`}
                        value={val}
                        max={resources.total_machine_hours_per_period}
                      />
                    ))}
                    {ppResult.resource_utilization.material?.map((val, i) => (
                      <UtilizationBar
                        key={`mat-${i}`}
                        label={`${t('col.material', 'Material')} P${i + 1}`}
                        value={val}
                        max={resources.total_material_per_period}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Job Shop ── */}
      {activeTab === 'jobshop' && (
        <div className="space-y-6">
          {/* Num machines */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('manufacturing.num_machines', 'Number of Machines')}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={numMachines}
                onChange={(e) => setNumMachines(parseInt(e.target.value) || 1)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500 w-24"
              />
            </div>
            <div className="flex gap-2 ml-4 flex-wrap">
              {Array.from({ length: numMachines }, (_, i) => (
                <span
                  key={i}
                  className="text-xs font-mono px-2 py-1 rounded"
                  style={{ background: `${machineColor(`M${i + 1}`)}22`, color: machineColor(`M${i + 1}`) }}
                >
                  M{i + 1}
                </span>
              ))}
            </div>
          </div>

          {/* Jobs editor */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">{t('manufacturing.jobs', 'Jobs & Operations')}</h3>
              <button
                onClick={addJob}
                className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg px-3 py-1 transition-colors"
              >
                + {t('manufacturing.add_job', 'Add Job')}
              </button>
            </div>
            <div className="space-y-3">
              {jobs.map((job, jIdx) => (
                <div key={jIdx} className="bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-cyan-400 w-16">{job.name}</span>
                    <button
                      onClick={() => addOperation(jIdx)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 ml-2"
                    >
                      + op
                    </button>
                    <button onClick={() => removeJob(jIdx)} className="ml-auto text-rose-400 hover:text-rose-300 text-xs">
                      ✕ job
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {job.operations.map((op, opIdx) => (
                      <div key={opIdx} className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1">
                        <select
                          value={op.machine}
                          onChange={(e) => handleJobOpChange(jIdx, opIdx, 'machine', e.target.value)}
                          className="bg-transparent text-xs text-slate-200 focus:outline-none"
                        >
                          {Array.from({ length: numMachines }, (_, i) => (
                            <option key={i} value={`M${i + 1}`}>M{i + 1}</option>
                          ))}
                        </select>
                        <span className="text-slate-500 text-xs">:</span>
                        <input
                          type="number"
                          min={1}
                          value={op.duration}
                          onChange={(e) => handleJobOpChange(jIdx, opIdx, 'duration', e.target.value)}
                          className="w-10 bg-transparent text-xs text-cyan-400 font-mono text-center focus:outline-none"
                        />
                        <button
                          onClick={() => removeOperation(jIdx, opIdx)}
                          className="text-slate-500 hover:text-rose-400 text-xs ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={solveJS}
              disabled={jsLoading}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {jsLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {jsLoading ? t('solving', 'Solving…') : t('solve', 'Solve')}
            </button>
            <button
              onClick={resetJS}
              className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset', 'Reset')}
            </button>
          </div>

          {/* Error */}
          {jsError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
              {jsError}
            </div>
          )}

          {/* Results */}
          {jsResult && (
            <div className="space-y-4">
              {/* Makespan */}
              <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                <Clock className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">{t('result.makespan', 'Optimal Makespan')}</p>
                  <p className="text-4xl font-bold text-cyan-400 font-mono">{jsResult.makespan}</p>
                  <p className="text-xs text-slate-500">{t('result.time_units', 'time units')}</p>
                </div>
              </div>

              {/* Gantt */}
              {jsResult.schedule?.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.gantt', 'Gantt Chart')}</h3>
                  <GanttChart schedule={jsResult.schedule} makespan={jsResult.makespan} />
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    {Array.from({ length: numMachines }, (_, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="w-3 h-3 rounded-sm" style={{ background: machineColor(`M${i + 1}`) }} />
                        M{i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Machine utilization */}
              {jsResult.machine_utilization && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.machine_util', 'Machine Utilization')}</h3>
                  {Object.entries(jsResult.machine_utilization).map(([machine, busyTime]) => (
                    <UtilizationBar
                      key={machine}
                      label={machine}
                      value={busyTime as number}
                      max={jsResult.makespan}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
