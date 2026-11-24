import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SolverInfo } from '../types';
import { Cpu, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

export const SolversView: React.FC = () => {
  const [solvers, setSolvers] = useState<SolverInfo[]>([]);

  useEffect(() => {
    api.listSolvers().then(setSolvers).catch(console.error);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Cpu className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-extrabold text-white">Solver Registry & Engine Architecture</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Introspected mathematical solvers and dispatch adapter layers. The platform dispatches problems based on convexity, variable domains, and mathematical structure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {solvers.map((s) => (
          <div key={s.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {s.category}
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">{s.name}</h3>
                <div className="text-xs text-slate-400 font-mono">Installed Version: v{s.version}</div>
              </div>
              <div className="flex items-center space-x-1.5 rtl:space-x-reverse text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Active</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              {s.description}
            </p>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Supported Mathematical Domains</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                  {s.supports_continuous ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className={s.supports_continuous ? 'text-slate-200' : 'text-slate-500'}>Continuous Variables</span>
                </div>
                <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                  {s.supports_integer ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className={s.supports_integer ? 'text-slate-200' : 'text-slate-500'}>Integer Variables</span>
                </div>
                <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                  {s.supports_binary ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className={s.supports_binary ? 'text-slate-200' : 'text-slate-500'}>Binary Variables</span>
                </div>
                <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                  {s.supports_quadratic ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className={s.supports_quadratic ? 'text-slate-200' : 'text-slate-500'}>Quadratic Programs</span>
                </div>
                <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                  {s.supports_nonlinear ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className={s.supports_nonlinear ? 'text-slate-200' : 'text-slate-500'}>Nonlinear Functions</span>
                </div>
                <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                  {s.supports_duals ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className={s.supports_duals ? 'text-slate-200' : 'text-slate-500'}>Shadow Prices & Duals</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
