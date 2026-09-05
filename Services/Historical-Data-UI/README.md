# Historical Data UI

React UI for EOD and intraday OHLCV bars served by the Historical Data API.

## Docker

From `compose/`:

```bash
docker compose up
```

Opens at `http://localhost:8080`. The `ui` service starts with the API.

## Local

Start the stack (`cd compose && docker compose up`), then from this directory:

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` and proxies `/v1` and `/health` to `http://localhost:8000`.

Optional: set `VITE_API_BASE_URL` to point at the API directly (requires CORS).
