import React, { useState } from 'react';
import { api } from '../services/api';
import { FileText, FileSpreadsheet, Download, CheckCircle2, ShieldCheck } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [downloading, setDownloading] = useState(false);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);

  const sampleReportData = {
    title: "Quarterly Industrial Production Optimization",
    category: "Linear Programming",
    solver_name: "HiGHS 1.16 Dual Simplex",
    status: "OPTIMAL",
    objective_value: 2160.0,
    execution_time_sec: 0.0034,
    mathematical_summary: "Optimal solution mathematically proven via HiGHS. Primal-dual gap: 0.00e+00. All active constraints satisfied within 1e-07 numerical tolerance.",
    variable_values: {
      "Product_A_Units": 42.0,
      "Product_B_Units": 16.0
    },
    reduced_costs: {
      "Product_A_Units": 0.0,
      "Product_B_Units": 0.0
    },
    variable_basis_status: {
      "Product_A_Units": "BASIC",
      "Product_B_Units": "BASIC"
    },
    validation_report: {
      is_valid: true,
      max_constraint_violation: 0.0,
      max_bound_violation: 0.0,
      is_feasible: true,
      is_optimal_proven: true
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const blob = await api.exportPDF(sampleReportData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "OptiVerse_Audit_Report.pdf";
      a.click();
      setLastDownloaded("PDF Audit Report generated & downloaded successfully.");
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const blob = await api.exportExcel(sampleReportData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "OptiVerse_Audit_Report.xlsx";
      a.click();
      setLastDownloaded("Excel Audit Spreadsheet generated & downloaded successfully.");
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <FileText className="w-6 h-6 text-rose-400" />
          <h1 className="text-2xl font-extrabold text-white">Reports & Scientific Auditing Center</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Generate publication-ready PDF audit reports and multi-tab Excel workbooks containing complete mathematical formulations, shadow prices, and independent constraint evaluations.
        </p>
      </div>

      {lastDownloaded && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 rtl:space-x-reverse">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{lastDownloaded}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-white">Executive PDF Audit Document</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Publication-grade PDF generated via ReportLab containing the executive summary, mathematical equations, optimal decision setpoints table, and independent verification logs.
            </p>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 rtl:space-x-reverse transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? "Generating PDF..." : "Download Official PDF Audit"}</span>
          </button>
        </div>

        {/* Excel Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-white">Scientific Excel Data Workbook</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-tab spreadsheet generated via OpenPyXL containing the metadata audit sheet, decision variable basis status, reduced costs, and constraint slack calculations.
            </p>
          </div>

          <button
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 rtl:space-x-reverse transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? "Generating Excel..." : "Download Official Excel Workbook"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
