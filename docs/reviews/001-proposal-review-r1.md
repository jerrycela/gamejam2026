# Review Round 1 — Proposal 001

Date: 2026-04-01

## Results

| Reviewer | Readiness | Verdict |
|----------|-----------|---------|
| Gemini (gemini-2.5-pro) | 70% | NO |
| Codex (gpt-5.4) | 61% | NO |

## Adjudication

| # | Sev | Finding | Decision | Action |
|---|-----|---------|----------|--------|
| G-P1 | P1 | dungeonGrid 資料結構未定義 | AGREE | Added GridCell schema to core/spec.md |
| C-P1a | P1 | 轉化怪物不可落地（動態新怪物超出 MVP） | AGREE | Changed to "unlock existing base monster + stat buff" |
| C-P1b | P1 | 刑求槽位單局 vs 永久衝突 | AGREE | Clarified as per-run only, removed from meta |
| C-P1c | P1 | Viewport/地圖捲動未封口 | AGREE | Added Scale.FIT, camera scroll, pan/tap arbitration, map 375x1200 |
| G-P2a | P2 | FlipMatrix/DungeonMap 關係模糊 | AGREE | Added scene-substate flow diagram to core/spec.md |
| C-P2a | P2 | specs_affected 缺 meta | AGREE | Added meta |
| C-P2b | P2 | 解鎖規則不可計算 | AGREE | Added full unlock matrix to meta/spec.md |
| C-P2c | P2 | 路徑岔路行為未定義 | AGREE | Added greedy shortest-path rule to map/spec.md |
| C-P2d | P2 | 放置互動流程不一致 | AGREE | Unified to "select first, then place" in map/spec.md |
| C-P2e | P2 | 擊殺/俘虜事件順序不清 | AGREE | Added strict 5-step event pipeline to battle/spec.md |
| G-P2b | P2 | 地圖捲動效能 | PARTIAL | Merged into C-P1c |
| C-P3a | P3 | 8 Scene 太多 | AGREE | Reduced to 3 scenes + substates |
| C-P3b | P3 | JSON schema 缺欄位 | PARTIAL | Added spriteKey fallback only, rest deferred |
| C-P3c | P3 | risk: low 太樂觀 | AGREE | Changed to medium |
| G-P3 | P3 | 缺中斷存檔 | REJECT | Game Jam single run is short (15 cards), not needed |

## Modified Specs

- core/spec.md v1.0 → v1.1 (GridCell schema, scene→substate architecture)
- map/spec.md v1.0 → v1.1 (viewport, camera scroll, placement flow, pathfinding)
- battle/spec.md v1.0 → v1.1 (defeat event pipeline)
- torture/spec.md v1.0 → v1.1 (per-run slots, MVP conversion mapping)
- meta/spec.md v1.0 → v1.1 (unlock matrix, default seed, removed torture slots)
- 001-initial-project-setup.md (added meta to affected, risk → medium)
