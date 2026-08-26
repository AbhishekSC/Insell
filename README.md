# NearMySpace

Social real estate marketplace — post, discover, and chat about property listings, with communities, video calls, and role-based feeds (Buyer, Seller, Tenant, Broker, Builder, Investor).

## Tech stack

**Client** (`client/`) — React 19 + Vite, Tailwind CSS + daisyUI, TanStack Query, React Router, [Stream Chat](https://getstream.io/) + Stream Video SDKs, Leaflet for maps.

**Server** (`server/`) — Node.js + Express, MongoDB (Mongoose), Redis, RabbitMQ (optional), JWT auth (cookie + Bearer token), Stream Chat/Video, Cloudinary (media uploads), Google OAuth, Brevo (email).

## Project structure

```
insell/
├── client/   # React + Vite frontend
├── server/   # Express + MongoDB backend
└── .github/workflows/  # CI (lint + build checks on PRs)
```

## Prerequisites

- Node.js 20+
- A MongoDB instance (local or Atlas)
- Optional but used by some features: Redis, RabbitMQ, Stream Chat/Video account, Cloudinary account, Google OAuth credentials, Brevo account, Geoapify/NewsAPI keys

## Setup

### 1. Clone and install

```bash
git clone https://github.com/AbhishekSC/Insell.git
cd insell

cd client && npm install
cd ../server && npm install
```

### 2. Environment variables

Copy each example file and fill in your own values:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

- `client/.env.example` — Stream Chat public key, and the deployed backend URL (leave `VITE_API_URL` empty for local dev; Vite proxies `/api` to `localhost:5001`).
- `server/.env.example` — MongoDB URI, JWT secret, Stream Chat/Video keys, Cloudinary, Google OAuth, Redis, and a few optional integrations (RabbitMQ, Geoapify, NewsAPI, Brevo). Only `MONGO_URI` and `JWT_SECRET` are required to boot the server; everything else degrades gracefully or gates an individual feature.

### 3. Run locally

In two terminals:

```bash
# Backend — http://localhost:5001
cd server && npm run dev

# Frontend — http://localhost:5173
cd client && npm run dev
```

## Available scripts

**Client**
- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run preview` — preview a production build locally

**Server**
- `npm run dev` — start with nodemon (auto-restart)
- `npm start` — start normally
- `npm run seed:users` — seed sample users

## CI / Contributing

`main` is protected — all changes go through a pull request. On every PR, GitHub Actions runs:
- **Frontend CI** — lint + build (`client/`)
- **Backend CI** — dependency install + syntax check (`server/`)

Both must pass before a PR can be merged. Deployment is handled separately by Vercel (frontend) and Render (backend), both auto-deploying from `main`.
