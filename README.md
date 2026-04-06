# Fishing App

Fishing App is a small monorepo with:

- an Express + Prisma backend for auth, locations, reviews, favorites, owner/admin moderation, and photo cleanup
- a React + Vite frontend for browsing locations, registration/login, owner tools, admin moderation, and favorites
- a PostgreSQL database managed through Prisma migrations and seed scripts

## Repository Layout

```text
.
|- backend/    Express API, Prisma schema/migrations/seed, Vitest API tests
|- frontend/   Vite React app, Vercel config, Vitest UI tests
|- package.json
`- README.md
```

This repo is not using npm workspaces. Root, backend, and frontend each have their own `package.json`.

## Tech Stack

- Backend: Node.js, Express 5, Prisma, PostgreSQL, JWT, bcrypt, Cloudinary
- Frontend: React 19, Vite, React Router, Axios, React Leaflet
- Testing: Vitest, Supertest, Testing Library, jsdom
- Deployment-related files present in repo:
  - frontend Vercel SPA rewrite config in `frontend/vercel.json`
  - backend start/deploy scripts in `backend/package.json`

## Prerequisites

- Node.js: the repo does not pin an exact version via `engines` or `.nvmrc`; use a current LTS Node release
- npm
- PostgreSQL
- Docker / Docker Compose only if you want to run the local Postgres container from `backend/docker-compose.yml`

## Installation

Install dependencies in all three package roots:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

The backend `postinstall` script runs `prisma generate`.

## Environment Variables

### Backend

The backend loads env vars from `backend/.env` in normal runs and from `backend/.env.test` in tests.

Variables used by code:

- `PORT`: backend HTTP port. Defaults to `4000` if unset.
- `DATABASE_URL`: PostgreSQL connection string used by Prisma and the pg adapter.
- `JWT_SECRET`: signing key for auth tokens.
- `JWT_EXPIRES_IN`: optional JWT lifetime. Defaults to `7d`.
- `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name used for server-side deletes.
- `CLOUDINARY_API_KEY`: Cloudinary API key used for server-side deletes.
- `CLOUDINARY_API_SECRET`: Cloudinary API secret used for server-side deletes.
- `SEED_KEY`: optional shared secret for the admin seed/clear HTTP endpoints.

Example `backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://app:app@localhost:5432/fishing
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
SEED_KEY=replace-with-a-seed-key-if-you-plan-to-use-admin-seed-endpoints
```

Example `backend/.env.test`:

```env
NODE_ENV=test
DATABASE_URL=postgresql://app:app@localhost:5432/fishing_test
JWT_SECRET=test-secret
```

### Frontend

The frontend reads these Vite env vars from `frontend/.env`:

- `VITE_API_URL`: base URL for the backend API
- `VITE_CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name used for direct browser uploads
- `VITE_CLOUDINARY_UPLOAD_PRESET`: unsigned upload preset used by the photo uploader

Example `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
```

## Local Development

### 1. Start PostgreSQL

You can either use your own local PostgreSQL instance or the Docker Compose service included in the repo.

From the repo root:

```bash
npm run db:up
```

This starts the Postgres 16 container defined in `backend/docker-compose.yml` with:

- database: `fishing`
- user: `app`
- password: `app`
- port: `5432`

To stop it:

```bash
npm run db:down
```

To view DB logs:

```bash
npm run db:logs
```

### 2. Apply schema and seed data

From the repo root, the fastest destructive reset is:

```bash
npm run fresh
```

That runs:

1. `npm run db:up`
2. `npm --prefix backend run db:reset`
3. `npm --prefix backend run db:seed`

Important:

- `db:reset` uses `prisma migrate reset --force`
- it drops and recreates the database schema
- it is destructive

If you want the steps separately:

```bash
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
```

Other useful backend DB commands:

```bash
npm --prefix backend run db:push
npm --prefix backend run db:studio
npm --prefix backend run db:fresh
```

### 3. Run the apps

Run everything from the root:

```bash
npm run dev
```

This starts:

- the Docker Compose Postgres service
- backend dev server via `nodemon`
- frontend dev server via Vite

You can also run pieces separately:

```bash
npm run backend:dev
npm run frontend:dev
```

Or directly:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

### Local URLs

- Backend: `http://localhost:4000` unless `PORT` overrides it
- Health check: `GET /health`
- Frontend: Vite default dev URL, usually `http://localhost:5173`

## Database Seeding

### CLI seed

The backend seed entry is `backend/prisma/seed.mjs`.

Run locally:

```bash
npm --prefix backend run db:seed
```

The seed script:

- creates fish and season dictionaries
- creates users with `ADMIN`, `OWNER`, and `USER` roles
- creates locations, photos, reviews, and favorites
- is designed to be rerunnable via upserts/find-and-update patterns

Seeded login credentials printed by the script:

- `admin@test.com / Password123!`
- `owner1@test.com / Password123!`
- `owner2@test.com / Password123!`
- `owner3@test.com / Password123!`
- `owner4@test.com / Password123!`
- `user1@test.com / Password123!`
- `user2@test.com / Password123!`
- `user3@test.com / Password123!`
- `user4@test.com / Password123!`
- `user5@test.com / Password123!`

### Hosted DB seeding

There are two repo-supported ways to seed a non-local database:

1. Run the Prisma seed script against the target `DATABASE_URL`

```bash
npm --prefix backend run db:seed
```

2. Use the backend admin seed endpoint:

```http
POST /admin/seed
x-seed-key: <SEED_KEY>
```

The repo also includes a destructive clear endpoint:

```http
POST /admin/clear
x-seed-key: <SEED_KEY>
x-confirm: CLEAR
```

Caution:

- `POST /admin/clear` wipes the database through `wipeDatabase()`
- both `/admin/seed` and `/admin/clear` are available before JWT auth, protected only by `x-seed-key`
- do not expose or reuse `SEED_KEY` casually

## Cloudinary

Cloudinary is used in two different ways:

### Frontend uploads

The owner photo uploader in `frontend/src/components/owner/PhotoUploader.jsx` uploads images directly from the browser to:

```text
https://api.cloudinary.com/v1_1/<cloud-name>/image/upload
```

It requires:

- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

Owner uploads are placed in a per-user draft folder like `drafts/<userId>`.

### Backend cleanup and deletes

The backend uses Cloudinary credentials from `backend/.env` for:

- deleting abandoned draft uploads via `POST /photos/cleanup`
- deleting saved photos via `DELETE /photos/:id`
- deleting location photos when an admin permanently deletes a hidden location

In practice:

- uploads happen directly from frontend to Cloudinary
- the backend stores `url` and `publicId`
- the backend is responsible for cleanup and destructive deletes

## Prisma and Database Notes

Files that are part of the committed schema state:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations`
- `backend/prisma/seed.mjs`
- `backend/prisma.config.ts`

The backend uses Prisma with the `@prisma/adapter-pg` adapter and a `pg` connection string from `DATABASE_URL`.

## Testing

### Backend tests

Run once:

```bash
npm --prefix backend test
```

Watch mode:

```bash
npm --prefix backend run test:watch
```

Backend test setup:

- Vitest Node environment
- setup files:
  - `backend/tests/env.setup.js`
  - `backend/tests/setup.js`
- tests expect `backend/.env.test`
- tests connect to a real PostgreSQL database from `DATABASE_URL`

### Frontend tests

Run in watch mode:

```bash
npm --prefix frontend test
```

Run once:

```bash
npm --prefix frontend run test:run
```

UI mode:

```bash
npm --prefix frontend run test:ui
```

Frontend test setup:

- Vitest with `jsdom`
- Testing Library
- setup file: `frontend/src/tests/setup.js`

There is no e2e test setup in this repo.

## Deployment

### Backend

The backend deployment in this project does not use a `render.yaml` or any other Render config file from the repo. In Render, this backend is meant to be deployed from the `backend/` subdirectory of the Git repository.

What the repo provides:

- a production start path in `backend/package.json`:

```bash
npm run deploy
```

That command runs:

```bash
prisma migrate deploy && node src/server.js
```

In practice for Render:

- set the service Root Directory to `backend/`
- run the backend install/start flow from `backend/package.json`

Backend environment needed in Render:

- `DATABASE_URL`
- `JWT_SECRET`
- optional `JWT_EXPIRES_IN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- optional `SEED_KEY`
- optional `PORT` if the platform does not inject it automatically

### Frontend

The frontend includes `frontend/vercel.json` with:

- SPA rewrite of all routes to `/`

That is needed because the frontend uses React Router routes such as:

- `/`
- `/locations/:id`
- `/login`
- `/register`
- `/owner`
- `/admin`
- `/profile`
- `/favorites`

For a Vercel deployment, the frontend needs:

- `VITE_API_URL` pointing to the deployed backend
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

## Docker Support

Local Docker support is partial, not full-stack.

What exists:

- `backend/docker-compose.yml` for PostgreSQL only
- root scripts to start/stop/log that database container

What does not exist in the repo:

- backend Dockerfile
- frontend Dockerfile
- Compose services for backend/frontend
- a one-command fully containerized local stack

So the current local workflow is:

- optional Docker for the database
- backend and frontend run on the host via Node/npm

## Useful Commands

```bash
# root
npm run dev
npm run fresh
npm run db:up
npm run db:down
npm run db:logs

# backend
npm --prefix backend run dev
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend run db:reset
npm --prefix backend run db:studio
npm --prefix backend test

# frontend
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run preview
npm --prefix frontend run test:run
```

## Troubleshooting

- If the frontend loads but API requests fail, check `frontend/.env` and especially `VITE_API_URL`.
- If login or protected actions fail unexpectedly, check `JWT_SECRET` and whether the backend was restarted after env changes.
- If Prisma commands fail, verify `DATABASE_URL` and make sure PostgreSQL is actually reachable.
- If photo upload fails in the browser, check `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`.
- If photo deletion/cleanup fails after upload succeeds, check backend Cloudinary credentials. Uploads and deletes use different credentials/paths.
- If `npm run dev` starts the DB but the backend crashes, run backend and frontend separately to isolate env or DB issues.
- If frontend deep links 404 in production, make sure the Vercel rewrite config is included in the deployed frontend.
