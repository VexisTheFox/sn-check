# SerialCheck

SerialCheck is a web-based serial number authenticity checker with a modern frontend and an Express + SQLite backend. The app lets customers verify products while providing administrators with full CRUD controls, database maintenance tools, and rate-limit resets.

## Project Structure

```
front/   → Static single-page frontend (HTML, CSS, JavaScript)
back/    → Node.js + Express API, SQLite persistence, Docker assets
```

## Frontend (`front/`)

The frontend is a static single-page app that can be served from any static host (GitHub Pages, Caddy, Nginx, etc.). It communicates with the backend via the `/api` routes.

### Features

- Bulk serial check form (up to 10 serials per request)
- Color-coded results (verified, fake, unknown) with notes
- Admin login with persistent session token
- Admin dashboard for listing, adding/updating, deleting serials
- Quick actions: export database snapshot, reset rate limits, reformat database, clear all serials

### Local Preview

You can open `front/index.html` directly in a browser for development against a locally running backend:

```bash
# terminal 1
cd back
npm install
npm start

# then open front/index.html in your browser (or serve it with any static server)
```

For production, host the compiled files in `front/` behind the same domain as the API (so that relative `/api` requests succeed) or configure CORS appropriately.

## Backend (`back/`)

The backend exposes REST endpoints for public lookups and JWT-protected admin management.

### Prerequisites

- Node.js 20+
- npm

### Setup & Run

```bash
cd back
npm install
npm start
```

Environment variables can be supplied via a `.env` file (see `back/.env.example`) to override defaults such as port, SQLite path, admin credentials, JWT secret, rate limiter values, and CORS origin.

### Key Endpoints

Public (rate-limited):
- `GET /api/check/:sn`
- `POST /api/check-bulk` (JSON body `{ "serials": ["ABC123", ...] }`)

Admin (requires `Authorization: Bearer <token>`):
- `POST /api/admin/login`
- `GET /api/admin/list`
- `POST /api/admin/add`
- `DELETE /api/admin/delete/:sn`
- `POST /api/admin/clear`
- `POST /api/admin/reformat`
- `POST /api/admin/reset-rate`

### Docker Deployment

The backend directory ships with a `Dockerfile`, `docker-compose.yml`, and `Caddyfile` tailored for Alibaba Cloud Simple Application Server deployments. From the project root:

```bash
cd back
sudo docker-compose up -d --build
```

The compose stack builds the API container, mounts `./data` for persistent SQLite storage, and runs Caddy as an HTTPS reverse proxy.

## Development Notes

- The backend automatically seeds a default admin user on first launch (configure via `ADMIN_USER`/`ADMIN_PASS`). Update these credentials immediately in production.
- Rate limit counters can be cleared through the admin dashboard or by calling `/api/admin/reset-rate`.
- The export button in the frontend downloads the current serial database snapshot as JSON for backups or migrations.
- To customize styling, edit `front/styles.css`; functional behavior lives in `front/main.js`.

## License

MIT
