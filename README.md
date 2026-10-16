# CopyWeb Studio

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Deployment

This is a full-stack Node/Express application, not a static HTML folder. Deploy it on a Node/Docker service such as Render, Railway, Fly.io, or a VPS. The included `Dockerfile` is the safest path: build the image, expose port `3000`, and use `GET /api/health` as the health check. If using a dashboard, set the build command to `pnpm install --frozen-lockfile && pnpm build` and the start command to `pnpm start`; do not upload the ZIP as a static asset directory and do not set the entry file to `server/_core/index.ts`, because that will display source code in the browser. A Vercel drag-and-drop/static deployment is not a valid deployment for this full-stack package: it will not run Express, SSE, or `/api/crawl`, and may display source files as plain text.

The UI accepts `example.com`, `example.com/docs`, `https://example.com`, and `https://example.com/docs`. Inputs without a protocol are normalized to `https://` before crawling.

## Vercel

The project now includes `vercel.json` and Vercel Functions under `api/` for `/api/health`, `/api/crawl`, and `/api/crawl/stream`. In Vercel, import the repository or upload the latest package with **Framework Preset: Vite**, not Static, and keep the `vercel.json` file at the project root. The deployment must show `/api/health` as `{"status":"ok"}` before the crawler can run.
