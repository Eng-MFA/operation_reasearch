import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import {
  Play,
  RotateCcw,
  Truck,
  Package,
  MapPin,
  CheckCircle2,
  Route,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Location {
  name: string;
  x: number;
  y: number;
}

interface Customer extends Location {
  demand: number;
}

interface VehicleRoute {
  vehicle: number;
  stops: string[];
  load: number;
  distance: number;
}

interface CVRPResult {
  status: string;
  total_distance: number;
  vehicles_used: number;
  routes: VehicleRoute[];
}

interface Facility {
  name: string;
  x: number;
  y: number;
  fixed_cost: number;
  capacity: number;
}

interface FacilityAssignment {
  customer: string;
  facility: string;
  distance: number;
}

interface FLResult {
  status: string;
  total_cost: number;
  selected_facilities: string[];
  assignments: FacilityAssignment[];
  total_fixed_cost: number;
  total_service_cost: number;
}

// ─── Default Data ────────────────────────────────────────────────────────────

const DEFAULT_DEPOT: Location = { name: 'Depot', x: 0, y: 0 };

const DEFAULT_CUSTOMERS: Customer[] = [
  { name: 'C1', x: 2, y: 4, demand: 15 },
  { name: 'C2', x: 5, y: 2, demand: 20 },
  { name: 'C3', x: 6, y: 6, demand: 10 },
  { name: 'C4', x: 1, y: 7, demand: 25 },
  { name: 'C5', x: 8, y: 3, demand: 18 },
  { name: 'C6', x: 4, y: 8, demand: 12 },
];

const DEFAULT_FACILITIES: Facility[] = [
  { name: 'F1', x: 2, y: 3, fixed_cost: 5000, capacity: 200 },
  { name: 'F2', x: 7, y: 2, fixed_cost: 4000, capacity: 150 },
  { name: 'F3', x: 5, y: 7, fixed_cost: 6000, capacity: 250 },
  { name: 'F4', x: 1, y: 8, fixed_cost: 3500, capacity: 180 },
];

const DEFAULT_CUSTOMERS_FL: Customer[] = DEFAULT_CUSTOMERS.slice(0, 5);

// ─── Color palette for routes ─────────────────────────────────────────────────

const ROUTE_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#a78bfa', '#f43f5e'];

function routeColor(vehicleIdx: number): string {
  return ROUTE_COLORS[vehicleIdx % ROUTE_COLORS.length];
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

const SVG_W = 300;
const SVG_H = 300;
const SVG_PAD = 24;

function toSvgX(x: number, minX: number, maxX: number): number {
  const range = maxX - minX || 1;
  return SVG_PAD + ((x - minX) / range) * (SVG_W - 2 * SVG_PAD);
}

function toSvgY(y: number, minY: number, maxY: number): number {
  const range = maxY - minY || 1;
  // Flip Y so higher values appear at the top
  return SVG_H - SVG_PAD - ((y - minY) / range) * (SVG_H - 2 * SVG_PAD);
}

// ─── CVRP Map ─────────────────────────────────────────────────────────────────

function CVRPMap({
  depot,
  customers,
  routes,
}: {
  depot: Location;
  customers: Customer[];
  routes: VehicleRoute[];
}) {
  const allPts = [depot, ...customers];
  const minX = Math.min(...allPts.map((p) => p.x));
  const maxX = Math.max(...allPts.map((p) => p.x));
  const minY = Math.min(...allPts.map((p) => p.y));
  const maxY = Math.max(...allPts.map((p) => p.y));

  const sx = (x: number) => toSvgX(x, minX, maxX);
  const sy = (y: number) => toSvgY(y, minY, maxY);

  const locationMap: Record<string, Location> = { [depot.name]: depot };
  customers.forEach((c) => (locationMap[c.name] = c));

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full max-w-sm rounded-lg bg-slate-900 border border-slate-700">
      {/* Route lines */}
      {routes.map((route, ri) => {
        const pts: Location[] = [depot, ...route.stops.map((s) => locationMap[s]).filter(Boolean), depot];
        const color = routeColor(ri);
        return pts.slice(0, -1).map((_, si) => {
          const a = pts[si];
          const b = pts[si + 1];
          return (
            <line
              key={`${ri}-${si}`}
              x1={sx(a.x)} y1={sy(a.y)}
              x2={sx(b.x)} y2={sy(b.y)}
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity="0.7"
            />
          );
        });
      })}

      {/* Customer dots */}
      {customers.map((c) => (
        <g key={c.name}>
          <circle cx={sx(c.x)} cy={sy(c.y)} r="5" fill="#3b82f6" stroke="#1e40af" strokeWidth="1.5" />
          <text x={sx(c.x) + 7} y={sy(c.y) + 4} fill="#94a3b8" fontSize="9">{c.name}</text>
        </g>
      ))}

      {/* Depot star */}
      <text x={sx(depot.x)} y={sy(depot.y) + 5} textAnchor="middle" fill="#f43f5e" fontSize="14">★</text>
      <text x={sx(depot.x)} y={sy(depot.y) + 18} textAnchor="middle" fill="#94a3b8" fontSize="8">Depot</text>
    </svg>
  );
}

// ─── Facility Location Map ────────────────────────────────────────────────────

function FacilityMap({
  facilities,
  customers,
  selectedFacilities,
  assignments,
}: {
  facilities: Facility[];
  customers: Customer[];
  selectedFacilities: string[];
  assignments: FacilityAssignment[];
}) {
  const allPts = [...facilities, ...customers];
  const minX = Math.min(...allPts.map((p) => p.x));
  const maxX = Math.max(...allPts.map((p) => p.x));
  const minY = Math.min(...allPts.map((p) => p.y));
  const maxY = Math.max(...allPts.map((p) => p.y));

  const sx = (x: number) => toSvgX(x, minX, maxX);
  const sy = (y: number) => toSvgY(y, minY, maxY);

  const facilityMap: Record<string, Facility> = {};
  facilities.forEach((f) => (facilityMap[f.name] = f));
  const customerMap: Record<string, Customer> = {};
  customers.forEach((c) => (customerMap[c.name] = c));

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full max-w-sm rounded-lg bg-slate-900 border border-slate-700">
      {/* Assignment lines */}
      {assignments.map((asgn, i) => {
        const fac = facilityMap[asgn.facility];
        const cust = customerMap[asgn.customer];
        if (!fac || !cust) return null;
        const isSelected = selectedFacilities.includes(fac.name);
        return (
          <line
            key={i}
            x1={sx(fac.x)} y1={sy(fac.y)}
            x2={sx(cust.x)} y2={sy(cust.y)}
            stroke={isSelected ? '#10b981' : '#475569'}
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.6"
          />
        );
      })}

      {/* Facilities */}
      {facilities.map((f) => {
        const selected = selectedFacilities.includes(f.name);
        return (
          <g key={f.name}>
            <rect
              x={sx(f.x) - 6} y={sy(f.y) - 6}
              width="12" height="12"
              fill={selected ? '#10b981' : '#334155'}
              stroke={selected ? '#059669' : '#475569'}
              strokeWidth="1.5"
              rx="2"
            />
            <text x={sx(f.x) + 10} y={sy(f.y) + 4} fill={selected ? '#6ee7b7' : '#64748b'} fontSize="9">{f.name}</text>
          </g>
        );
      })}

      {/* Customers */}
      {customers.map((c) => (
        <g key={c.name}>
          <circle cx={sx(c.x)} cy={sy(c.y)} r="4" fill="#3b82f6" stroke="#1e40af" strokeWidth="1" />
          <text x={sx(c.x) + 6} y={sy(c.y) + 3} fill="#94a3b8" fontSize="8">{c.name}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function UtilizationBar({ label, value, max, unit = '' }: { label: string; value: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-400' : 'bg-cyan-500';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(1)}{unit} / {max.toFixed(1)}{unit} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const LogisticsView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'cvrp' | 'facility'>('cvrp');

  // ── CVRP State ─────────────────────────────────────────────────────────────
  const [depot] = useState<Location>(DEFAULT_DEPOT);
  const [customers, setCustomers] = useState<Customer[]>(DEFAULT_CUSTOMERS);
  const [vehicleCapacity, setVehicleCapacity] = useState(60);
  const [numVehicles, setNumVehicles] = useState(3);
  const [cvrpLoading, setCvrpLoading] = useState(false);
  const [cvrpError, setCvrpError] = useState<string | null>(null);
  const [cvrpResult, setCvrpResult] = useState<CVRPResult | null>(null);

  // ── Facility Location State ────────────────────────────────────────────────
  const [facilities, setFacilities] = useState<Facility[]>(DEFAULT_FACILITIES);
  const [customersFL, setCustomersFL] = useState<Customer[]>(DEFAULT_CUSTOMERS_FL);
  const [flLoading, setFlLoading] = useState(false);
  const [flError, setFlError] = useState<string | null>(null);
  const [flResult, setFlResult] = useState<FLResult | null>(null);

  // ── Customer handlers (CVRP) ───────────────────────────────────────────────
  const handleCustomerChange = (idx: number, field: keyof Customer, value: string) => {
    setCustomers((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, [field]: field === 'name' ? value : parseFloat(value) || 0 } : c
      )
    );
  };

  const addCustomer = () =>
    setCustomers((prev) => [
      ...prev,
      { name: `C${prev.length + 1}`, x: Math.round(Math.random() * 8), y: Math.round(Math.random() * 8), demand: 15 },
    ]);

  const removeCustomer = (idx: number) => setCustomers((prev) => prev.filter((_, i) => i !== idx));

  const solveCVRP = async () => {
    setCvrpLoading(true);
    setCvrpError(null);
    setCvrpResult(null);
    try {
      const result = await api.solveLogistics({
        problem_type: 'cvrp',
        depot,
        customers,
        vehicle_capacity: vehicleCapacity,
        num_vehicles: numVehicles,
      });
      setCvrpResult(result as CVRPResult);
    } catch (err: unknown) {
      setCvrpError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCvrpLoading(false);
    }
  };

  const resetCVRP = () => {
    setCustomers(DEFAULT_CUSTOMERS);
    setVehicleCapacity(60);
    setNumVehicles(3);
    setCvrpResult(null);
    setCvrpError(null);
  };

  // ── Facility handlers ──────────────────────────────────────────────────────
  const handleFacilityChange = (idx: number, field: keyof Facility, value: string) => {
    setFacilities((prev) =>
      prev.map((f, i) =>
        i === idx ? { ...f, [field]: field === 'name' ? value : parseFloat(value) || 0 } : f
      )
    );
  };

  const addFacility = () =>
    setFacilities((prev) => [
      ...prev,
      { name: `F${prev.length + 1}`, x: 5, y: 5, fixed_cost: 5000, capacity: 200 },
    ]);

  const removeFacility = (idx: number) => setFacilities((prev) => prev.filter((_, i) => i !== idx));

  const handleCustomerFLChange = (idx: number, field: keyof Customer, value: string) => {
    setCustomersFL((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, [field]: field === 'name' ? value : parseFloat(value) || 0 } : c
      )
    );
  };

  const addCustomerFL = () =>
    setCustomersFL((prev) => [
      ...prev,
      { name: `C${prev.length + 1}`, x: Math.round(Math.random() * 8), y: Math.round(Math.random() * 8), demand: 20 },
    ]);

  const removeCustomerFL = (idx: number) => setCustomersFL((prev) => prev.filter((_, i) => i !== idx));

  const solveFL = async () => {
    setFlLoading(true);
    setFlError(null);
    setFlResult(null);
    try {
      const result = await api.solveLogistics({
        problem_type: 'facility_location',
        facilities,
        customers: customersFL,
      });
      setFlResult(result as FLResult);
    } catch (err: unknown) {
      setFlError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setFlLoading(false);
    }
  };

  const resetFL = () => {
    setFacilities(DEFAULT_FACILITIES);
    setCustomersFL(DEFAULT_CUSTOMERS_FL);
    setFlResult(null);
    setFlError(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Truck className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('logistics.title', 'Logistics Optimization')}</h1>
          <p className="text-sm text-slate-400">{t('logistics.subtitle', 'Vehicle routing and facility location')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('cvrp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'cvrp'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route className="w-4 h-4" />
          {t('logistics.tab.cvrp', 'Vehicle Routing (CVRP)')}
        </button>
        <button
          onClick={() => setActiveTab('facility')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'facility'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          {t('logistics.tab.facility', 'Facility Location')}
        </button>
      </div>

      {/* ── Tab 1: CVRP ── */}
      {activeTab === 'cvrp' && (
        <div className="space-y-6">
          {/* Vehicle params */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              {t('logistics.vehicle_params', 'Vehicle Parameters')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('logistics.vehicle_capacity', 'Vehicle Capacity')}</label>
                <input
                  type="number"
                  min={1}
                  value={vehicleCapacity}
                  onChange={(e) => setVehicleCapacity(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('logistics.num_vehicles', 'Number of Vehicles')}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={numVehicles}
                  onChange={(e) => setNumVehicles(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="w-3 h-3 text-rose-400" />
              {t('logistics.depot_at', 'Depot at')} (0, 0)
            </div>
          </div>

          {/* Customer table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" />
                {t('logistics.customers', 'Customers')}
              </h3>
              <button
                onClick={addCustomer}
                className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg px-3 py-1 transition-colors"
              >
                + {t('logistics.add_customer', 'Add Customer')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-3">{t('col.name', 'Name')}</th>
                    <th className="text-right pb-2 px-3">{t('col.x', 'X')}</th>
                    <th className="text-right pb-2 px-3">{t('col.y', 'Y')}</th>
                    <th className="text-right pb-2 px-3">{t('col.demand', 'Demand')}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50">
                      {(['name', 'x', 'y', 'demand'] as (keyof Customer)[]).map((field) => (
                        <td key={field} className={`py-1.5 ${field === 'name' ? 'pr-3' : 'px-3'}`}>
                          <input
                            type={field === 'name' ? 'text' : 'number'}
                            value={c[field]}
                            onChange={(e) => handleCustomerChange(idx, field, e.target.value)}
                            className={`w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 ${field !== 'name' ? 'text-right' : ''}`}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeCustomer(idx)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded hover:bg-rose-500/10">✕</button>
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
              onClick={solveCVRP}
              disabled={cvrpLoading}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {cvrpLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {cvrpLoading ? t('solving', 'Solving…') : t('solve', 'Solve')}
            </button>
            <button
              onClick={resetCVRP}
              className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset', 'Reset')}
            </button>
          </div>

          {/* Error */}
          {cvrpError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
              {cvrpError}
            </div>
          )}

          {/* Results */}
          {cvrpResult && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                  <Route className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('result.total_distance', 'Total Distance')}</p>
                    <p className="text-2xl font-bold text-cyan-400 font-mono">{cvrpResult.total_distance?.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('result.vehicles_used', 'Vehicles Used')}</p>
                    <p className="text-2xl font-bold text-emerald-400 font-mono">{cvrpResult.vehicles_used} / {numVehicles}</p>
                  </div>
                </div>
              </div>

              {/* Routes table */}
              {cvrpResult.routes && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.routes', 'Route Details')}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-800">
                        <th className="text-left pb-2">{t('col.vehicle', 'Vehicle')}</th>
                        <th className="text-left pb-2 px-3">{t('col.stops', 'Stops')}</th>
                        <th className="text-right pb-2 px-3">{t('col.load', 'Load')}</th>
                        <th className="text-right pb-2 pl-3">{t('col.distance', 'Distance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cvrpResult.routes.map((route, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          <td className="py-2">
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ background: `${routeColor(i)}22`, color: routeColor(i) }}
                            >
                              <Truck className="w-3 h-3" />
                              V{route.vehicle}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300 text-xs">
                            Depot → {route.stops.join(' → ')} → Depot
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            <span className={route.load > vehicleCapacity ? 'text-rose-400' : 'text-slate-300'}>
                              {route.load} / {vehicleCapacity}
                            </span>
                          </td>
                          <td className="py-2 pl-3 text-right font-mono text-cyan-400">{route.distance?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Route map */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.route_map', 'Route Map')}</h3>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <CVRPMap depot={depot} customers={customers} routes={cvrpResult.routes ?? []} />
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium">{t('result.legend', 'Legend')}</p>
                    {cvrpResult.routes?.map((route, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-0.5" style={{ background: routeColor(i) }} />
                        <span style={{ color: routeColor(i) }}>Vehicle {route.vehicle}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                      <span className="text-rose-400">★</span> Depot
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Customer
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Facility Location ── */}
      {activeTab === 'facility' && (
        <div className="space-y-6">
          {/* Facilities table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                {t('logistics.candidate_facilities', 'Candidate Facilities')}
              </h3>
              <button
                onClick={addFacility}
                className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg px-3 py-1 transition-colors"
              >
                + {t('logistics.add_facility', 'Add Facility')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-3">{t('col.name', 'Name')}</th>
                    <th className="text-right pb-2 px-3">{t('col.x', 'X')}</th>
                    <th className="text-right pb-2 px-3">{t('col.y', 'Y')}</th>
                    <th className="text-right pb-2 px-3">{t('col.fixed_cost', 'Fixed Cost (\$)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.capacity', 'Capacity')}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((f, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50">
                      {(['name', 'x', 'y', 'fixed_cost', 'capacity'] as (keyof Facility)[]).map((field) => (
                        <td key={field} className={`py-1.5 ${field === 'name' ? 'pr-3' : 'px-3'}`}>
                          <input
                            type={field === 'name' ? 'text' : 'number'}
                            value={f[field]}
                            onChange={(e) => handleFacilityChange(idx, field, e.target.value)}
                            className={`w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 ${field !== 'name' ? 'text-right' : ''}`}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeFacility(idx)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded hover:bg-rose-500/10">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customers (FL) table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" />
                {t('logistics.customers', 'Customers')}
              </h3>
              <button
                onClick={addCustomerFL}
                className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg px-3 py-1 transition-colors"
              >
                + {t('logistics.add_customer', 'Add Customer')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-3">{t('col.name', 'Name')}</th>
                    <th className="text-right pb-2 px-3">{t('col.x', 'X')}</th>
                    <th className="text-right pb-2 px-3">{t('col.y', 'Y')}</th>
                    <th className="text-right pb-2 px-3">{t('col.demand', 'Demand')}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {customersFL.map((c, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50">
                      {(['name', 'x', 'y', 'demand'] as (keyof Customer)[]).map((field) => (
                        <td key={field} className={`py-1.5 ${field === 'name' ? 'pr-3' : 'px-3'}`}>
                          <input
                            type={field === 'name' ? 'text' : 'number'}
                            value={c[field]}
                            onChange={(e) => handleCustomerFLChange(idx, field, e.target.value)}
                            className={`w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 ${field !== 'name' ? 'text-right' : ''}`}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeCustomerFL(idx)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded hover:bg-rose-500/10">✕</button>
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
              onClick={solveFL}
              disabled={flLoading}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {flLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {flLoading ? t('solving', 'Solving…') : t('solve', 'Solve')}
            </button>
            <button
              onClick={resetFL}
              className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset', 'Reset')}
            </button>
          </div>

          {/* Error */}
          {flError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
              {flError}
            </div>
          )}

          {/* Results */}
          {flResult && (
            <div className="space-y-4">
              {/* Cost summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('result.total_cost', 'Total Cost')}</p>
                    <p className="text-2xl font-bold text-cyan-400 font-mono">\${flResult.total_cost?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">{t('result.fixed_cost', 'Fixed Cost')}</p>
                  <p className="text-xl font-bold text-slate-200 font-mono">\${flResult.total_fixed_cost?.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">{t('result.service_cost', 'Service Cost')}</p>
                  <p className="text-xl font-bold text-slate-200 font-mono">\${flResult.total_service_cost?.toLocaleString()}</p>
                </div>
              </div>

              {/* Selected facilities */}
              {flResult.selected_facilities && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.selected_facilities', 'Selected Facilities')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {flResult.selected_facilities.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        {f}
                      </span>
                    ))}
                    {facilities
                      .filter((f) => !flResult.selected_facilities.includes(f.name))
                      .map((f) => (
                        <span key={f.name} className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-500 text-xs font-medium px-3 py-1.5 rounded-full line-through">
                          {f.name}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Assignments table */}
              {flResult.assignments && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.assignments', 'Customer Assignments')}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-800">
                        <th className="text-left pb-2">{t('col.customer', 'Customer')}</th>
                        <th className="text-left pb-2 px-3">{t('col.assigned_facility', 'Assigned Facility')}</th>
                        <th className="text-right pb-2 pl-3">{t('col.distance', 'Distance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flResult.assignments.map((asgn, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          <td className="py-1.5 text-slate-300">{asgn.customer}</td>
                          <td className="py-1.5 px-3">
                            <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              {asgn.facility}
                            </span>
                          </td>
                          <td className="py-1.5 pl-3 text-right font-mono text-cyan-400">{asgn.distance?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Coverage map */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.coverage_map', 'Coverage Map')}</h3>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <FacilityMap
                    facilities={facilities}
                    customers={customersFL}
                    selectedFacilities={flResult.selected_facilities ?? []}
                    assignments={flResult.assignments ?? []}
                  />
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium">{t('result.legend', 'Legend')}</p>
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Selected facility
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-block w-3 h-3 rounded-sm bg-slate-600" /> Unused facility
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Customer
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-500/60">
                      <span className="text-emerald-500">─ ─</span> Assignment
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
