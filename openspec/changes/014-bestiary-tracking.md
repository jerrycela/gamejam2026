---
id: "014"
title: "Bestiary Tracking — Hero Encounter Log"
status: proposed
date: "2026-04-02"
specs_affected:
  - meta
  - result
risk: low
revision: 2
review_history:
  - round: 1
    codex: "78% NO — 1 P1 (finalizeRun mutates before UI reads), 1 P2 (heroDefeated includes captures), 1 P3"
    gemini: "90% YES — 0 P1, 1 P2, 3 P3"
    exit: "R1 fixes: finalizeRun returns newDiscoveries before merging; only count killed when captured===false; BattleManager calls gameState methods directly."
---

# Proposal 014: Bestiary Tracking

## Why

MetaState 已有 `bestiary` 骨架但從未寫入資料。加入圖鑑追蹤讓玩家知道遇過哪些英雄、擊殺了多少，增加收集感和重玩動力。MVP 只追蹤英雄（玩家的敵人），怪物圖鑑延後。

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| 追蹤對象 | 英雄（heroes）only，怪物延後 | 英雄是敵人、有驚喜感；怪物是自己的兵，已在 MonsterListUI 看到 |
| 資料結構 | `bestiary.heroes[typeId] = { seen: N, killed: N }` | 最簡結構，夠支撐圖鑑顯示 |
| 記錄時機 | `GameState` 在本局追蹤 → `MetaState.finalizeRun` 時寫入 bestiary | 確保持久化只在 run 結束 |
| 本局追蹤位置 | `GameState.heroEncounters = {}` — BattleManager heroSpawn/heroDefeated 時累加 | 不改 BattleManager emit 介面 |
| 記錄觸發 | GameScene 監聽 `heroSpawn` → `gameState.recordHeroSeen(typeId)` | 在 UI 層收集，不改 BattleManager |
| | GameScene 監聯 `heroDefeated` → `gameState.recordHeroKilled(typeId)` | |
| MetaState 寫入 | `finalizeRun` 內合併 `gameState.heroEncounters` → `this.bestiary.heroes` | 加法合併，不覆蓋 |
| ResultScene 顯示 | 若有首次遭遇的英雄 → 顯示「新發現！」列表 | 給玩家正向回饋 |
| 新圖鑑畫面 | **本次不做** | Game Jam 範圍限制，ResultScene 的新發現提示已足夠 |

## Implementation

### Affected Files

| File | Change | Lines |
|------|--------|-------|
| `src/models/GameState.js` | 加 `heroEncounters` + `recordHeroSeen` + `recordHeroKilled` | ~15 |
| `src/models/MetaState.js` | `finalizeRun` 合併 heroEncounters → bestiary.heroes | ~10 |
| `src/scenes/GameScene.js` | 監聽 BattleManager heroSpawn/heroDefeated → 記錄到 GameState | ~10 |
| `src/substates/FlipEventHandler.js` | `_endRun` 傳 heroEncounters 到 ResultScene data | ~2 |
| `src/scenes/ResultScene.js` | 顯示新發現英雄列表 | ~20 |

預估改動：~57 行（小型）

### Steps

1. `GameState` 加 `this.heroEncounters = {}`（key=typeId, value={seen:0, killed:0}）+ 兩個方法
2. `MetaState.finalizeRun(gameState, victory)` 加合併邏輯：
   ```js
   for (const [typeId, counts] of Object.entries(gameState.heroEncounters)) {
     if (!this.bestiary.heroes[typeId]) this.bestiary.heroes[typeId] = { seen: 0, killed: 0 };
     this.bestiary.heroes[typeId].seen += counts.seen;
     this.bestiary.heroes[typeId].killed += counts.killed;
   }
   ```
3. `GameScene` 在 BattleManager 事件綁定中加 heroSpawn/heroDefeated 監聽
4. `FlipEventHandler._endRun` 傳 `heroEncounters` 到 ResultScene
5. `ResultScene` 比對 metaState.bestiary.heroes 前後差異，顯示新遇到的英雄名稱

### Verification

- [ ] heroSpawn 觸發時 gameState.heroEncounters 正確累加 seen
- [ ] heroDefeated 觸發時 gameState.heroEncounters 正確累加 killed
- [ ] finalizeRun 正確合併到 metaState.bestiary.heroes
- [ ] bestiary 存入 localStorage 並跨 run 持久
- [ ] ResultScene 顯示首次遭遇的英雄（第一次看到的 typeId）
- [ ] 重複遭遇不顯示「新發現」
- [ ] ESLint 通過、build 成功
