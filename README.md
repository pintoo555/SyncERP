# Synchronics Asset Management System

Production-grade Asset Management System for **Synchronics**, built with Node.js, Express, Socket.IO, React, and Microsoft SQL Server 2008 R2.

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** React.js
- **Database:** Microsoft SQL Server 2008 R2 (existing production DB)
- **UI Theme:** Inspinia admin theme (`ReferenceTheme/Inspinia/Full`)

## High-Level Features

- Authentication via existing `rb_users` (Email = username, Password, IsActive = 1)
- Role-based access control (RBAC) with granular permissions
- Masters: Asset Categories (tree), Brands, Models, Vendors, Locations
- Asset lifecycle: create, edit, soft delete, status (AVAILABLE, ISSUED, UNDER_REPAIR, SCRAPPED, LOST)
- Assignments: issue, return, transfer with full history
- File uploads (photos/documents) with validation and secure streaming
- Maintenance tickets per asset
- Physical verification records
- Precomputed fast search (`react_AssetSearch`)
- Full audit logging (`react_AuditLog`)
- Realtime dashboards (Socket.IO namespace `/realtime`)
- My Assets view for logged-in users

## Setup Instructions

### 1. Database

1. Run migrations in order against your SQL Server 2008 R2 database:
   - `database/migrations/001_rbac.sql`
   - `database/migrations/002_masters.sql`
   - `database/migrations/003_assets.sql`
   - `database/migrations/004_files.sql`
   - `database/migrations/005_search_audit.sql`
2. Run the RBAC seed (idempotent):
   - `database/seeds/001_rbac_seed.sql`
3. Assign the **ADMIN** role to at least one user in `react_UserRoles` (UserID = your admin's `rb_users.userid`, RoleID = role with RoleCode 'ADMIN').

**Existing tables:** Do not modify `rb_users` or `sync_Department`. All new tables use the `react_` prefix.

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env with DB credentials, JWT_SECRET, CORS_ORIGINS
npm install
npm run dev
```

API runs at `http://localhost:4000` (or `PORT` from `.env`).

- **Connectivity check:** `GET /ping`
- **Login:** `POST /api/auth/login` with `{ "email": "...", "password": "..." }` — JWT set in httpOnly cookie.
- **Current user:** `GET /api/auth/me` (requires cookie).

### 3. Frontend (React + Inspinia)

**Optional — Inspinia CSS:** For full Inspinia styling, build the theme and copy CSS into the client:

```bash
cd ReferenceTheme/Inspinia/Full
npm install
npx gulp
# Copy public/css/* and public/images/* into client/public/
cp -r public/css client/public/
cp -r public/images client/public/
```

If you skip this, the app still runs using Bootstrap 5 and a minimal layout (see `client/src/layout/layout.css`).

```bash
cd client
npm install
npm run dev
```

The app runs at `http://localhost:3000` and proxies `/api` and `/socket.io` to the backend (default `http://localhost:4000`). Use the Inspinia theme for layout and styling only; do not introduce another UI framework.

### 4. User Photos

Place user avatars at `client/public/user-photos/{userid}.jpg`. If missing, the app shows a default avatar.

## Environment Config

See `server/.env.example`. Required:

- `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGINS` (e.g. `http://localhost:3000`)

## Security

- Helmet, CORS allowlist, rate limiting (including login)
- Parameterized SQL only; no secrets in code
- Audit log for login/logout and key actions (no passwords logged)
- Role-based guards on all protected routes
- Upload restrictions (type, size); randomized stored filenames; path traversal prevention

## API Design

- Base path: `/api`
- REST-style endpoints; consistent JSON responses; central error handler
- Validation via Zod/Joi; server-side paging and filtering
- Key groups: `/api/auth`, `/api/users`, `/api/rbac`, `/api/masters`, `/api/assets`, `/api/search/assets`, `/api/tickets`, `/api/files`, `/api/audit`, `/api/my/assets`

## Realtime (Socket.IO)

- Namespace: `/realtime`
- Auth: send JWT in `auth.token` or query `token`
- Events emitted: `dashboard:update`, `asset:changed`, `ticket:changed`, `audit:new`

## Implementation Status

1. ✅ Database schema and seed scripts
2. ✅ Backend skeleton (Express, Socket.IO, auth, RBAC)
3. ✅ Masters CRUD
4. ✅ Asset core module
5. ✅ Assignments and files
6. ✅ Tickets and verification
7. ✅ Search system
8. ✅ Audit API and UI (list, search, export CSV)
9. ✅ Dashboards and realtime
10. ✅ Frontend React (Vite) with Inspinia-style layout, Login, Dashboards, Assets, My Assets, Masters, Audit

## License

Proprietary — Synchronics.
