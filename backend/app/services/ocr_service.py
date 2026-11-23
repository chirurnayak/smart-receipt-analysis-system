import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import cv2
import numpy as np
import pytesseract


def _field(value: str | None, confidence: str = "extracted"):
    return {"value": value, "confidence": confidence if value else "not_extracted"}


def preprocess_image(path: Path) -> np.ndarray:
    image = cv2.imread(str(path))
    if image is None:
        raise ValueError("The uploaded image is unreadable")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 7, 50, 50)
    return cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]


def parse_amount(text: str) -> str | None:
    label_matches = re.findall(
        r"(?:amount|total|paid|balance)\s*[:=\-]?\s*(?:Rs\.?|INR|₹|\$)?\s*(\d[\d,]*(?:\.\d{1,2})?)",
        text,
        re.IGNORECASE,
    )
    matches = label_matches or re.findall(r"(?:Rs\.?|INR|₹|\$)\s*(\d[\d,]*(?:\.\d{1,2})?)", text, re.IGNORECASE)
    candidates = []
    for match in matches:
        try:
            candidates.append(Decimal(match.replace(",", "")))
        except InvalidOperation:
            pass
    if not candidates:
        return None
    amount = max(candidates)
    return f"{amount:.2f}"


def parse_date(text: str) -> str | None:
    patterns = [
        r"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b",
        r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b",
        r"\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        raw = match.group(1)
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y", "%d %B %Y", "%d %b %Y"):
            try:
                return datetime.strptime(raw, fmt).isoformat()
            except ValueError:
                pass
    return None


def extract_fields(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    lower = text.lower()

    payer = None
    for line in lines[:8]:
        match = re.search(r"(?:payer|from|customer|name)\s*[:\-]\s*(.+)", line, re.IGNORECASE)
        if match:
            payer = match.group(1).strip()
            break

    transaction_id = None
    match = re.search(r"(?:transaction|txn|payment)[ -]?(?:id|no\.?|number)\s*[:\-#]?\s*([A-Za-z0-9_-]+)", text, re.IGNORECASE)
    if match:
        transaction_id = match.group(1)

    reference_number = None
    match = re.search(r"(?:reference|ref)[ -]?(?:no\.?|number)?\s*[:\-#]?\s*([A-Za-z0-9_-]+)", text, re.IGNORECASE)
    if match:
        reference_number = match.group(1)

    payment_method = None
    for method in ("cash", "card", "credit card", "debit card", "upi", "bank transfer", "net banking"):
        if method in lower:
            payment_method = method
            break

    amount = parse_amount(text)
    date = parse_date(text)
    return {
        "payer_name": _field(payer),
        "transaction_id": _field(transaction_id),
        "transaction_date": _field(date),
        "amount": _field(amount),
        "payment_method": _field(payment_method),
        "reference_number": _field(reference_number),
    }


def extract_receipt_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        try:
            from pdf2image import convert_from_path
        except ImportError as exc:
            raise ValueError("PDF OCR is unavailable: install pdf2image and Poppler") from exc
        try:
            images = convert_from_path(str(path), dpi=200, first_page=1, last_page=3)
        except Exception as exc:
            raise ValueError("Unable to convert PDF to images") from exc
        if not images:
            raise ValueError("The PDF contains no readable pages")
        text_parts = []
        for image in images:
            frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            _, processed = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            text_parts.append(pytesseract.image_to_string(processed))
        return "\n".join(text_parts)

    processed = preprocess_image(path)
    return pytesseract.image_to_string(processed)
