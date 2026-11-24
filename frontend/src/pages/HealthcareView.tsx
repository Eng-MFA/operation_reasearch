import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { Play, RotateCcw, HeartPulse, Users, Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ShiftRequirement {
  day: number;
  shift: number;
  required: number;
}

interface ResourceEntry {
  name: string;
  type: string;
  available_hours_per_day: number;
}

interface AppointmentType {
  name: string;
  duration_min: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  daily_demand: number;
}

interface RosterResult {
  schedule: Record<string, Record<string, string[]>>; // day -> shift -> nurses
  nurse_summary: { nurse: string; total_shifts: number; days_off: number }[];
  fairness_std: number;
  status: 'feasible' | 'infeasible';
  violations?: string[];
  solver_time_ms?: number;
}

interface ResourceResult {
  daily_schedule: {
    day: number;
    slots: { time: string; resource: string; appointment_type: string; duration_min: number }[];
  }[];
  utilization: Record<string, number>;
  total_appointments: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHIFT_NAMES = ['Morning', 'Afternoon', 'Night'];

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-rose-900/40 text-rose-400 border border-rose-800',
  MEDIUM: 'bg-amber-900/40 text-amber-400 border border-amber-800',
  LOW: 'bg-slate-700 text-slate-400 border border-slate-600',
};

function buildDefaultRequirements(): ShiftRequirement[] {
  const reqs: ShiftRequirement[] = [];
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < 3; s++) {
      reqs.push({ day: d, shift: s, required: 2 });
    }
  }
  return reqs;
}

const DEFAULT_RESOURCES: ResourceEntry[] = [
  { name: 'Dr. Smith',   type: 'Doctor', available_hours_per_day: 8 },
  { name: 'Dr. Jones',   type: 'Doctor', available_hours_per_day: 8 },
  { name: 'Dr. Patel',   type: 'Doctor', available_hours_per_day: 6 },
  { name: 'Nurse Kim',   type: 'Nurse',  available_hours_per_day: 8 },
  { name: 'Nurse Lopez', type: 'Nurse',  available_hours_per_day: 8 },
];

const DEFAULT_APPT_TYPES: AppointmentType[] = [
  { name: 'Emergency',    duration_min: 30,  priority: 'HIGH',   daily_demand: 5  },
  { name: 'Consultation', duration_min: 20,  priority: 'MEDIUM', daily_demand: 20 },
  { name: 'Follow-up',    duration_min: 15,  priority: 'LOW',    daily_demand: 15 },
  { name: 'Surgery',      duration_min: 120, priority: 'HIGH',   daily_demand: 2  },
];

// Badge colors for nurse assignments
const NURSE_BADGE_COLORS = [
  'bg-cyan-900/60 text-cyan-300 border border-cyan-800',
  'bg-violet-900/60 text-violet-300 border border-violet-800',
  'bg-emerald-900/60 text-emerald-300 border border-emerald-800',
  'bg-amber-900/60 text-amber-300 border border-amber-800',
  'bg-rose-900/60 text-rose-300 border border-rose-800',
  'bg-sky-900/60 text-sky-300 border border-sky-800',
];

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const HealthcareView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'rostering' | 'scheduling'>('rostering');

  // --- Nurse Rostering State ---
  const [numNurses, setNumNurses] = useState(5);
  const [numDays] = useState(7);
  const [nurseNames, setNurseNames] = useState<string[]>(['Alice', 'Bob', 'Carol', 'David', 'Emma']);
  const [shiftRequirements, setShiftRequirements] = useState<ShiftRequirement[]>(buildDefaultRequirements());
  const [maxShiftsPerNurse, setMaxShiftsPerNurse] = useState(5);
  const [minRestBetweenShifts, setMinRestBetweenShifts] = useState(1);
  const [rosterResult, setRosterResult] = useState<RosterResult | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  // --- Resource Scheduling State ---
  const [resources, setResources] = useState<ResourceEntry[]>(DEFAULT_RESOURCES);
  const [apptTypes, setApptTypes] = useState<AppointmentType[]>(DEFAULT_APPT_TYPES);
  const [opHours, setOpHours] = useState({ start: 8, end: 18 });
  const [schedulingDays, setSchedulingDays] = useState(5);
  const [scheduleResult, setScheduleResult] = useState<ResourceResult | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Nurse helpers
  // ---------------------------------------------------------------------------
  const getRequiredCount = (day: number, shift: number): number => {
    return shiftRequirements.find(r => r.day === day && r.shift === shift)?.required ?? 2;
  };

  const setRequiredCount = (day: number, shift: number, val: number) => {
    setShiftRequirements(prev => {
      const idx = prev.findIndex(r => r.day === day && r.shift === shift);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], required: val };
        return next;
      }
      return [...prev, { day, shift, required: val }];
    });
  };

  const addNurse = () => {
    const name = `Nurse ${numNurses + 1}`;
    setNurseNames(prev => [...prev, name]);
    setNumNurses(n => n + 1);
  };

  const removeNurse = (i: number) => {
    setNurseNames(prev => prev.filter((_, idx) => idx !== i));
    setNumNurses(n => Math.max(1, n - 1));
  };

  const updateNurseName = (i: number, name: string) => {
    setNurseNames(prev => { const next = [...prev]; next[i] = name; return next; });
  };

  // ---------------------------------------------------------------------------
  // Solve: Nurse Rostering
  // ---------------------------------------------------------------------------
  const handleSolveRoster = async () => {
    setRosterLoading(true);
    setRosterError(null);
    try {
      const res = await (api as any).solveNurseRostering({
        problem_type: 'nurse_rostering',
        num_nurses: nurseNames.length,
        num_days: numDays,
        shifts_per_day: 3,
        nurses: nurseNames,
        shift_requirements: shiftRequirements,
        max_shifts_per_nurse: maxShiftsPerNurse,
        min_rest_between_shifts: minRestBetweenShifts,
      });
      setRosterResult(res);
    } catch (err: any) {
      setRosterError(err.message || 'Nurse rostering failed');
    } finally {
      setRosterLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Solve: Resource Scheduling
  // ---------------------------------------------------------------------------
  const handleSolveSchedule = async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const res = await (api as any).solveNurseRostering({
        problem_type: 'resource_scheduling',
        resources,
        appointment_types: apptTypes,
        operating_hours: opHours,
        num_days: schedulingDays,
      });
      setScheduleResult(res);
    } catch (err: any) {
      setScheduleError(err.message || 'Resource scheduling failed');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleReset = () => {
    setRosterResult(null);
    setScheduleResult(null);
    setRosterError(null);
    setScheduleError(null);
  };

  // ---------------------------------------------------------------------------
  // Roster Result Display
  // ---------------------------------------------------------------------------
  const RosterResultDisplay = ({ res }: { res: RosterResult }) => {
    const nurseColorMap: Record<string, string> = {};
    nurseNames.forEach((n, i) => { nurseColorMap[n] = NURSE_BADGE_COLORS[i % NURSE_BADGE_COLORS.length]; });

    return (
      <div className="space-y-6">
        {/* Status */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${res.status === 'feasible' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-rose-950/40 border-rose-800 text-rose-400'}`}>
          {res.status === 'feasible'
            ? <CheckCircle2 className="w-5 h-5 shrink-0" />
            : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <div>
            <span className="text-sm font-semibold">
              {res.status === 'feasible' ? 'All constraints satisfied ✓' : 'Infeasible — constraint violations detected'}
            </span>
            {res.violations && res.violations.length > 0 && (
              <ul className="mt-1 text-xs space-y-0.5">
                {res.violations.map((v, i) => <li key={i} className="text-rose-400">• {v}</li>)}
              </ul>
            )}
            {res.solver_time_ms !== undefined && (
              <p className="text-xs text-slate-400 mt-0.5">Solved in {res.solver_time_ms.toFixed(1)} ms (CP-SAT)</p>
            )}
          </div>
        </div>

        {/* Roster grid */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200">Weekly Roster</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-3 py-2 text-left text-slate-400 w-24">Shift</th>
                  {DAY_NAMES.map(d => (
                    <th key={d} className="px-3 py-2 text-center text-slate-400">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHIFT_NAMES.map((shiftName, s) => (
                  <tr key={s} className="border-b border-slate-700/50">
                    <td className="px-3 py-2 font-semibold text-slate-300">{shiftName}</td>
                    {DAY_NAMES.map((_, d) => {
                      const dayKey = `day_${d}`;
                      const shiftKey = `shift_${s}`;
                      const assigned: string[] = res.schedule?.[dayKey]?.[shiftKey] ?? [];
                      const required = getRequiredCount(d, s);
                      const met = assigned.length >= required;
                      return (
                        <td key={d} className="px-2 py-2 text-center align-top">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {assigned.length === 0 ? (
                              <span className="text-slate-600 italic">—</span>
                            ) : (
                              assigned.map(n => (
                                <span key={n} className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${nurseColorMap[n] || NURSE_BADGE_COLORS[0]}`}>
                                  {n}
                                </span>
                              ))
                            )}
                          </div>
                          <div className={`text-xs mt-1 ${met ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {assigned.length}/{required}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Nurse Summary</h3>
            {res.fairness_std !== undefined && (
              <span className="text-xs text-slate-400">
                Fairness (σ): <span className={`font-mono font-bold ${res.fairness_std < 1 ? 'text-emerald-400' : 'text-amber-400'}`}>{res.fairness_std.toFixed(3)}</span>
                <span className="text-slate-500 ml-1">(lower = fairer)</span>
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-2 text-left">Nurse</th>
                <th className="px-4 py-2 text-center">Total Shifts</th>
                <th className="px-4 py-2 text-center">Days Off</th>
                <th className="px-4 py-2 text-center">Load</th>
              </tr>
            </thead>
            <tbody>
              {(res.nurse_summary ?? nurseNames.map(n => ({ nurse: n, total_shifts: 0, days_off: numDays }))).map((row, i) => {
                const loadPct = Math.round((row.total_shifts / (numDays * 3)) * 100);
                return (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20 text-xs">
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${NURSE_BADGE_COLORS[i % NURSE_BADGE_COLORS.length]}`}>
                        {row.nurse}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-cyan-400">{row.total_shifts}</td>
                    <td className="px-4 py-2 text-center font-mono text-slate-300">{row.days_off}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${loadPct > 70 ? 'bg-rose-500' : loadPct > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${loadPct}%` }}
                          />
                        </div>
                        <span className="text-slate-400 w-8 text-right">{loadPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Resource Schedule Result
  // ---------------------------------------------------------------------------
  const ScheduleResultDisplay = ({ res }: { res: ResourceResult }) => (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
          <p className="text-xs text-slate-400">Status</p>
          <p className={`text-sm font-bold mt-1 ${res.status === 'feasible' ? 'text-emerald-400' : 'text-amber-400'}`}>{res.status}</p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
          <p className="text-xs text-slate-400">Total Appointments</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{res.total_appointments ?? '—'}</p>
        </div>
        {Object.entries(res.utilization ?? {}).slice(0, 2).map(([name, pct]) => (
          <div key={name} className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
            <p className="text-xs text-slate-400 truncate">{name}</p>
            <p className={`text-2xl font-bold mt-1 ${Number(pct) > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>{Number(pct).toFixed(0)}%</p>
            <p className="text-xs text-slate-500">Utilization</p>
          </div>
        ))}
      </div>

      {/* Utilization bars */}
      {Object.keys(res.utilization ?? {}).length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Resource Utilization</h3>
          <div className="space-y-2">
            {Object.entries(res.utilization).map(([name, pct]) => {
              const p = Number(pct);
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-28 text-right shrink-0 truncate">{name}</span>
                  <div className="flex-1 bg-slate-900 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-4 rounded-full transition-all ${p > 80 ? 'bg-rose-500' : p > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, p)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-300 w-10 text-right">{p.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily schedule */}
      {(res.daily_schedule ?? []).map(day => (
        <div key={day.day} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200">Day {day.day}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Resource</th>
                  <th className="px-3 py-2 text-left">Appointment Type</th>
                  <th className="px-3 py-2 text-center">Duration</th>
                </tr>
              </thead>
              <tbody>
                {(day.slots ?? []).map((slot, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-3 py-2 font-mono text-slate-300">{slot.time}</td>
                    <td className="px-3 py-2 text-slate-200">{slot.resource}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        apptTypes.find(a => a.name === slot.appointment_type)?.priority === 'HIGH'
                          ? 'bg-rose-900/40 text-rose-400'
                          : apptTypes.find(a => a.name === slot.appointment_type)?.priority === 'MEDIUM'
                          ? 'bg-amber-900/40 text-amber-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {slot.appointment_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-400">{slot.duration_min} min</td>
                  </tr>
                ))}
                {(day.slots ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-600 italic">No appointments scheduled</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-900/40 flex items-center justify-center">
            <HeartPulse className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Healthcare Optimization</h1>
            <p className="text-sm text-slate-400">Staff rostering & resource scheduling with CP-SAT</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl mb-6 w-fit">
        {[
          { key: 'rostering',  label: 'Nurse Rostering (CP-SAT)' },
          { key: 'scheduling', label: 'Resource Scheduling' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-rose-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- TAB 1: Nurse Rostering ---- */}
      {activeTab === 'rostering' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div className="space-y-6">
            {/* Nurse names editor */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" /> Nurse Roster ({nurseNames.length})
                </h3>
                <button
                  onClick={addNurse}
                  className="text-xs px-2 py-1 rounded bg-rose-900/40 hover:bg-rose-800/40 text-rose-400 border border-rose-800 transition-colors"
                >
                  + Add Nurse
                </button>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {nurseNames.map((n, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1">
                    <input
                      className="bg-transparent text-sm text-slate-200 focus:outline-none w-20"
                      value={n}
                      onChange={e => updateNurseName(i, e.target.value)}
                    />
                    {nurseNames.length > 1 && (
                      <button onClick={() => removeNurse(i)} className="text-slate-500 hover:text-rose-400 ml-1 text-xs">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Shift requirements grid */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-400" /> Shift Requirements
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Nurses required per shift per day</p>
              </div>
              <div className="overflow-x-auto p-3">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-slate-400 pb-2 w-24">Shift</th>
                      {DAY_NAMES.map(d => (
                        <th key={d} className="text-center text-slate-400 pb-2 w-14">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SHIFT_NAMES.map((shiftName, s) => (
                      <tr key={s} className="border-t border-slate-700/50">
                        <td className="py-1 pr-3 text-slate-300 font-medium">{shiftName}</td>
                        {DAY_NAMES.map((_, d) => (
                          <td key={d} className="py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              className="w-10 h-8 text-center bg-slate-900 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-rose-500"
                              value={getRequiredCount(d, s)}
                              onChange={e => setRequiredCount(d, s, parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Constraints */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-400" /> Constraints
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Max Shifts / Nurse</label>
                  <input
                    type="number"
                    min="1"
                    max="21"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500 w-full"
                    value={maxShiftsPerNurse}
                    onChange={e => setMaxShiftsPerNurse(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Min Rest Between Shifts (days)</label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500 w-full"
                    value={minRestBetweenShifts}
                    onChange={e => setMinRestBetweenShifts(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Solve button */}
              <button
                onClick={handleSolveRoster}
                disabled={rosterLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-rose-900/30"
              >
                {rosterLoading ? <Spinner /> : <Play className="w-4 h-4" />}
                {rosterLoading ? 'Solving with CP-SAT…' : 'Solve Nurse Rostering'}
              </button>
            </div>

            {/* Error */}
            {rosterError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{rosterError}</span>
              </div>
            )}
          </div>

          {/* Right: results */}
          <div>
            {rosterResult ? (
              <RosterResultDisplay res={rosterResult} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 py-20">
                <Calendar className="w-12 h-12 opacity-30" />
                <p className="text-sm text-center">Configure nurses and shift requirements,<br />then click <strong className="text-slate-400">Solve Nurse Rostering</strong></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- TAB 2: Resource Scheduling ---- */}
      {activeTab === 'scheduling' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div className="space-y-6">
            {/* Resources table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" /> Resources
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs">
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-center">Hrs/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((r, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        <td className="px-3 py-2">
                          <input
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-28 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                            value={r.name}
                            onChange={e => setResources(prev => { const n = [...prev]; n[i] = { ...n[i], name: e.target.value }; return n; })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                            value={r.type}
                            onChange={e => setResources(prev => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value }; return n; })}
                          >
                            <option value="Doctor">Doctor</option>
                            <option value="Nurse">Nurse</option>
                            <option value="Technician">Technician</option>
                            <option value="Room">Room</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            max="24"
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-14 text-center text-xs text-cyan-400 focus:outline-none focus:border-cyan-500"
                            value={r.available_hours_per_day}
                            onChange={e => setResources(prev => { const n = [...prev]; n[i] = { ...n[i], available_hours_per_day: parseInt(e.target.value) || 8 }; return n; })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Appointment types */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">Appointment Types</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs">
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-center">Duration (min)</th>
                      <th className="px-3 py-2 text-center">Priority</th>
                      <th className="px-3 py-2 text-center">Daily Demand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apptTypes.map((a, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        <td className="px-3 py-2 text-slate-200 text-xs font-medium">{a.name}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="5"
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-16 text-center text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                            value={a.duration_min}
                            onChange={e => setApptTypes(prev => { const n = [...prev]; n[i] = { ...n[i], duration_min: parseInt(e.target.value) || 15 }; return n; })}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[a.priority]}`}>{a.priority}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-16 text-center text-xs text-cyan-400 focus:outline-none focus:border-cyan-500"
                            value={a.daily_demand}
                            onChange={e => setApptTypes(prev => { const n = [...prev]; n[i] = { ...n[i], daily_demand: parseInt(e.target.value) || 0 }; return n; })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operating hours + solve */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" /> Operating Parameters
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Start Hour</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 w-full"
                    value={opHours.start}
                    onChange={e => setOpHours(h => ({ ...h, start: parseInt(e.target.value) || 8 }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">End Hour</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 w-full"
                    value={opHours.end}
                    onChange={e => setOpHours(h => ({ ...h, end: parseInt(e.target.value) || 18 }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Num Days</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 w-full"
                    value={schedulingDays}
                    onChange={e => setSchedulingDays(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>

              <button
                onClick={handleSolveSchedule}
                disabled={scheduleLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-cyan-900/30"
              >
                {scheduleLoading ? <Spinner /> : <Play className="w-4 h-4" />}
                {scheduleLoading ? 'Scheduling…' : 'Solve Resource Scheduling'}
              </button>

              {scheduleError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scheduleError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: results */}
          <div>
            {scheduleResult ? (
              <ScheduleResultDisplay res={scheduleResult} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 py-20">
                <Clock className="w-12 h-12 opacity-30" />
                <p className="text-sm text-center">Configure resources & appointment types,<br />then click <strong className="text-slate-400">Solve Resource Scheduling</strong></p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
