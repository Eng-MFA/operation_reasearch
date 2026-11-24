from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from app.reports.pdf_generator import PDFReportGenerator
from app.reports.excel_generator import ExcelReportGenerator

router = APIRouter(prefix="/reports", tags=["Reports & Auditing"])

class ReportExportRequest(BaseModel):
    title: str = "Optimization Run Report"
    category: str = "Linear Programming"
    solver_name: str = "HiGHS 1.16"
    status: str = "OPTIMAL"
    objective_value: float = 0.0
    execution_time_sec: float = 0.0
    mathematical_summary: str = ""
    variable_values: Dict[str, float] = {}
    reduced_costs: Dict[str, float] = {}
    variable_basis_status: Dict[str, str] = {}
    validation_report: Dict[str, Any] = {}

@router.post("/export-pdf")
def export_pdf_report(req: ReportExportRequest):
    try:
        pdf_bytes = PDFReportGenerator.generate_report(req.model_dump())
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=OptiVerse_Report_{req.status}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")

@router.post("/export-excel")
def export_excel_report(req: ReportExportRequest):
    try:
        xlsx_bytes = ExcelReportGenerator.generate_report(req.model_dump())
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=OptiVerse_Report_{req.status}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation error: {str(e)}")
