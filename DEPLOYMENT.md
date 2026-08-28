# Local hosting + Cloudflare Tunnel plan — personal-website

Status: Phase 1 (local Docker bring-up) COMPLETE — live on http://localhost:3000. Phases 2-3 staged, NOT started.

## Phase 1 — Local Docker hosting (COMPLETE — live on http://localhost:3000)
- [x] Inspect stack: Node 18 + Express + Socket.IO, static `public/`, health at `/health` (note: the mission brief says `/api/health` but the server actually exposes `/health` and `/test`; `/api` is the webdisplay API mount. Healthcheck uses `/health`.)
- [x] Smoke-test locally with plain node on port 3100 — all endpoints OK (health, `/`, `/test`, `/api/leaderboard`, `/webdisplay/`).
- [x] Author Dockerfile (node:18.17.0-bookworm-slim, npm install + preprocess at build, HEALTHCHECK on `/health`, non-root user), docker-compose.yml (restart: unless-stopped, healthcheck, leaderboard volume, commented cloudflared placeholder), .dockerignore.
- [x] `docker compose config` validates.
- [x] Docker access resolved: joel added to `docker` group + `systemctl enable docker` (both via wheel/polkit — the .env SUDO_PASSWORD line is commented out and was NOT the path used; polkit wheel-admin was). User green-lit ("let's get docker working").
- [x] `docker compose build` + `up -d` — image `personal-website:latest`, container `personal-website` running, HEALTHCHECK green (`Up X (healthy)`).
- [x] Verified: `/health` OK, `/` serves site, `/test` OK, `/webdisplay/` HTTP 200, `/godot/` 301-redirects, `/api/leaderboard` OK. `docker restart` comes back healthy. Leaderboard scores persist across restarts via named volume `personal-website_leaderboard_data`.
- [x] Restart-on-boot: docker.service enabled at boot + `restart: unless-stopped` on the container.
- [ ] Still needed before full HMD sync goes local: env vars for flight-display (YOUTUBE_VIDEO_ID, YOUTUBE_START_OFFSET, WS_URL, DOWNSAMPLE_FACTOR — currently only in Render dashboard). Request from Joel. Not blocking basic bring-up.

## Phase 2 — Cloudflare Tunnel (PLANNED, do NOT execute without Joel)
Joel must do (cloudflare login, DNS):
1. Create free Cloudflare account and add joelandrewmiller.com.
2. Move DNS from GoDaddy to Cloudflare (change nameservers at GoDaddy to Cloudflare's). This is the irreversible-feeling step — Joel approves explicitly.
3. Install/authenticate cloudflared (or use Zero Trust dashboard) and create a named tunnel.
4. Provide the tunnel token to this bot → fill `CLOUDFLARE_TUNNEL_TOKEN` in a `.env` (never committed) → uncomment the `cloudflared` service in docker-compose.yml.
5. Point the Cloudflare tunnel to `http://website:3000` (docker network) or `http://127.0.0.1:3000`.
Tunnel keeps inbound access without opening firewall ports. Do NOT cut over DNS / change nameservers without Joel's explicit go-ahead. Render keeps serving the live site throughout this phase.

## Phase 3 — Staged cutover from Render (PLANNED)
1. Verify local hosting stable for a soak period (health checks green, tunnel up, site served via Cloudflare).
2. Provisional DNS record via Cloudflare (proxied) pointing the domain at the tunnel.
3. Monitor; if stable, update Render service to stop / scale to 0 (Render side, Joel's action), keep repo as source of truth.
4. Decommission Render service + clean up. Joel approves each step.

## Notes / flags
- server.js health endpoints are `/health` and `/test`, not `/api/health` (mission brief mismatch — likely a red herring; the actual health route is `/health`).
- `camera_frames_flipped/` directory referenced by webdisplayServer.js is absent from the repo (warning only; webdisplay still works). Frames just won't be served.
- UDP socket for Godot bound to 127.0.0.1:1991 inside the container — fine.
- Leaderboard scores persist to a named volume (not committed, gitignored `leaderboard/scores.json`).
- Node 26 locally vs 18 in container — container matches Render (18.17.0). No ESM issues seen.
