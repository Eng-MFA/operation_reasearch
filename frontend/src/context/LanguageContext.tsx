import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';

interface Translations {
  [key: string]: {
    en: string;
    ar: string;
  };
}

export const translations: Translations = {
  platformTitle: {
    en: "OptiVerse Optimization",
    ar: "منصة أوبتي فيرس لبحوث العمليات"
  },
  platformSubtitle: {
    en: "Universal Operations Research & Mathematical Optimization Platform",
    ar: "المنصة الشاملة لبحوث العمليات والتحسين الرياضي"
  },
  dashboard: { en: "Dashboard", ar: "لوحة التحكم" },
  modules: { en: "Core OR Modules", ar: "نماذج بحوث العمليات" },
  industrySuites: { en: "Industry Applications", ar: "التطبيقات الصناعية" },
  modelBuilder: { en: "Model Builder", ar: "باني النماذج الرياضية" },
  aiAssistant: { en: "AI Problem Assistant", ar: "مساعد الصياغة الذكي" },
  educationalCenter: { en: "Educational Center", ar: "المركز التعليمي" },
  benchmarkSuite: { en: "Benchmark Suite", ar: "حزمة المقارنة المعيارية" },
  reports: { en: "Reports & Auditing", ar: "التقارير والتدقيق" },
  solverCenter: { en: "Solver Center", ar: "مركز المولدات الرياضية" },
  
  // Modules
  linearProgramming: { en: "Linear Programming (LP)", ar: "البرمجة الخطية" },
  milp: { en: "Mixed-Integer Programming", ar: "البرمجة الصحيحة والمختلطة" },
  nonlinearProgramming: { en: "Nonlinear Programming (NLP)", ar: "البرمجة غير الخطية" },
  dynamicProgramming: { en: "Dynamic Programming (DP)", ar: "البرمجة الديناميكية" },
  networkOptimization: { en: "Network Optimization", ar: "تحسين الشبكات والممرات" },
  transportationAssignment: { en: "Transportation & Assignment", ar: "مسائل النقل والتعيين" },
  inventoryOptimization: { en: "Inventory Optimization", ar: "تحسين المخزون وسلاسل التوريد" },
  queuingTheory: { en: "Queuing Theory", ar: "نظرية صفوف الانتظار" },
  projectManagement: { en: "Project Management (CPM/PERT)", ar: "إدارة المشاريع (المسار الحرج)" },
  forecasting: { en: "Forecasting & Time Series", ar: "التنبؤ والسلاسل الزمنية" },
  stochasticOptimization: { en: "Stochastic & Robust OR", ar: "التحسين الاحتمالي والصلب" },
  metaheuristics: { en: "Metaheuristics (GA, PSO, SA)", ar: "الخوارزميات التوجيهية الذكية" },

  // Industry
  energyOptimization: { en: "Energy & Power Systems", ar: "هندسة الطاقة والأنظمة الكهربائية" },
  manufacturingOptimization: { en: "Manufacturing & Job Shop", ar: "الصناعة وجدولة خطوط الإنتاج" },
  agricultureOptimization: { en: "Agriculture & Food Blending", ar: "الزراعة وخلط الأعلاف الغذائية" },
  logisticsOptimization: { en: "Logistics & Fleet Routing", ar: "اللوجستيات وتوجيه الأساطيل" },
  financialOptimization: { en: "Financial Portfolio (Markowitz)", ar: "المحافظ المالية والاستثمار" },
  healthcareOptimization: { en: "Healthcare & Staff Rostering", ar: "الرعاية الصحية وجدولة الأطباء" },

  // Actions
  solve: { en: "Execute Mathematical Solver", ar: "تشغيل الحل الرياضي" },
  solving: { en: "Executing Exact Solver...", ar: "جاري الحل الرياضي الدقيق..." },
  reset: { en: "Reset Defaults", ar: "استعادة الافتراضي" },
  exportPdf: { en: "Export PDF Audit Report", ar: "تصدير تقرير PDF معتمد" },
  exportExcel: { en: "Export Excel Audit", ar: "تصدير جدول Excel" },
  verifiedOptimal: { en: "Mathematically Verified Optimal", ar: "حل أمثل مثبت رياضياً" },
  feasibilityPassed: { en: "Feasibility Check Passed", ar: "اجتاز فحص التحقق من القيود" },
  objectiveValue: { en: "Optimal Objective Value", ar: "قيمة دالة الهدف المثلى" },
  executionTime: { en: "Execution Time", ar: "زمن الحساب" },
  solverUsed: { en: "Solver Engine", ar: "المولد الرياضي" },
  sensitivityAnalysis: { en: "Sensitivity Analysis", ar: "تحليل الحساسية" },
  shadowPrices: { en: "Shadow Prices (Dual Multipliers)", ar: "أسعار الظل (المضاعفات الثنائية)" },
  reducedCosts: { en: "Reduced Costs", ar: "التكاليف المخفضة" },
  variableValues: { en: "Decision Variables", ar: "متغيرات القرار" },
  graphicalMethod: { en: "2D Graphical Geometry", ar: "الهندسة البيانية ثنائية الأبعاد" },
  statusOptimal: { en: "Optimal Solution Found", ar: "تم العثور على الحل الأمثل" },
  statusFeasible: { en: "Feasible Solution Found", ar: "تم العثور على حل متاح" },
  statusInfeasible: { en: "Model Infeasible", ar: "النموذج غير قابل للحل" }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
  isRTL: false,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const t = (key: string, fallback?: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'font-cairo' : 'font-sans'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
