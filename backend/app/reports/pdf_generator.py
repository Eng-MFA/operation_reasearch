import io
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class PDFReportGenerator:
    """
    Generates publication-quality PDF audit reports for optimization runs
    with mathematical formulations, optimal setpoints, and validation tables.
    """

    @classmethod
    def generate_report(cls, report_data: Dict[str, Any]) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Title"],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1e293b"),
            alignment=0
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#64748b")
        )
        heading_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=14,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            "ReportBody",
            parent=styles["BodyText"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155")
        )
        code_style = ParagraphStyle(
            "CodeBlock",
            parent=styles["Code"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0284c7")
        )

        story = []

        # Title Banner
        story.append(Paragraph("OptiVerse Optimization Audit Report", title_style))
        story.append(Spacer(1, 4))
        proj_name = report_data.get("title", "Mathematical Optimization Run")
        story.append(Paragraph(f"Project: <b>{proj_name}</b> | Generated on 2026-11-22", subtitle_style))
        story.append(Spacer(1, 15))

        # Executive Summary Box
        solver_name = report_data.get("solver_name", "HiGHS / SciPy")
        status = report_data.get("status", "OPTIMAL")
        obj_val = report_data.get("objective_value", 0.0)
        exec_time = report_data.get("execution_time_sec", 0.0)

        summary_table_data = [
            [Paragraph("<b>Status:</b>", body_style), Paragraph(f"<font color='#059669'><b>{status}</b></font>", body_style),
             Paragraph("<b>Optimal Objective:</b>", body_style), Paragraph(f"<b>{obj_val:,.4f}</b>", body_style)],
            [Paragraph("<b>Solver Engine:</b>", body_style), Paragraph(solver_name, body_style),
             Paragraph("<b>Execution Time:</b>", body_style), Paragraph(f"{exec_time*1000:.2f} ms", body_style)]
        ]
        summary_table = Table(summary_table_data, colWidths=[110, 150, 130, 140])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 15))

        # Mathematical Summary
        math_summary = report_data.get("mathematical_summary", "")
        if math_summary:
            story.append(Paragraph("Executive Summary & Scientific Interpretation", heading_style))
            story.append(Paragraph(math_summary, body_style))
            story.append(Spacer(1, 10))

        # Optimal Decision Variables Table
        var_values = report_data.get("variable_values", {})
        if var_values:
            story.append(Paragraph("Optimal Decision Variables", heading_style))
            var_rows = [["Decision Variable", "Optimal Value", "Reduced Cost", "Basis Status"]]
            red_costs = report_data.get("reduced_costs", {})
            basis_status = report_data.get("variable_basis_status", {})

            for v, val in var_values.items():
                rc = red_costs.get(v, 0.0)
                bs = basis_status.get(v, "BASIC" if abs(val) > 1e-5 else "NONBASIC")
                var_rows.append([v, f"{val:.6g}", f"{rc:.6g}", bs])

            var_table = Table(var_rows, colWidths=[160, 130, 120, 120])
            var_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")])
            ]))
            story.append(var_table)
            story.append(Spacer(1, 15))

        # Independent Validation Report
        val_report = report_data.get("validation_report", {})
        if val_report:
            story.append(Paragraph("Independent Verification & Validation Audit", heading_style))
            is_valid = val_report.get("is_valid", True)
            val_text = f"Independent Validation Engine Result: <b>{'PASSED' if is_valid else 'FAILED'}</b>. "
            val_text += f"Maximum constraint violation: {val_report.get('max_constraint_violation', 0.0):.2e}. "
            val_text += f"Maximum bound violation: {val_report.get('max_bound_violation', 0.0):.2e}. "
            story.append(Paragraph(val_text, body_style))
            story.append(Spacer(1, 8))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
