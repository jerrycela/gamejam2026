---
id: "015"
title: "Bestiary UI — Hero Encyclopedia Screen"
status: proposed
date: "2026-04-02"
specs_affected:
  - meta
  - core
risk: low
revision: 2
depends_on: ["014"]
review_history:
  - round: 1
    codex: "88% NO — 1 P1 (current-run encounters invisible: bestiary only persists at finalizeRun), 2 P2 (MonsterListUI not scrollable; P014 dependency unstated), 2 P3"
    gemini: "95% YES — 0 P1, 3 P3"
    exit: "R1 fixes: BestiaryUI merges MetaState + GameState.heroEncounters for live current-run visibility; layout description corrected to 'capped list'; dependency on P014 made explicit."
---

# Proposal 015: Bestiary UI — Hero Encyclopedia Screen

## Why

P014 added bestiary tracking (heroEncounters → MetaState.bestiary.heroes), but players have no way to view this data. A 圖鑑 screen turns invisible persistence into a visible collection mechanic that drives replayability.

## What

Add a "bestiary" tab to GameScene that displays all heroes from `heroes.json`. Discovered heroes show full info (name, stats, skill, encounter counts). Undiscovered heroes show as locked silhouettes with "???".

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Tab position | 5th tab after 怪物 | Natural extension; low-frequency access |
| Data source | Merged: `MetaState.bestiary.heroes` + `GameState.heroEncounters` | Cross-run lifetime totals + current-run encounters visible immediately |
| Undiscovered display | Locked card with "???" | Teases content, encourages exploration |
| hero_of_legend | Always locked unless encountered; counts toward total shown | Boss-only hero, discovery is a reward |
| Layout | Capped vertical list (same pattern as MonsterListUI: max visible rows + "+N more" overflow) | Consistent UX, proven pattern — not scrollable |
| Discovery count | Show "遭遇 N 次 / 擊殺 N 次" (merged totals) | Simple, informative |

## Changes

### 1. New file: `src/substates/BestiaryUI.js`

- Class `BestiaryUI` following `MonsterListUI` pattern
- Constructor takes `(scene, metaState, gameState, dataManager)`
- `rebuild()` merges two data sources:
  - `metaState.bestiary.heroes[id]` — lifetime cross-run totals
  - `gameState.heroEncounters[id]` — current-run encounters (not yet persisted)
  - Merged counts: `seen = meta.seen + current.seen`, `killed = meta.killed + current.killed`
  - A hero is "discovered" if it exists in either source
- For each hero in `dataManager.getAllHeroes()`:
  - If discovered → show full card (name, type tags, HP/ATK/DEF, skill name+desc, merged seen/killed counts)
  - If not → show locked card (dark bg, "??? 未知英雄", "尚未遭遇")
- Row height ~100px (slightly taller than MonsterListUI's 72px for extra info)
- Max visible 6, "+N more" overflow text

### 2. `src/models/DataManager.js` — add `getAllHeroes()`

- Returns the full heroes array (already loaded in constructor)
- Needed because BestiaryUI iterates all heroes, not just encountered ones

### 3. `src/scenes/GameScene.js` — wire bestiary tab

- Add `'bestiary'` to `SUBSTATES` and `TAB_SUBSTATES`
- Add `{ label: '圖鑑', key: 'bestiary' }` to `TAB_DEFS`
- Import `BestiaryUI`, instantiate in `create()` with `(this, this.metaState, this.gameState, this.dataManager)`
- Add `'bestiary'` to the container skip list (line 62)
- `switchSubstate`: call `this.bestiaryUI.rebuild()` when entering bestiary

## Affected Files

| File | Change |
|------|--------|
| `src/substates/BestiaryUI.js` | **NEW** ~130 lines |
| `src/models/DataManager.js` | Add `getAllHeroes()` — 1 line |
| `src/scenes/GameScene.js` | Wire tab + instantiate — ~10 lines |

## Risk

Low. Pure additive UI, no gameplay logic changes, no state mutations. Reads only from existing MetaState + GameState data.

## Verification

1. `npm run build` passes
2. Tab bar shows 5 tabs, "圖鑑" is rightmost
3. Fresh game (no localStorage) → all heroes show as "???"
4. During a run, after encountering a hero in battle → switch to 圖鑑 tab → that hero shows with current-run seen/killed counts
5. After completing a run and starting a new one → bestiary retains lifetime totals from previous runs
