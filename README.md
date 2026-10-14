# Quiet Day — personal executive-function journal

A local-first, journal-inspired PWA prototype designed around **Reflect → Plan → Begin**. Created as a deliberately narrow foundation; it is **not** a complete AI assistant yet.

## Run

```bash
npm install
npm run dev
```

Open the printed local URL. For a production build: `npm run build`.

## Implemented in this starter

- Mobile/desktop minimal journal interface with dark mode
- Journal entries and task list persisted using Dexie/IndexedDB
- Task creation, completion, and manual focus selection
- Basic focus timer and an 'I'm stuck' prompt
- JSON export and replacement import for backup

## Not implemented yet

- Gemini 3.8 Flash assistant, task extraction, or real AI body-doubling. Requires a secure API relay and reliable structured-output workflow; **never add an API key to frontend code**.
- GitHub Gist sync. Requires careful conflict detection and encryption of journal data before upload; a secret Gist is unlisted, not private.
- Background notifications, unattended automatic check-ins, install icons/service worker, or production-grade multi-device sync.

## Product principles

1. No new planning ritual required to check tasks.
2. Planning must always terminate in a concrete next action.
3. Avoid streaks, reward scores, pressure, and unnecessarily verbose AI conversation.
4. Keep local data usable without network access; never silently overwrite another device's work.
5. Prioritize completion and reliability over new features.

## Suggested next build sequence

1. Secure Gemini serverless relay with explicit request budgets; typed, validated plan proposals that require user approval.
2. Structured projects, next actions, and journal-linked planning without duplicating Apple Calendar/Reminders.
3. Focus session recovery, real timers and opt-in check-in notifications.
4. Client-side encrypted Gist snapshots, revision checking, multi-device conflict resolution, and backup recovery tests.
5. PWA service worker/icons and real device testing, then a feature freeze.

## Data privacy

Journal contents live in your browser's local IndexedDB. Clearing site data can delete them, so **export backups**. Do not treat this starter as secure cloud storage or clinical software.

## Deploy to GitHub Pages

1. Create a GitHub repository (for example `quiet-day`).
2. Upload the **contents** of this folder to the repository root on the `main` branch, including `.github/workflows/deploy.yml`. Do not upload the ZIP itself.
3. In GitHub: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. In the **Actions** tab, open the deployment workflow and verify it succeeds. Your project site will normally be at `https://YOUR_USERNAME.github.io/quiet-day/`.
5. Future pushes to `main` will deploy automatically.

This project sets Vite's asset base to `./` so it works in both project Pages subpaths and user-site roots. GitHub Pages hosts **static frontend code only**; do not put your Gemini API key or a GitHub write token into committed frontend files. The starter stores data only in each browser's IndexedDB; phone and desktop do **not** sync yet. This is not yet a complete installable/offline PWA (no service worker or icons).
