import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Receipt, User
from ..schemas import ReceiptOut


router = APIRouter(prefix="/receipts", tags=["receipts"])
MAX_FILE_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", Path(__file__).resolve().parents[1] / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def validate_and_save(upload: UploadFile) -> tuple[str, str]:
    original_name = Path(upload.filename or "receipt").name
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported content type")
    content = upload.file.read(MAX_FILE_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds maximum upload size")

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    file_path = UPLOAD_DIR / stored_name
    file_path.write_bytes(content)
    return original_name, stored_name


@router.post("", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
def upload_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original_name, stored_name = validate_and_save(file)
    receipt = Receipt(
        user_id=current_user.id,
        original_filename=original_name,
        stored_filename=stored_name,
        file_path=str(UPLOAD_DIR / stored_name),
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


@router.post("/bulk", response_model=list[ReceiptOut], status_code=status.HTTP_201_CREATED)
def upload_receipts(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")
    receipts = []
    for upload in files:
        original_name, stored_name = validate_and_save(upload)
        receipt = Receipt(
            user_id=current_user.id,
            original_filename=original_name,
            stored_filename=stored_name,
            file_path=str(UPLOAD_DIR / stored_name),
        )
        db.add(receipt)
        receipts.append(receipt)
    db.commit()
    for receipt in receipts:
        db.refresh(receipt)
    return receipts


@router.get("", response_model=list[ReceiptOut])
def list_receipts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Receipt).filter(Receipt.user_id == current_user.id).order_by(Receipt.upload_date.desc()).all()


def owned_receipt(receipt_id: int, db: Session, user: User) -> Receipt:
    receipt = db.get(Receipt, receipt_id)
    if not receipt or receipt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.get("/{receipt_id}", response_model=ReceiptOut)
def receipt_details(receipt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return owned_receipt(receipt_id, db, current_user)


@router.get("/{receipt_id}/download")
def download_receipt(receipt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    receipt = owned_receipt(receipt_id, db, current_user)
    path = Path(receipt.file_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Receipt file not found")
    return FileResponse(path, filename=receipt.original_filename)


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    receipt = owned_receipt(receipt_id, db, current_user)
    path = Path(receipt.file_path)
    if path.is_file():
        path.unlink()
    db.delete(receipt)
    db.commit()
