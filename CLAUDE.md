# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Dungeon Lord Startup (魔王創業) — a roguelike dungeon management game for Game Jam 2026.
Phaser 3.87 + Vite, vanilla JavaScript (ES6 modules), CANVAS renderer (not WebGL).
Mobile web target: 375x812 portrait. No backend — state in localStorage.

## Commands

- `npm run dev` — start Vite dev server (auto-opens browser)
- `npm run build` — production build to `dist/`
- `python3 -m http.server 8080 -d preview/` — preview static HTML mockups
- `npm run lint` — ESLint check on `src/`
- No test framework (Game Jam scope, all tasks use `[SKIP-TDD]`)

## Architecture

- **Scenes:** BootScene (loading + menu) → GameScene (6 substates) → ResultScene
- **Substates:** FlipMatrix, DungeonMap, CardPick, Battle, Torture, MonsterList
- **Models:** GameState (per-run), MetaState (cross-run, localStorage), BattleManager, DataManager
- **Data-driven:** All game entities (monsters, heroes, rooms, traps, shop) live in `src/data/*.json`. New entity types go in JSON, not hardcoded.
- **Constants:** Shared weights and config in `src/utils/constants.js`

## Development Workflow (OpenSpec/Spectra)

Any code change must go through OpenSpec: propose (`openspec/changes/`) → review → apply.
Proposals follow: why + what + affected files + risk + verification criteria.
Design spec: `@docs/superpowers/specs/2026-04-01-dungeon-lord-startup-design.md`

## Conventions

- Commit format: `<type>(p<number>): <description>` — e.g. `feat(p010): add trap effects`
- Types: `feat`, `fix`, `docs`, `propose`, `refactor`
- Chinese comments are normal; JSDoc for public methods
- Classes: PascalCase. Methods/props: camelCase. Constants: SCREAMING_SNAKE_CASE
- Art assets generated via nano banana (Gemini Imagen), stored in `reference/` (not tracked)
