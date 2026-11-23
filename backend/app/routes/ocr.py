from pathlib import Path

import pytesseract
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Receipt, User
from ..schemas import OcrResult
from ..services.ocr_service import extract_fields, extract_receipt_text


router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("/{receipt_id}", response_model=OcrResult)
def scan_receipt(receipt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    receipt = db.get(Receipt, receipt_id)
    if not receipt or receipt.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Receipt not found")
    path = Path(receipt.file_path)
    if not path.is_file():
        receipt.processing_status = "failed"
        db.commit()
        raise HTTPException(status_code=404, detail="Receipt file not found")
    try:
        text = extract_receipt_text(path)
        fields = extract_fields(text)
        if not text.strip():
            receipt.processing_status = "failed"
            db.commit()
            return OcrResult(receipt_id=receipt.id, processing_status="failed", extracted_text="", **fields,
                              message="No readable text was found")
        receipt.processing_status = "processed"
        db.commit()
        return OcrResult(receipt_id=receipt.id, processing_status="processed", extracted_text=text, **fields,
                         message="Review extracted fields before saving")
    except (ValueError, pytesseract.TesseractError, pytesseract.TesseractNotFoundError, OSError) as exc:
        receipt.processing_status = "failed"
        db.commit()
        raise HTTPException(status_code=422, detail=f"OCR processing failed: {str(exc)}")
