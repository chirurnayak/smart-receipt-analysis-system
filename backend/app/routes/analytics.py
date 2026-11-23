from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Transaction, User
from ..services.analytics_service import normalized_payer_count, scoped_query


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    threshold: Decimal = Query(default=Decimal("0")),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = scoped_query(db, current_user.id, date_from, date_to)
    result = query.with_entities(
        func.coalesce(func.sum(Transaction.amount), 0),
        func.count(Transaction.id),
        func.avg(Transaction.amount),
        func.max(Transaction.amount),
        func.min(Transaction.amount),
    ).one()
    totals = {}
    payers = {}
    for (payer,) in query.with_entities(Transaction.payer_name).all():
        if payer:
            key = " ".join(payer.casefold().split())
            payers[key] = 0
    payer_sums = {}
    for transaction in query.all():
        if transaction.payer_name:
            key = " ".join(transaction.payer_name.casefold().split())
            payer_sums[key] = payer_sums.get(key, Decimal("0")) + Decimal(transaction.amount)
    above_threshold = sum(1 for amount in payer_sums.values() if amount > threshold)
    total, count, average, highest, lowest = result
    return {
        "total_amount": Decimal(total or 0),
        "transaction_count": count,
        "unique_payers": normalized_payer_count(db, current_user.id, date_from, date_to),
        "payers_above_threshold": above_threshold,
        "average_amount": Decimal(average or 0),
        "highest_payment": Decimal(highest or 0),
        "lowest_payment": Decimal(lowest or 0),
    }


@router.get("/daily")
def daily(date_from: datetime | None = None, date_to: datetime | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = scoped_query(db, current_user.id, date_from, date_to).with_entities(
        func.date(Transaction.transaction_date),
        func.sum(Transaction.amount),
        func.count(Transaction.id),
    ).group_by(func.date(Transaction.transaction_date)).order_by(func.date(Transaction.transaction_date)).all()
    return [{"date": str(day), "total_amount": Decimal(amount), "transaction_count": count} for day, amount, count in rows]


@router.get("/monthly")
def monthly(date_from: datetime | None = None, date_to: datetime | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = scoped_query(db, current_user.id, date_from, date_to).with_entities(
        func.strftime("%Y-%m", Transaction.transaction_date),
        func.sum(Transaction.amount),
        func.count(Transaction.id),
    ).group_by(func.strftime("%Y-%m", Transaction.transaction_date)).order_by(func.strftime("%Y-%m", Transaction.transaction_date)).all()
    return [{"month": str(month), "total_amount": Decimal(amount), "transaction_count": count} for month, amount, count in rows]


@router.get("/payment-methods")
def payment_methods(date_from: datetime | None = None, date_to: datetime | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = scoped_query(db, current_user.id, date_from, date_to).with_entities(
        func.coalesce(Transaction.payment_method, "Unknown"),
        func.sum(Transaction.amount),
        func.count(Transaction.id),
    ).group_by(Transaction.payment_method).order_by(func.sum(Transaction.amount).desc()).all()
    return [{"payment_method": method, "total_amount": Decimal(amount), "transaction_count": count} for method, amount, count in rows]
