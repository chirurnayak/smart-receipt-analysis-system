# Web frontend

React 19, TypeScript, and Vite frontend for the receipt and payment API.
Tailwind CSS v4 is available for utility styling, while the existing application
styles remain in `src/App.css` and `src/index.css`.

## Setup on Windows

Use Node.js 20.19+ and npm. From this directory:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

The default `VITE_API_BASE_URL` targets a local backend at
`http://127.0.0.1:8000/api/v1`. Override it in `.env` when using a different API.
The backend's `CORS_ORIGINS` must include the URL used to open this frontend.

## Run

Start the backend first, then run:

```powershell
npm.cmd run dev
```

Vite prints the local URL (normally `http://127.0.0.1:5173`). The app supports
account registration and login, receipt upload and OCR review, transaction
management, analytics, filtered searches, and Excel/PDF exports.

## Verify

```powershell
npm.cmd run lint
npm.cmd run build
```
