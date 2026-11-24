import io
from typing import Dict, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

class ExcelReportGenerator:
    """
    Generates multi-tab formatted Excel audit reports with numerical calculations and metadata.
    """

    @classmethod
    def generate_report(cls, report_data: Dict[str, Any]) -> bytes:
        wb = openpyxl.Workbook()

        # Sheet 1: Summary
        ws_sum = wb.active
        ws_sum.title = "Summary"

        header_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
        section_font = Font(name="Calibri", size=11, bold=True, color="1E293B")
        regular_font = Font(name="Calibri", size=10)

        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        accent_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

        # Title
        ws_sum.merge_cells("A1:D1")
        ws_sum["A1"] = f"OptiVerse Optimization Report - {report_data.get('title', 'Project')}"
        ws_sum["A1"].font = header_font
        ws_sum["A1"].fill = header_fill
        ws_sum["A1"].alignment = Alignment(horizontal="center", vertical="center")
        ws_sum.row_dimensions[1].height = 30

        metadata = [
            ("Solver Engine", report_data.get("solver_name", "HiGHS")),
            ("Solver Status", report_data.get("status", "OPTIMAL")),
            ("Optimal Objective Value", report_data.get("objective_value", 0.0)),
            ("Execution Time (sec)", report_data.get("execution_time_sec", 0.0)),
            ("Mathematical Summary", report_data.get("mathematical_summary", ""))
        ]

        row_idx = 3
        for label, val in metadata:
            ws_sum.cell(row=row_idx, column=1, value=label).font = section_font
            ws_sum.cell(row=row_idx, column=1).fill = accent_fill
            ws_sum.cell(row=row_idx, column=2, value=str(val)).font = regular_font
            row_idx += 1

        # Sheet 2: Decision Variables
        var_values = report_data.get("variable_values", {})
        if var_values:
            ws_vars = wb.create_sheet(title="Variables")
            ws_vars.append(["Variable Name", "Optimal Value", "Reduced Cost", "Basis Status"])
            for cell in ws_vars[1]:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = header_fill

            red_costs = report_data.get("reduced_costs", {})
            basis_status = report_data.get("variable_basis_status", {})

            for v, val in var_values.items():
                rc = red_costs.get(v, 0.0)
                bs = basis_status.get(v, "BASIC" if abs(val) > 1e-5 else "NONBASIC")
                ws_vars.append([v, val, rc, bs])

        # Auto-adjust column widths
        for sheet in wb.worksheets:
            for col in sheet.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = openpyxl.utils.get_column_letter(col[0].column)
                sheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()
