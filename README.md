# E-commerce app

Full-stack starter using React, Tailwind CSS, Node.js, and Express.

## Run locally

```bash
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- API health check: http://localhost:5000/api/health

## Firebase authentication setup

1. Create a Firebase project and a Web app in the Firebase console.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create a Firestore database.
4. Copy `frontend/.env.example` to `frontend/.env` and add the Web app config.
5. In **Project settings → Service accounts**, generate a private key.
6. Copy `backend/.env.example` to `backend/.env` and add the service-account values.

Keep the private key in `backend/.env`; never expose it through a `VITE_` variable.

Authentication routes:

- `POST /api/auth/profile` creates the signed-in user's Firestore profile.
- `GET /api/auth/me` returns the signed-in user's profile.

Both routes require `Authorization: Bearer <Firebase ID token>`.

During development, the API accepts localhost frontend origins on any port so
Vite can fall back from `5173` when that port is already occupied. In production,
only origins listed in `CLIENT_URL` are accepted.
# northstar-e-commerce
