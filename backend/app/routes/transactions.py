from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Receipt, Transaction, User
from ..schemas import TransactionCreate, TransactionOut, TransactionUpdate
from ..services.transaction_service import update_duplicate_status


router = APIRouter(prefix="/transactions", tags=["transactions"])


def owned_transaction(db: Session, transaction_id: int, user: User) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


def validate_receipt(db: Session, receipt_id: int | None, user: User) -> None:
    if receipt_id is not None:
        receipt = db.get(Receipt, receipt_id)
        if not receipt or receipt.user_id != user.id:
            raise HTTPException(status_code=400, detail="Invalid receipt_id")


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    validate_receipt(db, payload.receipt_id, current_user)
    transaction = Transaction(user_id=current_user.id, **payload.model_dump())
    db.add(transaction)
    db.flush()
    update_duplicate_status(db, current_user.id, transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    payer_name: str | None = Query(default=None),
    transaction_id: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    amount_min: Decimal | None = Query(default=None),
    amount_max: Decimal | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if payer_name:
        query = query.filter(Transaction.payer_name.ilike(f"%{payer_name}%"))
    if transaction_id:
        query = query.filter(Transaction.transaction_id.ilike(f"%{transaction_id}%"))
    if date_from:
        query = query.filter(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(Transaction.transaction_date <= date_to)
    if amount_min is not None:
        query = query.filter(Transaction.amount >= amount_min)
    if amount_max is not None:
        query = query.filter(Transaction.amount <= amount_max)
    if payment_method:
        query = query.filter(Transaction.payment_method.ilike(f"%{payment_method}%"))
    return query.order_by(Transaction.transaction_date.desc()).offset((page - 1) * page_size).limit(page_size).all()


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return owned_transaction(db, transaction_id, current_user)


@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = owned_transaction(db, transaction_id, current_user)
    changes = payload.model_dump(exclude_unset=True)
    validate_receipt(db, changes.get("receipt_id"), current_user)
    for field, value in changes.items():
        setattr(transaction, field, value)
    db.flush()
    update_duplicate_status(db, current_user.id, transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    transaction = owned_transaction(db, transaction_id, current_user)
    db.delete(transaction)
    db.commit()
