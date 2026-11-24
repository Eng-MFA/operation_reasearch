import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MathView } from '../utils/katex';
import { Play, GitBranch, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';

export const ProjectManagementView: React.FC = () => {
  const { t } = useLanguage();
  const [method, setMethod] = useState<'cpm' | 'pert'>('cpm');
  const [targetDeadline, setTargetDeadline] = useState<number | undefined>(14);

  const [activities, setActivities] = useState([
    { id: 'A', name: 'Site Preparation & Excavation', duration: 3, predecessors: [] as string[] },
    { id: 'B', name: 'Foundation & Concrete Pouring', duration: 4, predecessors: ['A'] },
    { id: 'C', name: 'Electrical & Plumbing Rough-in', duration: 2, predecessors: ['A'] },
    { id: 'D', name: 'Framing & Structural Assembly', duration: 5, predecessors: ['B', 'C'] },
    { id: 'E', name: 'Roofing & Exterior Cladding', duration: 3, predecessors: ['D'] }
  ]);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveProjectMgmt({
        name: "Commercial Construction Schedule",
        method,
        target_deadline: targetDeadline,
        activities
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Project scheduling failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Module I: Project Management (CPM / PERT)</h1>
          <p className="text-xs text-slate-400 mt-1">
            Critical Path Method, Earliest/Latest starts, Total/Free Float, PERT probability, and Gantt charts.
          </p>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
          >
            <option value="cpm">Critical Path Method (CPM)</option>
            <option value="pert">PERT (3-Point Probabilistic)</option>
          </select>
          <button
            onClick={handleSolve}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center space-x-2 rtl:space-x-reverse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? t('solving') : 'Schedule Critical Path'}</span>
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
        {/* Activity Network Table */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Activity on Node Network</h3>

            <div className="space-y-2">
              {activities.map((act) => (
                <div key={act.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">[{act.id}] {act.name}</span>
                    <span className="text-xs font-mono text-cyan-400 font-bold">{act.duration} days</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Predecessors: {act.predecessors.length > 0 ? act.predecessors.join(', ') : 'None (Start)'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results & Gantt Chart */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">PROJECT NETWORK SOLVED</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Critical Duration: <span className="text-white font-bold">{result.project_duration} Days</span>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Critical Path</div>
                <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                  {result.critical_path.join(' -> ')}
                </div>
              </div>

              {/* Interactive SVG Gantt Chart */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-300 flex items-center space-x-2 rtl:space-x-reverse">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Interactive Schedule Gantt Chart</span>
                </h4>

                <div className="space-y-2 pt-2">
                  {result.gantt_chart_data.map((bar: any) => {
                    const totalDur = result.project_duration || 15;
                    const leftPct = (bar.start / totalDur) * 100;
                    const widthPct = Math.max(5, (bar.duration / totalDur) * 100);

                    return (
                      <div key={bar.id} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className={bar.is_critical ? "font-bold text-amber-300" : "text-slate-300"}>
                            [{bar.id}] {bar.name}
                          </span>
                          <span className="font-mono text-slate-400">Day {bar.start} - {bar.end} ({bar.duration}d)</span>
                        </div>
                        <div className="w-full h-4 bg-slate-900 rounded-full relative overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              bar.is_critical ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            }`}
                            style={{
                              marginLeft: `${leftPct}%`,
                              width: `${widthPct}%`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Float Analysis Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2">Activity</th>
                      <th className="pb-2">ES</th>
                      <th className="pb-2">EF</th>
                      <th className="pb-2">LS</th>
                      <th className="pb-2">LF</th>
                      <th className="pb-2">Total Float</th>
                      <th className="pb-2">Free Float</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {result.activities_schedule.map((a: any) => (
                      <tr key={a.id} className={a.is_critical ? "bg-amber-500/5" : ""}>
                        <td className="py-1.5 font-bold text-slate-200">{a.id}</td>
                        <td className="py-1.5 text-slate-300">{a.earliest_start}</td>
                        <td className="py-1.5 text-slate-300">{a.earliest_finish}</td>
                        <td className="py-1.5 text-slate-300">{a.latest_start}</td>
                        <td className="py-1.5 text-slate-300">{a.latest_finish}</td>
                        <td className={`py-1.5 font-bold ${a.total_float === 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {a.total_float}
                        </td>
                        <td className="py-1.5 text-slate-400">{a.free_float}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <GitBranch className="w-10 h-10 text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">Run CPM Project Engine</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Compute forward/backward passes, floats, and project Gantt bars.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
