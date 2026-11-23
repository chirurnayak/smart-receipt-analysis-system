# Backend

FastAPI backend for authenticated receipt uploads, OCR extraction, transaction management,
payment analytics, and Excel/PDF exports.

## Project structure

```text
backend/
  app/
    routes/
    services/
    auth.py
    database.py
    main.py
    models.py
    schemas.py
  tests/
  uploads/
  requirements.txt
```

## Setup on Windows

Python 3.12 or newer is recommended.

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `JWT_SECRET_KEY` in `.env` to a long random value. SQLite is the default database.
The FastAPI application loads `backend/.env` automatically. Set `CORS_ORIGINS` to a
comma-separated list of frontend origins; the example includes `http://127.0.0.1:5173`.
Use the actual origin shown by Vite if it selects another port.

Install Tesseract OCR from https://github.com/tesseract-ocr/tesseract and ensure
`tesseract.exe` is on `PATH`. PDF OCR also requires Poppler.

## Run

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Swagger is available at `http://127.0.0.1:8000/docs`.

## Tests

```powershell
pytest -q
```

## API overview

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/me`
- `POST /api/v1/receipts`
- `POST /api/v1/receipts/bulk`
- `GET /api/v1/receipts`
- `GET /api/v1/receipts/{receipt_id}`
- `GET /api/v1/receipts/{receipt_id}/download`
- `DELETE /api/v1/receipts/{receipt_id}`
- `POST /api/v1/transactions`
- `GET /api/v1/transactions`
- `GET /api/v1/transactions/{transaction_id}`
- `PUT /api/v1/transactions/{transaction_id}`
- `DELETE /api/v1/transactions/{transaction_id}`
- `POST /api/v1/ocr/{receipt_id}`
- `GET /api/v1/analytics/summary`
- `GET /api/v1/analytics/daily`
- `GET /api/v1/analytics/monthly`
- `GET /api/v1/analytics/payment-methods`
- `GET /api/v1/exports/excel`
- `GET /api/v1/exports/pdf`

All protected routes require `Authorization: Bearer <access_token>`.

Example registration:

```powershell
$body = @{ name = "Alice"; email = "alice@example.com"; password = "secret123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/auth/register" -ContentType "application/json" -Body $body
```
