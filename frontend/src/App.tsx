import { useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './pages/DashboardView';
import { LinearProgrammingView } from './pages/LinearProgrammingView';
import { MILPView } from './pages/MILPView';
import { NonlinearView } from './pages/NonlinearView';
import { DynamicProgrammingView } from './pages/DynamicProgrammingView';
import { NetworkOptimizationView } from './pages/NetworkOptimizationView';
import { TransportationView } from './pages/TransportationView';
import { InventoryOptimizationView } from './pages/InventoryOptimizationView';
import { QueuingTheoryView } from './pages/QueuingTheoryView';
import { ProjectManagementView } from './pages/ProjectManagementView';
import { ForecastingView } from './pages/ForecastingView';
import { StochasticView } from './pages/StochasticView';
import { MetaheuristicsView } from './pages/MetaheuristicsView';
import { EnergyOptimizationView } from './pages/EnergyOptimizationView';
import { ManufacturingView } from './pages/ManufacturingView';
import { AgricultureView } from './pages/AgricultureView';
import { LogisticsView } from './pages/LogisticsView';
import { FinanceView } from './pages/FinanceView';
import { HealthcareView } from './pages/HealthcareView';
import { ModelBuilderView } from './pages/ModelBuilderView';
import { AIAssistantView } from './pages/AIAssistantView';
import { EducationalCenterView } from './pages/EducationalCenterView';
import { BenchmarkSuiteView } from './pages/BenchmarkSuiteView';
import { ReportsView } from './pages/ReportsView';
import { SolversView } from './pages/SolversView';

function AppInner() {
  const [currentSection, setCurrentSection] = useState('dashboard');

  const renderPage = () => {
    switch (currentSection) {
      case 'dashboard':      return <DashboardView onNavigate={setCurrentSection} />;
      case 'lp':             return <LinearProgrammingView />;
      case 'milp':           return <MILPView />;
      case 'nlp':            return <NonlinearView />;
      case 'dp':             return <DynamicProgrammingView />;
      case 'network':        return <NetworkOptimizationView />;
      case 'transport':      return <TransportationView />;
      case 'inventory':      return <InventoryOptimizationView />;
      case 'queuing':        return <QueuingTheoryView />;
      case 'project_mgmt':   return <ProjectManagementView />;
      case 'forecasting':    return <ForecastingView />;
      case 'stochastic':     return <StochasticView />;
      case 'metaheuristics': return <MetaheuristicsView />;
      case 'energy':         return <EnergyOptimizationView />;
      case 'manufacturing':  return <ManufacturingView />;
      case 'agriculture':    return <AgricultureView />;
      case 'logistics':      return <LogisticsView />;
      case 'finance':        return <FinanceView />;
      case 'healthcare':     return <HealthcareView />;
      case 'model_builder':  return <ModelBuilderView />;
      case 'ai_assistant':   return <AIAssistantView onNavigate={setCurrentSection} />;
      case 'educational':    return <EducationalCenterView />;
      case 'benchmarks':     return <BenchmarkSuiteView />;
      case 'reports':        return <ReportsView />;
      case 'solvers':        return <SolversView />;
      default:               return <DashboardView onNavigate={setCurrentSection} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      <Navbar onNavigate={setCurrentSection} activeSection={currentSection} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentSection={currentSection} onSelectSection={setCurrentSection} />
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  );
}
