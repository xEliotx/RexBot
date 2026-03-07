# RexBot (The Isle: Evrima)

## Quick map of the codebase

### Entry + wiring
- `src/index.js` – boots the Discord client, initializes RCON, and routes interactions.
- `src/config.js` – environment-based config (loads `.env`).

### Discord
- `src/discord/commands/*` – slash commands (`/ping`, `/setup`, etc.)
- `src/discord/interaction/routeInteraction.js` – routes buttons/selects/modals by `customId` prefix.
- `src/discord/admin/*` – admin panel handlers + audit helpers.
- `src/discord/link/*` – steam link flow (uses `data/links.json`).
- `src/discord/ui/panels.js` – message builders for panels.
- `src/discord/guards/*` – channel/permission guards.

### Server integration
- `src/rcon/*` – RCON client + player list parsing.
- `src/ftp/*` – FTP helpers (currently used for bans JSON).

### Storage
- `src/storage/jsonStore.js` – atomic JSON store with a write lock.
- `src/storage/stores.js` – instantiated stores (e.g., links).

## Setup
1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies: `npm i`
3. Start the bot: `npm start`

## Garage / Tokens
- `src/garage/` token + storage services
- `src/discord/garage/` Discord UI handlers for token actions
- `data/tokens.json` runtime token storage
- `data/garage.json` runtime snapshot storage
