import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { SolverInfo, BenchmarkSuiteResponse } from '../types';
import { 
  Zap, 
  Cpu, 
  ShieldCheck, 
  TrendingUp, 
  Sliders, 
  Layers, 
  Sparkles, 
  ArrowRight,
  CheckCircle2,
  Activity,
  Layers3,
  Truck,
  Box
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (section: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [solvers, setSolvers] = useState<SolverInfo[]>([]);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkSuiteResponse | null>(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);

  useEffect(() => {
    api.listSolvers().then(setSolvers).catch(console.error);
  }, []);

  const runLiveBenchmarks = async () => {
    setLoadingBenchmarks(true);
    try {
      const res = await api.runBenchmarks();
      setBenchmarkResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBenchmarks(false);
    }
  };

  const quickLaunchCards = [
    {
      id: 'lp',
      title: t('linearProgramming'),
      desc: 'Simplex, Dual Simplex, IPM, Shadow Prices & 2D Graphical Geometry.',
      badge: 'HiGHS 1.16',
      icon: Sliders,
      gradient: 'from-blue-600 to-cyan-600',
    },
    {
      id: 'energy',
      title: t('energyOptimization'),
      desc: 'Economic Dispatch, Transmission Losses (B-matrix), 24h Microgrid Battery Storage.',
      badge: 'Power Systems',
      icon: Zap,
      gradient: 'from-amber-600 to-orange-600',
    },
    {
      id: 'milp',
      title: t('milp'),
      desc: 'Branch & Cut, 0-1 Knapsack, Binary restriction, CP-SAT & HiGHS.',
      badge: 'OR-Tools / HiGHS',
      icon: Layers,
      gradient: 'from-purple-600 to-indigo-600',
    },
    {
      id: 'logistics',
      title: t('logisticsOptimization'),
      desc: 'Capacitated Vehicle Routing (CVRP), Multi-Vehicle Fleet, Facility Location.',
      badge: 'OR-Tools Routing',
      icon: Truck,
      gradient: 'from-emerald-600 to-teal-600',
    },
    {
      id: 'model_builder',
      title: t('modelBuilder'),
      desc: 'Universal mathematical formulation builder with safe AST expression parsing & LP export.',
      badge: 'Interactive Builder',
      icon: Layers3,
      gradient: 'from-sky-600 to-blue-700',
    },
    {
      id: 'ai_assistant',
      title: t('aiAssistant'),
      desc: 'Natural language problem analysis, missing parameter detection, mathematical modeling.',
      badge: 'AI Formulation',
      icon: Sparkles,
      gradient: 'from-pink-600 to-rose-600',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Universal Operations Research & Applied Mathematical Software</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Scientific Mathematical Optimization Engine
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Real solvers powered by <b>HiGHS 1.16</b>, <b>Google OR-Tools 9.15</b>, <b>SciPy 1.18</b>, and <b>NetworkX 3.7</b>.
            Every calculation is mathematically solved, independently verified against bounds and constraints, and explained with duality and sensitivity analysis.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('model_builder')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
            >
              <span>Build Mathematical Model</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
            <button
              onClick={() => onNavigate('ai_assistant')}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center space-x-2 rtl:space-x-reverse"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>AI Problem Assistant</span>
            </button>
            <button
              onClick={runLiveBenchmarks}
              disabled={loadingBenchmarks}
              className="px-5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-all flex items-center space-x-2 rtl:space-x-reverse"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{loadingBenchmarks ? "Verifying Benchmarks..." : "Run Scientific Benchmark Verification"}</span>
            </button>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Live Benchmark Banner if run */}
      {benchmarkResult && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Mathematical Verification Suite: {benchmarkResult.passed_tests}/{benchmarkResult.total_tests} Tests Passed
                </h3>
                <p className="text-xs text-slate-400">
                  Executed in {benchmarkResult.execution_time_sec}s across LP, MILP, NLP, Economic Dispatch, Hitchcock Transportation, Harris EOQ, and Erlang M/M/1.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('benchmarks')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline"
            >
              View Full Benchmark Audit
            </button>
          </div>
        </div>
      )}

      {/* Key Metric Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Core Optimization Modules</div>
          <div className="text-2xl font-bold text-white">12 Modules</div>
          <div className="text-[11px] text-cyan-400">LP, MILP, NLP, DP, Network, Queuing...</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Industry Suites</div>
          <div className="text-2xl font-bold text-white">6 Suites</div>
          <div className="text-[11px] text-amber-400">Energy, Manufacturing, Logistics, Finance...</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Computational Solvers</div>
          <div className="text-2xl font-bold text-white">6 Engines</div>
          <div className="text-[11px] text-emerald-400">HiGHS, CP-SAT, SciPy, NetworkX...</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Validation Engine</div>
          <div className="text-2xl font-bold text-white">100% Independent</div>
          <div className="text-[11px] text-blue-400">KKT, Duality, Residuals & Slacks</div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Featured Optimization Workspaces</h2>
          <span className="text-xs text-slate-400">Click any module to launch its interactive workspace</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quickLaunchCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => onNavigate(card.id)}
                className="group relative rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/50 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-tr ${card.gradient} flex items-center justify-center text-white shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
                <div className="pt-4 flex items-center text-xs font-semibold text-blue-400 group-hover:text-cyan-300">
                  <span>Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 rtl:mr-1 rtl:rotate-180 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Solver Center Overview */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Central Mathematical Solver Registry</h3>
            <p className="text-xs text-slate-400">Introspected state of computational mathematical libraries</p>
          </div>
          <button
            onClick={() => onNavigate('solvers')}
            className="text-xs text-blue-400 hover:underline font-semibold"
          >
            View Solver Details
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {solvers.map((s) => (
            <div key={s.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start space-x-3 rtl:space-x-reverse">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0"></div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-200">{s.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight">{s.description}</div>
                <div className="text-[10px] text-slate-500 font-mono">v{s.version} • {s.category}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
