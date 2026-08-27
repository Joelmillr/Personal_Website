# Local hosting + Cloudflare Tunnel plan — personal-website

Status: Phase 1 (local Docker bring-up) in progress. Phases 2-3 staged, NOT started.

## Phase 1 — Local Docker hosting (in progress)
- [x] Inspect stack: Node 18 + Express + Socket.IO, static `public/`, health at `/health` (note: the mission brief says `/api/health` but the server actually exposes `/health` and `/test`; `/api` is the webdisplay API mount. Healthcheck uses `/health`.)
- [x] Smoke-test locally with plain node on port 3100 — all endpoints OK (health, `/`, `/test`, `/api/leaderboard`, `/webdisplay/`).
- [x] Author Dockerfile (node:18.17.0-bookworm-slim, npm install + preprocess at build, HEALTHCHECK on `/health`, non-root user), docker-compose.yml (restart: unless-stopped, healthcheck, leaderboard volume, commented cloudflared placeholder), .dockerignore.
- [x] `docker compose config` validates.
- [ ] BLOCKED: build + run the container. joel has no docker socket access (not in `docker` group) and `docker.service` is disabled (no restart-on-boot). Fixes are system-level:
  - `sudo usermod -aG docker joel` (or rootless docker setup), and
  - `sudo systemctl enable --now docker` (restart-on-boot)
  - Pending Atlas Manager approval + Joel (needs sudo password).
- [ ] Env vars for flight-display HMD (currently only in Render dashboard): YOUTUBE_VIDEO_ID, YOUTUBE_START_OFFSET, WS_URL, DOWNSAMPLE_FACTOR. Request from Joel before cutover. Not blocking basic bring-up (server has sane defaults).
- [ ] Health check + restart-on-boot verified after container runs.

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
