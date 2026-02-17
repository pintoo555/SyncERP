# Hosting over HTTPS

The app needs HTTPS (or `http://localhost`) for browser features like the **microphone** (voice messages in chat). Below are ways to run over HTTPS.

---

## 1. Local development (HTTPS)

Use the Vite dev server with a self-signed certificate.

### From the project root

1. Start the API (if not already running):
   ```bash
   npm run dev:server
   ```
2. Start the client with HTTPS:
   ```bash
   cd client
   npm run dev:https
   ```
3. Open in the browser: **https://localhost:3001**
4. Accept the browser’s “unsafe” / self-signed certificate warning (e.g. “Advanced” → “Proceed to localhost”). After that, the microphone and other secure-context features will work.

The API stays on `http://localhost:4001`; Vite proxies `/api` and `/socket.io` to it, so the browser only talks to `https://localhost:3001`.

### Optional: enable HTTPS via env

You can also enable HTTPS by setting `VITE_HTTPS=true` when starting Vite:

- **Windows (PowerShell):** `$env:VITE_HTTPS="true"; npm run dev`
- **Windows (CMD):** `set VITE_HTTPS=true& npm run dev`
- **Mac/Linux:** `VITE_HTTPS=true npm run dev`

---

## 2. Production / shared network (HTTPS)

For production or access from other devices, use one of these patterns.

### A. Reverse proxy (recommended)

Run a reverse proxy (e.g. **Caddy** or **nginx**) that:

- Terminates HTTPS (with a real or internal certificate).
- Proxies to your Node API (e.g. `http://localhost:4001`).
- Serves the built client (e.g. from `client/dist`) or proxies to the dev server.

Example with **Caddy** (auto HTTPS with Let’s Encrypt):

```text
yourdomain.com {
    reverse_proxy localhost:4001
    file_server client/dist
    try_files {path} /index.html
}
```

Then build the client, run the API, and point the browser at `https://yourdomain.com`.

### B. Node server with HTTPS

You can serve HTTPS directly from the Node/Express server by switching from `http` to `https` and providing certificate and key files (e.g. from Let’s Encrypt or your CA). This requires code changes in `server/src/app.ts` to use `https.createServer({ key, cert }, app)` and to update CORS/origins to your `https://` origin.

### C. Same machine, other devices (e.g. phone)

To use HTTPS on the same machine with a self-signed cert:

1. Run the client with HTTPS: `cd client && npm run dev:https`.
2. Open **https://localhost:3001** on your PC and accept the certificate.
3. To use from another device on the same network, you’d need to either:
   - Use a reverse proxy with a hostname/certificate that the device trusts, or  
   - Use **https://localhost:3001** only on the machine where the dev server runs (and use the microphone there).

---

## 3. Access from another PC (same network)

To open the app from another computer or phone on the same LAN (e.g. same Wi‑Fi):

### On the PC where the app runs (host)

1. **Get your IP address**
   - **Windows:** Open Command Prompt or PowerShell and run: `ipconfig`  
     Look for **IPv4 Address** under your active adapter (e.g. `192.168.50.200`).
   - **Mac/Linux:** Run `ifconfig` or `ip addr` and note the LAN IP.

2. **Allow the app ports in the firewall (required for remote access)**
   - **Windows:** Open **PowerShell as Administrator**, go to the project folder, and run (once):
     ```powershell
     .\scripts\allow-remote-access.ps1
     ```
     This allows inbound TCP on ports **3001** (client) and **4001** (API).  
   - Or add the rule manually: “Windows Defender Firewall” → “Advanced settings” → “Inbound Rules” → “New Rule” → Port → TCP **3001** → Allow.

3. **Allow your LAN origin in CORS**
   - In the **server** folder, edit `.env` (or create from `.env.example`).
   - Set `CORS_ORIGINS` to localhost and your LAN URL; for **HTTPS** from remote, include both `http` and `https` (replace with your actual IP):
     ```env
     CORS_ORIGINS=http://localhost:3001,http://192.168.50.200:3001,https://localhost:3001,https://192.168.50.200:3001
     ```
   - Restart the API server after changing `.env`.

4. **For remote HTTPS:** In the **client** folder, edit `.env.https` and set your LAN IP so the certificate is valid for the remote URL (optional but avoids extra cert warnings):
   ```env
   VITE_HTTPS_HOST=192.168.50.200
   ```
   Replace with your actual IP from step 1. Restart the client (`npm run dev:https`) after changing.

5. **Start the app** (API + client). The dev server binds to all interfaces, so you’ll see something like:
   ```text
   ➜  Local:   https://localhost:3001/
   ➜  Network: https://192.168.50.200:3001/
   ```

### On the remote PC or phone

- **HTTP:** Open **http://YOUR_HOST_IP:3001** (e.g. http://192.168.50.200:3001).
- **HTTPS:** Open **https://YOUR_HOST_IP:3001** (e.g. https://192.168.50.200:3001).  
  Accept the certificate warning (“Advanced” → “Proceed to …”) once. If you set `VITE_HTTPS_HOST` to your host IP in `.env.https`, the warning may be simpler.

### Troubleshooting

- **Can’t connect:** Check firewall allows TCP 3001; confirm the host and remote device are on the same network.
- **CORS / login errors:** Ensure `CORS_ORIGINS` in the server `.env` includes `http://YOUR_IP:3001` (or `https://...` if using HTTPS) and restart the API.

---

## Summary

| Goal                         | What to do                                              |
|-----------------------------|---------------------------------------------------------|
| Mic/voice on your PC        | `cd client && npm run dev:https` → open https://localhost:3001 |
| Open from another PC        | Set CORS_ORIGINS, allow port 3001, open http(s)://YOUR_IP:3001 |
| Production / real domain    | Reverse proxy (Caddy/nginx) with HTTPS + API + static client   |
| Env-based HTTPS in dev      | Set `VITE_HTTPS=true` when running `npm run dev` in `client`   |
