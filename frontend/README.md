# Frontend

This is now a React frontend for the completed content broadcasting backend.

## Stack

- React
- Vite
- Plain CSS

## What it covers

- Login and registration for `teacher` and `principal`
- Teacher upload flow with optional scheduling fields
- Teacher content listing and schedule updates
- Principal pending approval queue with rejection reasons
- Principal full content browsing with filters
- Public live-content lookup by teacher ID and optional subject

## How to run

1. Install dependencies:

```bash
cd /Users/aamirdev/github/content-broadcast/frontend
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open the local URL Vite prints, usually [http://localhost:5173](http://localhost:5173).

## Backend target

The app defaults to `http://localhost:3000`, and you can change that from the connection panel in the UI.
