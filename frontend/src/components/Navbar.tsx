import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Cpu, 
  Languages, 
  CheckCircle2, 
  BookOpen, 
  ShieldCheck, 
  Layers,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  onNavigate: (section: string) => void;
  activeSection: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, activeSection }) => {
  const { language, setLanguage, t, isRTL } = useLanguage();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3 rtl:space-x-reverse cursor-pointer" onClick={() => onNavigate('dashboard')}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Cpu className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <span className="font-bold text-lg tracking-tight text-white">Opti<span className="text-cyan-400">Verse</span></span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v2.0 SciEng
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            {t('platformSubtitle')}
          </p>
        </div>
      </div>

      {/* Center Actions / Quick Jump */}
      <div className="hidden lg:flex items-center space-x-1 rtl:space-x-reverse bg-slate-950/60 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeSection === 'dashboard'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          {t('dashboard')}
        </button>
        <button
          onClick={() => onNavigate('model_builder')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 rtl:space-x-reverse ${
            activeSection === 'model_builder'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t('modelBuilder')}</span>
        </button>
        <button
          onClick={() => onNavigate('ai_assistant')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 rtl:space-x-reverse ${
            activeSection === 'ai_assistant'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{t('aiAssistant')}</span>
        </button>
        <button
          onClick={() => onNavigate('benchmarks')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 rtl:space-x-reverse ${
            activeSection === 'benchmarks'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('benchmarkSuite')}</span>
        </button>
      </div>

      {/* Right Tools: Solver Health & Language Toggle */}
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        {/* Active Solver Badge */}
        <div 
          onClick={() => onNavigate('solvers')} 
          className="hidden md:flex items-center space-x-2 rtl:space-x-reverse px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium cursor-pointer hover:bg-emerald-500/15 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>HiGHS 1.16 & CP-SAT Active</span>
        </div>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold transition-colors"
          title="Toggle Language / تغيير اللغة"
        >
          <Languages className="w-4 h-4 text-cyan-400" />
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>
    </header>
  );
};
