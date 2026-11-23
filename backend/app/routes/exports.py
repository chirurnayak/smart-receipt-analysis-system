from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..models import Transaction, User
from ..database import get_db
from ..services.analytics_service import scoped_query
from ..services.export_service import excel_report, pdf_report


router = APIRouter(prefix="/exports", tags=["exports"])


def filtered_transactions(
    db: Session,
    user: User,
    date_from: datetime | None,
    date_to: datetime | None,
    payer_name: str | None,
    transaction_id: str | None,
    amount_min: Decimal | None,
    amount_max: Decimal | None,
    payment_method: str | None,
) -> list[Transaction]:
    query = scoped_query(db, user.id, date_from, date_to)
    if payer_name:
        query = query.filter(Transaction.payer_name.ilike(f"%{payer_name}%"))
    if transaction_id:
        query = query.filter(Transaction.transaction_id.ilike(f"%{transaction_id}%"))
    if amount_min is not None:
        query = query.filter(Transaction.amount >= amount_min)
    if amount_max is not None:
        query = query.filter(Transaction.amount <= amount_max)
    if payment_method:
        query = query.filter(Transaction.payment_method.ilike(f"%{payment_method}%"))
    return query.order_by(Transaction.transaction_date.desc()).all()


@router.get("/excel")
def export_excel(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    payer_name: str | None = None,
    transaction_id: str | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    payment_method: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transactions = filtered_transactions(db, current_user, date_from, date_to, payer_name, transaction_id, amount_min, amount_max, payment_method)
    output = excel_report(transactions)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": 'attachment; filename="transactions.xlsx"'})


@router.get("/pdf")
def export_pdf(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    payer_name: str | None = None,
    transaction_id: str | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    payment_method: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transactions = filtered_transactions(db, current_user, date_from, date_to, payer_name, transaction_id, amount_min, amount_max, payment_method)
    output = pdf_report(transactions, date_from, date_to)
    return StreamingResponse(output, media_type="application/pdf",
                             headers={"Content-Disposition": 'attachment; filename="payment-report.pdf"'})
