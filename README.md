# Personal Tracker — React Web App

Responsive React/Vite frontend for the Personal Tracker API.

## Requirements
- Node.js 20+
- Personal Tracker API running on `http://localhost:3000` by default

## Run
```bash
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `.env.local` if the API runs elsewhere.

## Current scope
- Login against `POST /auth/v1/sign_in`
- Email validation: `Administrator` or a standard email address
- Bearer token + `sessionId` headers for authenticated API calls
- Light/dark theme persisted in local storage
- Responsive/mobile compact layout
- System administrator: Users only
- Regular user: Home, Summary, Transactions, LookUps
- Home and Summary are intentionally empty placeholders for later requirements
- Users page is wired to the Users list endpoint as a foundation
- API service methods are prepared for Users, LookUps, Transactions and Transaction Summary endpoints

API reference: https://github.com/Kalai-2610/personal-tracker/blob/main/Endpoints.md
