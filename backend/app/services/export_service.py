from datetime import datetime
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from ..models import Transaction


def excel_report(transactions: list[Transaction]) -> BytesIO:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Transactions"
    headers = ["Payer name", "Transaction ID", "Transaction date", "Amount", "Payment method", "Reference number"]
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    total = Decimal("0")
    for item in transactions:
        sheet.append([
            item.payer_name,
            item.transaction_id,
            item.transaction_date.isoformat(),
            float(item.amount),
            item.payment_method,
            item.reference_number,
        ])
        total += Decimal(item.amount)
    sheet.append([])
    sheet.append(["Total collection", "", "", float(total), "", ""])
    sheet.append(["Transaction count", len(transactions)])
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def pdf_report(transactions: list[Transaction], date_from: datetime | None = None, date_to: datetime | None = None) -> BytesIO:
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Payment Collection Report", styles["Title"]),
        Paragraph(f"Report generation date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]),
        Spacer(1, 12),
    ]
    if date_from or date_to:
        story.append(Paragraph(f"Selected date range: {date_from or 'Start'} to {date_to or 'End'}", styles["Normal"]))
    total = sum((Decimal(item.amount) for item in transactions), Decimal("0"))
    payers = {" ".join(item.payer_name.casefold().split()) for item in transactions if item.payer_name}
    story.extend([
        Paragraph(f"Total amount collected: {total:.2f}", styles["Normal"]),
        Paragraph(f"Total number of transactions: {len(transactions)}", styles["Normal"]),
        Paragraph(f"Number of unique payers: {len(payers)}", styles["Normal"]),
        Spacer(1, 12),
    ])
    table_data = [["Payer", "Txn ID", "Date", "Amount", "Method", "Reference"]]
    for item in transactions:
        table_data.append([
            item.payer_name or "",
            item.transaction_id or "",
            item.transaction_date.strftime("%Y-%m-%d"),
            f"{Decimal(item.amount):.2f}",
            item.payment_method or "",
            item.reference_number or "",
        ])
    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    document.build(story)
    output.seek(0)
    return output
