# Contributing to AR-Native-OpenClaw

## Getting Started

1. Fork the repo
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feature/my-change`
5. Make your changes
6. Run `pnpm build && pnpm lint` to verify
7. Commit and push
8. Open a pull request

## Project Structure

- `shared/` -- Cross-platform types and utilities used by all plugins
- `even-realities-g2/` -- Plugin for Even Realities G2 (BLE protocol)
- `rokid/` -- Plugin for Rokid Glasses (Android companion app bridge)
- `meta-raybans/` -- Plugin for Meta Ray-Bans (DAT companion app bridge)

Each plugin is an independent npm package in a pnpm workspace.

## Adding Support for a New Device

1. Create a new directory at the repo root (e.g. `xreal/`)
2. Add it to `pnpm-workspace.yaml` and the root `package.json` workspaces
3. Follow the structure of existing plugins:
   - `src/index.ts` -- plugin entry with `register(api)` export
   - `src/channel.ts` -- OpenClaw channel adapter
   - `src/tools.ts` -- agent tools
   - Hardware-specific connection code in a subdirectory
4. Add the `@ar-openclaw/shared` dependency for common types
5. Update the root README with device info

## Code Style

- TypeScript strict mode
- ES modules (`"type": "module"` in package.json)
- No default exports except the plugin `register` function
- Prefer explicit types over `any` (use `any` only for the OpenClaw plugin API until official types are published)

## Testing

Each plugin should include tests runnable via `node --test`. Place test files alongside the source with a `.test.ts` extension.

## Companion Apps

The Rokid and Meta Ray-Ban plugins rely on companion mobile apps. If you're contributing to the companion app layer:

- Android companion apps use Kotlin/Gradle
- iOS companion apps use Swift
- Both expose a WebSocket server for the plugin to connect to
- Document the WebSocket message protocol in the companion app README
