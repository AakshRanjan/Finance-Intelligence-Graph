# FIG UI

React shell for Finance Intelligence Graph. Modules register in `src/modules/registry.ts`; Historical Data is the first module. `/` is the home page of module icons. Opening a module shows a left sidebar of that module’s sub-modules (Charts for Historical Data).

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

## Adding a module

1. Create `src/modules/<id>/` with page components and `index.ts` that exports a `FigModule` (`id`, `title`, `description`, `path`, `icon`, `children`).
2. Append that export to `modules` in [`src/modules/registry.ts`](src/modules/registry.ts).

Home, the router, and the module sidebar all read that list. Keep module API clients under the module folder so they stay independent.

## Adding a sub-module

1. Add a page component under the module folder.
2. Append a `FigSubModule` (`id`, `title`, `path`, `icon`, `Component`) to that module’s `children`. `path` is relative (for example `charts` → `/historical-data/charts`).

The module sidebar and nested routes both read `children`.
