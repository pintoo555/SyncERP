# Hosting on a Live Server

This app has a **Node.js backend** (API + Socket.IO) and a **Vite/React frontend**. You can run them together on one machine so the backend serves both the API and the built frontend.

---

## 1. Prerequisites

- **Node.js 18+** on the server
- **SQL Server** reachable from the server (same network or allowed firewall)
- Your **database** and **uploads** directory (if you use file uploads) available from the server

---

## 2. Build the app

On your dev machine or on the server:

```bash
# Build frontend (output: client/dist)
cd client
npm ci
npm run build
cd ..

# Build backend (output: server/dist)
cd server
npm ci
npm run build
cd ..
```

---

## 3. Environment on the server

On the server, create `server/.env` (copy from `server/.env.example` and set real values).

**Required:**

| Variable | Description |
|----------|-------------|
| `PORT` | Port the app listens on (e.g. `4000`) |
| `NODE_ENV` | Set to `production` |
| `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | SQL Server connection |
| `JWT_SECRET` | Long random string (e.g. 32+ chars) |
| `CORS_ORIGINS` | Full URL(s) users will use, comma-separated (e.g. `https://yourdomain.com` or `http://192.168.1.10:4000`) |

**Optional for single-server deploy:**

| Variable | Description |
|----------|-------------|
| `CLIENT_DIST` | Absolute path to `client/dist`. If unset, in production the server looks for `../../client/dist` relative to the built app (works when you run from repo root). |

**Example `server/.env` for production:**

```env
PORT=4000
NODE_ENV=production

DB_SERVER=your-sql-server-ip-or-hostname
DB_NAME=SyncFinalNew
DB_USER=sa
DB_PASSWORD=your-secure-password
DB_ENCRYPT=true
DB_TRUST_CERTIFICATE=true

JWT_SECRET=use-a-long-random-secret-here
JWT_EXPIRES_IN=8h

# URL(s) users open in the browser (no trailing slash). For same-server deploy, use the same origin.
CORS_ORIGINS=http://your-server-ip:4000
# If you use a domain and port 80: https://yourdomain.com

# Optional: only if the default path to client/dist is wrong
# CLIENT_DIST=C:\inetpub\asset-app\client\dist
```

---

## 4. Run on the server

**Option A – Same server serves API + frontend (recommended)**

1. Copy the whole project (or at least `server/` with `server/dist`, `server/node_modules`, and `client/dist`) to the server.
2. Set `server/.env` as above. Ensure `CORS_ORIGINS` includes the URL users will use (e.g. `http://SERVER_IP:4000`).
3. From the **project root** (parent of `server` and `client`):

   ```bash
   cd server
   node dist/app.js
   ```

   The server will serve the API on `/api`, Socket.IO, and the React app from `client/dist` (so users open `http://SERVER_IP:4000` and get the UI).

**Option B – Custom path for frontend**

If the built frontend is not at `server/../../client/dist`, set:

```env
CLIENT_DIST=C:\path\to\client\dist
```

Then run:

```bash
cd server
node dist/app.js
```

**Option C – Keep frontend and backend on different hosts**

- Build the client with the backend URL:  
  `VITE_API_URL=http://your-api-server:4000` (or the public URL of your API).
- Deploy the backend as in Option A but **do not** set `CLIENT_DIST` (so the server does not serve static files).
- Host the contents of `client/dist` on another web server (IIS, nginx, or any static host).
- Set `CORS_ORIGINS` to the URL of that frontend (e.g. `https://app.yourdomain.com`).

---

## 5. Keep it running (Windows Server)

**Using a process manager (recommended)**

- **PM2**: `npm install -g pm2` then `pm2 start server/dist/app.js --name asset-api` and `pm2 save` / `pm2 startup`.
- **NSSM**: Install as a Windows Service so the app starts after reboot.

**Simple start script (e.g. `start.bat` in project root):**

```bat
cd /d "%~dp0server"
node dist/app.js
```

Run this in a console or shortcut; closing the window will stop the app unless you use PM2/NSSM.

---

## 6. Firewall and URL

- Open the chosen **PORT** (e.g. 4000) in the server firewall so users can reach it.
- Users open in the browser: **`http://SERVER_IP:4000`** (or your domain if you put a reverse proxy in front).

---

## 7. Optional: reverse proxy (HTTPS / port 80)

To use **port 80** or **HTTPS**, put a reverse proxy in front of Node:

- **IIS**: URL Rewrite + ARR to proxy to `http://localhost:4000`.
- **nginx**: `proxy_pass http://127.0.0.1:4000` for `/api`, `/socket.io`, `/ping`, and `/`.

Then set `CORS_ORIGINS` to the public URL (e.g. `https://yourdomain.com`) and, if needed, configure Socket.IO for the proxy (e.g. `transports: ['websocket','polling']`).

---

## Quick checklist

1. Build: `client`: `npm run build`, `server`: `npm run build`.
2. On server: set `server/.env` (DB, JWT_SECRET, CORS_ORIGINS, NODE_ENV=production).
3. Run from project root: `cd server && node dist/app.js` (or set `CLIENT_DIST` and run the same).
4. Open `http://SERVER_IP:4000` in the browser (or your domain if using a proxy).

---

## Troubleshooting

### Health page returns "Not found" / 404

The Health page calls `/api/health`. If that returns 404, one of these applies:

1. **Old API build** – Rebuild and restart the server:
   ```bash
   npm run build --prefix server
   cd server && node dist/app.js
   ```

2. **Vite dev server on another port (e.g. 3002)** – Vite proxies `/api` to the backend. Ensure:
   - The API server is running on port 4001 (or set `VITE_PROXY_TARGET` / `API_PROXY_TARGET`)
   - Vite proxy target matches your API port

3. **Reverse proxy (nginx/IIS) on a different port** – The frontend is served by nginx/IIS, but `/api` is not proxied to the Node backend:
   - **Option A**: Configure the proxy to forward `/api`, `/socket.io`, and `/ping` to the Node server (e.g. `proxy_pass http://127.0.0.1:4001`)
   - **Option B**: Build the client with `VITE_API_URL=http://your-server:4001` so API requests go directly to the backend

4. **CORS** – Add the URL you use to open the app to `CORS_ORIGINS` in `server/.env` (e.g. `http://192.168.50.200:3002`).
