from sqlalchemy.orm import Session

from ..models import Transaction


def normalize_reference(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def update_duplicate_status(db: Session, user_id: int, transaction: Transaction) -> None:
    duplicate = False
    transaction_id = normalize_reference(transaction.transaction_id)
    if transaction_id:
        duplicate = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_id == transaction_id,
            Transaction.id != transaction.id,
        ).first() is not None
    if not duplicate and transaction.payer_name:
        payer = " ".join(transaction.payer_name.lower().split())
        for other in db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.id != transaction.id,
        ).all():
            if (
                other.payer_name
                and " ".join(other.payer_name.lower().split()) == payer
                and other.amount == transaction.amount
                and other.transaction_date == transaction.transaction_date
            ):
                duplicate = True
                break
    transaction.duplicate_status = duplicate
