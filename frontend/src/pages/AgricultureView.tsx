import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import {
  Play,
  RotateCcw,
  Wheat,
  Leaf,
  FlaskConical,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ingredient {
  name: string;
  cost_per_kg: number;
  protein_pct: number;
  energy_kcal: number;
  fat_pct: number;
  fiber_pct: number;
}

interface BlendRequirements {
  min_protein: number;
  min_energy: number;
  max_fat: number;
  max_fiber: number;
  batch_size: number;
}

interface BlendResultRow {
  ingredient: string;
  quantity_kg: number;
  percentage: number;
}

interface NutrientAnalysis {
  protein_pct: number;
  energy_kcal: number;
  fat_pct: number;
  fiber_pct: number;
}

interface FeedBlendResult {
  status: string;
  cost_per_kg: number;
  total_batch_cost: number;
  blend: BlendResultRow[];
  nutrient_analysis: NutrientAnalysis;
}

interface Crop {
  name: string;
  profit_per_ha: number;
  water_per_ha: number;
  labor_per_ha: number;
  min_area: number;
  max_area: number;
}

interface CropResultRow {
  crop: string;
  allocated_ha: number;
  profit: number;
}

interface ResourceUtil {
  land_pct: number;
  water_pct: number;
  labor_pct: number;
  land_used: number;
  water_used: number;
  labor_used: number;
}

interface CropPlanResult {
  status: string;
  total_profit: number;
  allocation: CropResultRow[];
  resource_utilization: ResourceUtil;
}

// ─── Default Data ────────────────────────────────────────────────────────────

const DEFAULT_INGREDIENTS: Ingredient[] = [
  { name: 'Corn',     cost_per_kg: 0.25, protein_pct: 8.5,  energy_kcal: 3300, fat_pct: 3.5, fiber_pct: 2.0 },
  { name: 'Soybean',  cost_per_kg: 0.45, protein_pct: 44.0, energy_kcal: 2500, fat_pct: 1.5, fiber_pct: 6.0 },
  { name: 'Wheat',    cost_per_kg: 0.30, protein_pct: 12.0, energy_kcal: 3100, fat_pct: 2.0, fiber_pct: 2.5 },
  { name: 'Fishmeal', cost_per_kg: 0.80, protein_pct: 65.0, energy_kcal: 2800, fat_pct: 8.0, fiber_pct: 1.0 },
];

const DEFAULT_REQUIREMENTS: BlendRequirements = {
  min_protein: 18,
  min_energy: 2800,
  max_fat: 6,
  max_fiber: 4,
  batch_size: 1000,
};

const DEFAULT_CROPS: Crop[] = [
  { name: 'Wheat',     profit_per_ha: 800,  water_per_ha: 400, labor_per_ha: 5, min_area: 10, max_area: 60 },
  { name: 'Corn',      profit_per_ha: 1200, water_per_ha: 600, labor_per_ha: 7, min_area: 5,  max_area: 40 },
  { name: 'Soybean',   profit_per_ha: 1000, water_per_ha: 450, labor_per_ha: 6, min_area: 0,  max_area: 30 },
  { name: 'Sunflower', profit_per_ha: 900,  water_per_ha: 300, labor_per_ha: 4, min_area: 0,  max_area: 25 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function UtilizationBar({ label, value, max, unit = '' }: { label: string; value: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>
          {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}{unit} / {max.toLocaleString()}{unit} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NutrientBadge({ label, value, unit, met }: { label: string; value: number; unit: string; met: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${met ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-lg font-bold font-mono ${met ? 'text-emerald-400' : 'text-rose-400'}`}>
        {value.toFixed(1)}<span className="text-xs font-normal ml-1">{unit}</span>
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const AgricultureView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'blending' | 'crop'>('blending');

  // ── Feed Blending State ────────────────────────────────────────────────────
  const [ingredients, setIngredients] = useState<Ingredient[]>(DEFAULT_INGREDIENTS);
  const [requirements, setRequirements] = useState<BlendRequirements>(DEFAULT_REQUIREMENTS);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const [fbResult, setFbResult] = useState<FeedBlendResult | null>(null);

  // ── Crop Planning State ────────────────────────────────────────────────────
  const [totalLandHa, setTotalLandHa] = useState(100);
  const [totalWaterM3, setTotalWaterM3] = useState(50000);
  const [totalLaborDays, setTotalLaborDays] = useState(500);
  const [crops, setCrops] = useState<Crop[]>(DEFAULT_CROPS);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpResult, setCpResult] = useState<CropPlanResult | null>(null);

  // ── Ingredient handlers ────────────────────────────────────────────────────
  const handleIngredientChange = (idx: number, field: keyof Ingredient, value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === idx ? { ...ing, [field]: field === 'name' ? value : parseFloat(value) || 0 } : ing
      )
    );
  };

  const addIngredient = () =>
    setIngredients((prev) => [
      ...prev,
      { name: 'New Ingredient', cost_per_kg: 0.5, protein_pct: 10, energy_kcal: 3000, fat_pct: 3, fiber_pct: 2 },
    ]);

  const removeIngredient = (idx: number) => setIngredients((prev) => prev.filter((_, i) => i !== idx));

  const handleRequirementChange = (field: keyof BlendRequirements, value: string) =>
    setRequirements((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));

  const solveFB = async () => {
    setFbLoading(true);
    setFbError(null);
    setFbResult(null);
    try {
      const result = await api.solveAgriculture({
        problem_type: 'feed_blending',
        ingredients,
        requirements,
      });
      setFbResult(result as FeedBlendResult);
    } catch (err: unknown) {
      setFbError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setFbLoading(false);
    }
  };

  const resetFB = () => {
    setIngredients(DEFAULT_INGREDIENTS);
    setRequirements(DEFAULT_REQUIREMENTS);
    setFbResult(null);
    setFbError(null);
  };

  // ── Crop handlers ──────────────────────────────────────────────────────────
  const handleCropChange = (idx: number, field: keyof Crop, value: string) => {
    setCrops((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, [field]: field === 'name' ? value : parseFloat(value) || 0 } : c
      )
    );
  };

  const addCrop = () =>
    setCrops((prev) => [
      ...prev,
      { name: 'New Crop', profit_per_ha: 800, water_per_ha: 400, labor_per_ha: 5, min_area: 0, max_area: 20 },
    ]);

  const removeCrop = (idx: number) => setCrops((prev) => prev.filter((_, i) => i !== idx));

  const solveCP = async () => {
    setCpLoading(true);
    setCpError(null);
    setCpResult(null);
    try {
      const result = await api.solveAgriculture({
        problem_type: 'crop_planning',
        total_land_ha: totalLandHa,
        total_water_m3: totalWaterM3,
        total_labor_days: totalLaborDays,
        crops,
      });
      setCpResult(result as CropPlanResult);
    } catch (err: unknown) {
      setCpError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCpLoading(false);
    }
  };

  const resetCP = () => {
    setCrops(DEFAULT_CROPS);
    setTotalLandHa(100);
    setTotalWaterM3(50000);
    setTotalLaborDays(500);
    setCpResult(null);
    setCpError(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Wheat className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('agriculture.title', 'Agriculture Optimization')}</h1>
          <p className="text-sm text-slate-400">{t('agriculture.subtitle', 'Feed blending and crop planning with LP')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('blending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'blending'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          {t('agriculture.tab.blending', 'Feed/Diet Blending')}
        </button>
        <button
          onClick={() => setActiveTab('crop')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'crop'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Leaf className="w-4 h-4" />
          {t('agriculture.tab.crop', 'Crop Planning')}
        </button>
      </div>

      {/* ── Tab 1: Feed Blending ── */}
      {activeTab === 'blending' && (
        <div className="space-y-6">
          {/* Ingredients table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-400" />
                {t('agriculture.ingredients', 'Ingredients')}
              </h3>
              <button
                onClick={addIngredient}
                className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg px-3 py-1 transition-colors"
              >
                + {t('agriculture.add_ingredient', 'Add Ingredient')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-3">{t('col.name', 'Name')}</th>
                    <th className="text-right pb-2 px-3">{t('col.cost_kg', 'Cost/kg (\$)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.protein', 'Protein (%)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.energy', 'Energy (kcal)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.fat', 'Fat (%)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.fiber', 'Fiber (%)')}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50">
                      {(['name', 'cost_per_kg', 'protein_pct', 'energy_kcal', 'fat_pct', 'fiber_pct'] as (keyof Ingredient)[]).map((field) => (
                        <td key={field} className={`py-1.5 ${field === 'name' ? 'pr-3' : 'px-3'}`}>
                          <input
                            type={field === 'name' ? 'text' : 'number'}
                            value={ing[field]}
                            step={field === 'cost_per_kg' ? '0.01' : field === 'energy_kcal' ? '10' : '0.1'}
                            onChange={(e) => handleIngredientChange(idx, field, e.target.value)}
                            className={`w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 ${field !== 'name' ? 'text-right' : ''}`}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeIngredient(idx)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded hover:bg-rose-500/10">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('agriculture.requirements', 'Nutritional Requirements')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { field: 'min_protein' as keyof BlendRequirements, label: 'Min Protein (%)', step: '0.1' },
                { field: 'min_energy' as keyof BlendRequirements, label: 'Min Energy (kcal)', step: '10' },
                { field: 'max_fat' as keyof BlendRequirements, label: 'Max Fat (%)', step: '0.1' },
                { field: 'max_fiber' as keyof BlendRequirements, label: 'Max Fiber (%)', step: '0.1' },
                { field: 'batch_size' as keyof BlendRequirements, label: 'Batch Size (kg)', step: '100' },
              ].map(({ field, label, step }) => (
                <div key={field}>
                  <label className="text-xs text-slate-400 block mb-1">{t(`agriculture.req.${field}`, label)}</label>
                  <input
                    type="number"
                    step={step}
                    value={requirements[field]}
                    onChange={(e) => handleRequirementChange(field, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={solveFB}
              disabled={fbLoading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {fbLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {fbLoading ? t('solving', 'Solving…') : t('solve', 'Solve')}
            </button>
            <button
              onClick={resetFB}
              className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset', 'Reset')}
            </button>
          </div>

          {/* Error */}
          {fbError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
              {fbError}
            </div>
          )}

          {/* Results */}
          {fbResult && (
            <div className="space-y-4">
              {/* Cost summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('result.cost_per_kg', 'Cost per kg')}</p>
                    <p className="text-2xl font-bold text-emerald-400 font-mono">\${fbResult.cost_per_kg?.toFixed(4)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-slate-400">{t('result.total_batch_cost', 'Total Batch Cost')}</p>
                    <p className="text-2xl font-bold text-cyan-400 font-mono">\${fbResult.total_batch_cost?.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{requirements.batch_size} kg batch</p>
                  </div>
                </div>
              </div>

              {/* Blend composition */}
              {fbResult.blend && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.blend_composition', 'Blend Composition')}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-800">
                        <th className="text-left pb-2">{t('col.ingredient', 'Ingredient')}</th>
                        <th className="text-right pb-2 px-3">{t('col.quantity_kg', 'Quantity (kg)')}</th>
                        <th className="text-right pb-2 pl-3">{t('col.percentage', 'Percentage (%)')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fbResult.blend.map((row, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          <td className="py-1.5 text-slate-300">{row.ingredient}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-cyan-400">{row.quantity_kg?.toFixed(2)}</td>
                          <td className="py-1.5 pl-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.min(100, row.percentage)}%` }}
                                />
                              </div>
                              <span className="font-mono text-emerald-400 w-12 text-right">{row.percentage?.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Nutrient analysis */}
              {fbResult.nutrient_analysis && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.nutrient_analysis', 'Nutrient Analysis')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <NutrientBadge
                      label={t('col.protein', 'Protein')}
                      value={fbResult.nutrient_analysis.protein_pct}
                      unit="%"
                      met={fbResult.nutrient_analysis.protein_pct >= requirements.min_protein}
                    />
                    <NutrientBadge
                      label={t('col.energy', 'Energy')}
                      value={fbResult.nutrient_analysis.energy_kcal}
                      unit="kcal"
                      met={fbResult.nutrient_analysis.energy_kcal >= requirements.min_energy}
                    />
                    <NutrientBadge
                      label={t('col.fat', 'Fat')}
                      value={fbResult.nutrient_analysis.fat_pct}
                      unit="%"
                      met={fbResult.nutrient_analysis.fat_pct <= requirements.max_fat}
                    />
                    <NutrientBadge
                      label={t('col.fiber', 'Fiber')}
                      value={fbResult.nutrient_analysis.fiber_pct}
                      unit="%"
                      met={fbResult.nutrient_analysis.fiber_pct <= requirements.max_fiber}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Crop Planning ── */}
      {activeTab === 'crop' && (
        <div className="space-y-6">
          {/* Resource constraints */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-400" />
              {t('agriculture.resource_constraints', 'Resource Constraints')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('agriculture.total_land', 'Total Land (ha)')}</label>
                <input
                  type="number"
                  value={totalLandHa}
                  onChange={(e) => setTotalLandHa(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('agriculture.total_water', 'Total Water (m³)')}</label>
                <input
                  type="number"
                  step="1000"
                  value={totalWaterM3}
                  onChange={(e) => setTotalWaterM3(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('agriculture.total_labor', 'Total Labor (days)')}</label>
                <input
                  type="number"
                  value={totalLaborDays}
                  onChange={(e) => setTotalLaborDays(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Crops table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">{t('agriculture.crops', 'Crops')}</h3>
              <button
                onClick={addCrop}
                className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg px-3 py-1 transition-colors"
              >
                + {t('agriculture.add_crop', 'Add Crop')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-3">{t('col.name', 'Name')}</th>
                    <th className="text-right pb-2 px-3">{t('col.profit_ha', 'Profit/ha (\$)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.water_ha', 'Water/ha (m³)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.labor_ha', 'Labor/ha (days)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.min_area', 'Min Area (ha)')}</th>
                    <th className="text-right pb-2 px-3">{t('col.max_area', 'Max Area (ha)')}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {crops.map((crop, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50">
                      {(['name', 'profit_per_ha', 'water_per_ha', 'labor_per_ha', 'min_area', 'max_area'] as (keyof Crop)[]).map((field) => (
                        <td key={field} className={`py-1.5 ${field === 'name' ? 'pr-3' : 'px-3'}`}>
                          <input
                            type={field === 'name' ? 'text' : 'number'}
                            value={crop[field]}
                            step={field === 'water_per_ha' ? '10' : '1'}
                            onChange={(e) => handleCropChange(idx, field, e.target.value)}
                            className={`w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 ${field !== 'name' ? 'text-right' : ''}`}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeCrop(idx)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded hover:bg-rose-500/10">✕</button>
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
              onClick={solveCP}
              disabled={cpLoading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {cpLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {cpLoading ? t('solving', 'Solving…') : t('solve', 'Solve')}
            </button>
            <button
              onClick={resetCP}
              className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset', 'Reset')}
            </button>
          </div>

          {/* Error */}
          {cpError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
              {cpError}
            </div>
          )}

          {/* Results */}
          {cpResult && (
            <div className="space-y-4">
              {/* Total profit */}
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">{t('result.total_profit', 'Total Profit')}</p>
                  <p className="text-2xl font-bold text-emerald-400">\${cpResult.total_profit?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
              </div>

              {/* Allocation table */}
              {cpResult.allocation && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.optimal_allocation', 'Optimal Allocation')}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-800">
                        <th className="text-left pb-2">{t('col.crop', 'Crop')}</th>
                        <th className="text-right pb-2 px-3">{t('col.allocated_ha', 'Allocated (ha)')}</th>
                        <th className="text-right pb-2 pl-3">{t('col.profit', 'Profit (\$)')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cpResult.allocation.map((row, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          <td className="py-1.5 text-slate-300">{row.crop}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-cyan-400">{row.allocated_ha?.toFixed(2)}</td>
                          <td className="py-1.5 pl-3 text-right font-mono text-emerald-400">
                            \${row.profit?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Resource utilization */}
              {cpResult.resource_utilization && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('result.resource_utilization', 'Resource Utilization')}</h3>
                  <UtilizationBar
                    label={t('agriculture.total_land', 'Land')}
                    value={cpResult.resource_utilization.land_used}
                    max={totalLandHa}
                    unit=" ha"
                  />
                  <UtilizationBar
                    label={t('agriculture.total_water', 'Water')}
                    value={cpResult.resource_utilization.water_used}
                    max={totalWaterM3}
                    unit=" m³"
                  />
                  <UtilizationBar
                    label={t('agriculture.total_labor', 'Labor')}
                    value={cpResult.resource_utilization.labor_used}
                    max={totalLaborDays}
                    unit=" days"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
