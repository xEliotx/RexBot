# RexBot (sanitized build)

This build keeps the core Discord bot, ticketing, welcome flow, rules posting, and the RCON-backed player count/server status updaters.

Removed from this package:
- live `.env` secrets
- `node_modules` and cache folders
- Steam link flow
- garage/token storage features
- FTP helpers and related token/safelog code
- admin RCON moderation tools
- `playerdata` slash command

Kept in this package:
- bot startup and slash command registration
- rules / guide system
- ticket panel and inactivity watcher
- welcome system
- player count updater
- server status updater
- Evrima RCON client required by the two status updaters

## Setup
1. Copy `.env.example` to `.env` and fill in your values.
2. Run `npm install`.
3. Run `npm run commands:register`.
4. Run `npm start`.
