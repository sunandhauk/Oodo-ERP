# Oodo ERP

Next.js frontend for the Oodo ERP auth flow.

## What is included

- Login page that matches the provided design
- Sign Up page that matches the provided design
- Backend JWT session flow using signed httpOnly cookies
- Protected dashboard placeholder after auth
- Responsive layout for mobile and desktop

## Run locally

1. Install dependencies: `npm install`
2. Start the app: `npm run dev`

## Notes

- Set `BACKEND_API_URL` to your NestJS backend base URL, for example `http://127.0.0.1:3001`.
- The auth screens validate inputs on the client.
- The app uses local Next.js route handlers to proxy auth requests to the backend and store the returned JWT in a cookie.

