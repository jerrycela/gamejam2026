---
id: "007"
title: "MonsterList UI — Roster Viewer, Stats, Placement Entry Point"
status: proposed
date: "2026-04-01"
specs_affected:
  - units
  - dungeon-map
risk: low
revision: 3
review_history:
  - round: 1
    codex: "60% NO — 2 P1, 2 P2"
    gemini: "80% YES — 0 P1, 2 P2, 2 P3"
    exit: "R1 P1s fixed: _onRecall 改用 removeCellMonster 原子 API, 已部署列顯示 cellId。P2s: GameScene skip 條件補 monsterList, 捲動砍掉改固定列表。"
  - round: 2
    codex: "92% YES — 0 P1, 2 P2, 1 P3"
    gemini: "90% YES — 0 P1, 2 P2"
    exit: "P1=0, 雙方 YES。P2s (getContainer/roster cap/stat lookup) 為 spec 精確度問題，實作時自然解決。P3 startY 改用常數推導。"
---

# Proposal 007: MonsterList UI

## Why

六個 tab 中「怪物」是最後一個空殼。玩家目前無法查看自己的怪物名冊、確認誰放在哪、或從名冊發起放置。刑求轉化產出的新怪物也無處可見。MonsterList UI 讓名冊變成可互動的管理介面，補完核心迴圈的最後一塊 UI。

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| 佈局 | 固定垂直列表，每列一隻怪物 | 怪物數量 2-8 隻，756px 可視區可容納 8 列 x 72px，不需捲動 |
| 資訊密度 | 名稱 + HP/ATK + 狀態標籤 + 部署位置 | 滿足「確認誰放在哪」需求 |
| 放置入口 | 列表中「放置」按鈕 → 切到 dungeonMap + enterMonsterPlacement | 複用既有 DungeonMapUI 放置流程，不重造 |
| 收回入口 | 已放置怪物顯示「收回」按鈕 → removeCellMonster(cellId) | 原子 API，同步清 cell.monster + placedCellId |
| buff 指示 | 轉化怪物旁顯示小 badge「強化」 | 視覺區分 initial vs converted（用 buffFlags.converted） |
| 空狀態 | 名冊為空時顯示提示文字 | 防禦性設計 |

## Affected Files

| File | Change |
|------|--------|
| `src/substates/MonsterListUI.js` | **新增** — 完整 UI class |
| `src/scenes/GameScene.js` | 接線：import, 建構, switchSubstate 呼叫 rebuild, placeholder skip 條件加 'monsterList' |

## Implementation

### MonsterListUI class

```
constructor(scene, gameState, dataManager)
  - _scene, _gameState, _dataManager refs
  - _rootContainer

rebuild()
  - removeAll(true)
  - 取 gameState.monsterRoster
  - 空 → 顯示「尚無怪物」
  - 非空 → _buildTitle() + _buildList()

_buildTitle(width)
  - 「怪物名冊」+ 數量

_buildList(width, height)
  - ROW_HEIGHT = 72, startY = 120, 每列：
    - 左側：怪物名稱（dataManager.getMonster(typeId).name）
    - 中間：HP / ATK 數值（含 buff 加成計算）
    - 右側：狀態 badge + 動作按鈕
  - 狀態判斷：
    - placedCellId !== null → 「已部署」灰標 + cellId 顯示 + 「收回」按鈕
    - placedCellId === null → 「待命」綠標 + 「放置」按鈕
  - buff badge：buffFlags.converted === true → 「強化」黃標

_onPlace(instanceId)
  - scene.switchSubstate('dungeonMap')
  - scene.dungeonMapUI.enterMonsterPlacement(instanceId)

_onRecall(instanceId)
  - 從 monsterRoster 找到 instance，取 placedCellId
  - gameState.removeCellMonster(placedCellId)  // 原子：清 cell.monster + placedCellId=null
  - rebuild()
```

### GameScene 接線

```
// create() 中 — placeholder skip 條件加 'monsterList'
if (key !== 'flipMatrix' && key !== 'dungeonMap' && key !== 'torture' && key !== 'monsterList') {

// create() 中 — 建構
this.monsterListUI = new MonsterListUI(this, this.gameState, this.dataManager);
this.containers.monsterList.add(this.monsterListUI.getContainer());

// switchSubstate() 中
if (name === 'monsterList' && this.monsterListUI) {
  this.monsterListUI.rebuild();
}
```

## Stat Display Calculation

HP 和 ATK 需要反映 buff：
```
displayHp  = Math.round(monsterDef.baseHp  * instance.buffFlags.hpMult)
displayAtk = Math.round(monsterDef.baseAtk * instance.buffFlags.atkMult)
```

## Risks

- **低風險**：純 UI 層，不修改 model 邏輯（removeCellMonster 已存在）
- 放置後切回 monsterList 需要 rebuild 確保狀態同步 — switchSubstate 已呼叫 rebuild
- removeMonster 在戰鬥中被呼叫的風險 — MonsterList tab 在戰鬥中不可切換（已有 tab lock）

## Verification

- [ ] 怪物 tab 顯示完整名冊（初始 2 隻 + 轉化怪物）
- [ ] 每列顯示名稱、HP/ATK（含 buff 加成）、狀態標籤
- [ ] 已部署怪物顯示 cellId
- [ ] 「放置」按鈕切到地圖並進入放置模式
- [ ] 「收回」按鈕將怪物移回待命，列表即時更新，地圖同步清除
- [ ] 轉化怪物顯示「強化」badge
- [ ] build 通過
