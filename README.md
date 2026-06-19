# E-commerce app

Full-stack starter using React, Tailwind CSS, Node.js, and Express.

## Run locally

```bash
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- API health check: http://localhost:5001/api/health

## Run with Docker

Complete `frontend/.env` and `backend/.env`, then run:

```bash
npm run docker:up
```

- Storefront: http://localhost:8080
- API health check: http://localhost:5001/api/health

Stop and remove the containers:

```bash
npm run docker:down
```

The frontend is built with Vite and served by Nginx. Nginx proxies `/api`
requests to the private Compose backend service. Firebase's public web config
is compiled into the frontend bundle, while Firebase Admin credentials are
supplied only to the backend container through `backend/.env`.

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

## Product mock data

The storefront loads products from `GET /api/products`. Product documents live
in the Firestore `products` collection rather than inside the React page.

To load or refresh the development fixture:

```bash
npm run seed:products --prefix backend
```

The source fixture is `backend/data/mock-products.json`.
# northstar-e-commerce
