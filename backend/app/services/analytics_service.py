from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Transaction


def scoped_query(db: Session, user_id: int, date_from: datetime | None = None, date_to: datetime | None = None):
    query = db.query(Transaction).filter(Transaction.user_id == user_id)
    if date_from:
        query = query.filter(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(Transaction.transaction_date <= date_to)
    return query


def normalized_payer_count(db: Session, user_id: int, date_from: datetime | None = None, date_to: datetime | None = None) -> int:
    payers = set()
    for (payer_name,) in scoped_query(db, user_id, date_from, date_to).with_entities(Transaction.payer_name).all():
        if payer_name:
            normalized = " ".join(payer_name.casefold().split())
            if normalized:
                payers.add(normalized)
    return len(payers)
