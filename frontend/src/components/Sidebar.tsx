import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  LayoutDashboard,
  Layers,
  Sparkles,
  BookOpen,
  ShieldCheck,
  FileText,
  Sliders,
  TrendingUp,
  Share2,
  Truck,
  Box,
  Clock,
  GitBranch,
  LineChart,
  Dice5,
  Dna,
  Zap,
  Factory,
  Wheat,
  DollarSign,
  HeartPulse,
  Package
} from 'lucide-react';

interface SidebarProps {
  currentSection: string;
  onSelectSection: (section: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentSection, onSelectSection }) => {
  const { t } = useLanguage();

  const coreModules = [
    { id: 'lp', label: t('linearProgramming'), icon: Sliders },
    { id: 'milp', label: t('milp'), icon: Layers },
    { id: 'nlp', label: t('nonlinearProgramming'), icon: TrendingUp },
    { id: 'dp', label: t('dynamicProgramming'), icon: GitBranch },
    { id: 'network', label: t('networkOptimization'), icon: Share2 },
    { id: 'transport', label: t('transportationAssignment'), icon: Truck },
    { id: 'inventory', label: t('inventoryOptimization'), icon: Box },
    { id: 'queuing', label: t('queuingTheory'), icon: Clock },
    { id: 'project_mgmt', label: t('projectManagement'), icon: GitBranch },
    { id: 'forecasting', label: t('forecasting'), icon: LineChart },
    { id: 'stochastic', label: t('stochasticOptimization'), icon: Dice5 },
    { id: 'metaheuristics', label: t('metaheuristics'), icon: Dna },
  ];

  const industrySuites = [
    { id: 'energy', label: t('energyOptimization'), icon: Zap },
    { id: 'manufacturing', label: t('manufacturingOptimization'), icon: Factory },
    { id: 'agriculture', label: t('agricultureOptimization'), icon: Wheat },
    { id: 'logistics', label: t('logisticsOptimization'), icon: Package },
    { id: 'finance', label: t('financialOptimization'), icon: DollarSign },
    { id: 'healthcare', label: t('healthcareOptimization'), icon: HeartPulse },
  ];

  const toolsAndLab = [
    { id: 'model_builder', label: t('modelBuilder'), icon: Layers },
    { id: 'ai_assistant', label: t('aiAssistant'), icon: Sparkles },
    { id: 'educational', label: t('educationalCenter'), icon: BookOpen },
    { id: 'benchmarks', label: t('benchmarkSuite'), icon: ShieldCheck },
    { id: 'reports', label: t('reports'), icon: FileText },
    { id: 'solvers', label: t('solverCenter'), icon: Sliders },
  ];

  const renderNavGroup = (title: string, items: typeof coreModules) => (
    <div className="mb-6">
      <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`w-full flex items-center space-x-2.5 rtl:space-x-reverse px-3 py-2 rounded-lg text-xs font-medium transition-all text-left rtl:text-right ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950/80 backdrop-blur-sm h-[calc(100vh-4rem)] overflow-y-auto p-4 select-none">
      {/* Dashboard Shortcut */}
      <div className="mb-4">
        <button
          onClick={() => onSelectSection('dashboard')}
          className={`w-full flex items-center space-x-2.5 rtl:space-x-reverse px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            currentSection === 'dashboard'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-cyan-400" />
          <span>{t('dashboard')}</span>
        </button>
      </div>

      {renderNavGroup(t('modules'), coreModules)}
      {renderNavGroup(t('industrySuites'), industrySuites)}
      {renderNavGroup("Tools & Laboratory", toolsAndLab)}
    </aside>
  );
};
