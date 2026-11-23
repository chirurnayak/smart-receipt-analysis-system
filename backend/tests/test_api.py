from datetime import datetime
from decimal import Decimal

from app.models import Transaction
from app.services.ocr_service import extract_fields
from app.services.export_service import excel_report, pdf_report


def test_registration_login_and_invalid_login(client):
    registered = client.post("/api/v1/auth/register", json={
        "name": "Alice",
        "email": "alice@example.com",
        "password": "secret123",
    })
    assert registered.status_code == 201
    logged_in = client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "secret123"})
    assert logged_in.status_code == 200
    assert "access_token" in logged_in.json()
    assert client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "wrong"}).status_code == 401


def test_current_user_and_unauthorized(client, auth_headers):
    assert client.get("/api/v1/users/me").status_code in (401, 403)
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"


def test_receipt_upload_and_user_access(client, auth_headers):
    upload = client.post(
        "/api/v1/receipts",
        headers=auth_headers,
        files={"file": ("receipt.png", b"fake-png-content", "image/png")},
    )
    assert upload.status_code == 201
    receipt_id = upload.json()["id"]
    assert client.get(f"/api/v1/receipts/{receipt_id}", headers=auth_headers).status_code == 200
    assert client.delete(f"/api/v1/receipts/{receipt_id}", headers=auth_headers).status_code == 204


def test_transaction_crud_duplicate_and_filters(client, auth_headers):
    payload = {
        "payer_name": "John Doe",
        "transaction_id": "TXN-100",
        "amount": "250.50",
        "transaction_date": "2026-01-10T10:30:00",
        "payment_method": "UPI",
        "reference_number": "REF-1",
    }
    created = client.post("/api/v1/transactions", json=payload, headers=auth_headers)
    assert created.status_code == 201
    first = created.json()

    duplicate = client.post("/api/v1/transactions", json=payload, headers=auth_headers)
    assert duplicate.status_code == 201
    assert duplicate.json()["duplicate_status"] is True

    found = client.get("/api/v1/transactions", params={"payer_name": "john", "payment_method": "UPI"}, headers=auth_headers)
    assert found.status_code == 200
    assert len(found.json()) >= 2

    updated = client.put(f"/api/v1/transactions/{first['id']}", json={"payer_name": "Jane Doe"}, headers=auth_headers)
    assert updated.status_code == 200
    assert updated.json()["payer_name"] == "Jane Doe"
    assert client.delete(f"/api/v1/transactions/{first['id']}", headers=auth_headers).status_code == 204


def test_analytics_unique_payers_threshold_and_exports(client, auth_headers):
    for index, (payer, amount) in enumerate((("John Doe", "100.00"), (" john   doe ", "50.00"), ("Alice", "300.00"))):
        client.post("/api/v1/transactions", json={
            "payer_name": payer,
            "transaction_id": f"T-AN-{index}",
            "amount": amount,
            "transaction_date": "2026-02-10T10:30:00",
            "payment_method": "UPI",
        }, headers=auth_headers)
    summary = client.get("/api/v1/analytics/summary", params={"threshold": "200"}, headers=auth_headers)
    assert summary.status_code == 200
    data = summary.json()
    assert data["unique_payers"] >= 2
    assert data["payers_above_threshold"] >= 1

    excel = client.get("/api/v1/exports/excel", headers=auth_headers)
    pdf = client.get("/api/v1/exports/pdf", headers=auth_headers)
    assert excel.status_code == 200
    assert excel.headers["content-type"].startswith("application/vnd")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")


def test_ocr_field_extraction_and_missing_fields():
    fields = extract_fields(
        "Merchant Receipt\nPayer: Sam Jones\nTransaction ID: TX123\nReference No: REF9\n"
        "Payment method: UPI\nDate: 2026-03-15\nAmount: Rs. 125.50"
    )
    assert fields["payer_name"]["value"] == "Sam Jones"
    assert fields["transaction_id"]["value"] == "TX123"
    assert fields["reference_number"]["value"] == "REF9"
    assert fields["amount"]["value"] == "125.50"
    missing = extract_fields("Unreadable receipt")
    assert missing["transaction_date"]["confidence"] == "not_extracted"


def test_report_generators():
    item = Transaction(
        payer_name="Sam",
        transaction_id="TX1",
        transaction_date=datetime(2026, 3, 15),
        amount=Decimal("125.50"),
        payment_method="UPI",
        reference_number="REF1",
    )
    excel = excel_report([item])
    pdf = pdf_report([item])
    assert excel.getvalue().startswith(b"PK")
    assert pdf.getvalue().startswith(b"%PDF")
