# Oodo ERP

Next.js frontend for the Oodo ERP auth flow.

## What is included

- Login page that matches the provided design
- Sign Up page that matches the provided design
- Mock JWT session flow using signed httpOnly cookies
- Protected dashboard placeholder after auth
- Responsive layout for mobile and desktop

## Run locally

1. Install dependencies: `npm install`
2. Start the app: `npm run dev`

## Notes

- There is no external backend yet.
- The auth screens validate inputs on the client.
- The app uses local Next.js route handlers to issue and clear a mock JWT session cookie.
- If you want to change the signing secret later, set `MOCK_JWT_SECRET` in your environment.

