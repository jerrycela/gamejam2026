---
id: "002"
title: "FlipMatrix Substate — 3x5 Card Matrix + Flip Animation + Event Stubs + CardPick Modal"
status: approved
date: "2026-04-01"
specs_affected:
  - cards
  - core
risk: medium
revision: 3
review_history:
  - round: 1
    codex: "60% NO — 4 P1"
    gemini: "65% NO — 2 P1, 5 P2"
  - round: 2
    codex: "91% YES — 0 P1, 1 P2 (spec drift)"
    gemini: "85% NO — 0 P1, 2 P2, 2 P3 (input lock scope, shop UX)"
    exit: "P1=0, Codex YES 91%, new P2<=1 per model. R3 fixes applied inline."
---

# Proposal 002: FlipMatrix Substate (Rev.2)

## Why

FlipMatrix 是核心遊戲迴圈的入口。沒有它，Battle/DungeonMap/Torture 都無法被觸發。

## Data Schemas

### FlipCard (GameState.flipMatrix 元素)

```js
// GameState.flipMatrix: FlipCard[5][3] (5 rows x 3 cols)
{
  row: 0,          // 0-4
  col: 0,          // 0-2
  eventType: 'normalBattle', // see EVENT_TYPES
  flipped: false,
  resolved: false  // true after event effect fully processed
}
```

### EVENT_TYPES 常數

```js
const EVENT_TYPES = {
  normalBattle: { weight: 30, label: '普通戰鬥', color: 0xc0392b },
  eliteBattle:  { weight: 15, label: '精英戰鬥', color: 0xe67e22 },
  bossBattle:   { weight: 5,  label: '地宮 Boss', color: 0x8e44ad },
  activity:     { weight: 25, label: '事件',      color: 0x27ae60 },
  treasure:     { weight: 15, label: '寶藏',      color: 0xf1c40f },
  shop:         { weight: 10, label: '商店',      color: 0x2980b9 },
};
```

### HandCard (GameState.hand 元素)

```js
{
  type: 'room' | 'trap',
  id: 'hatchery',    // references rooms.json or traps.json
  starRating: 1      // 1-3 for MVP (affects base level when placed)
}
```

### CardPickRequest

```js
{
  source: 'paidDraw' | 'activityReward',
  cost: 0,            // only charged for paidDraw
  options: HandCard[]  // 3 cards to choose from
}
```

## What

### 1. FlipMatrix 生成器 (`src/models/FlipMatrixGenerator.js`)

- `generate()` → 回傳 `FlipCard[5][3]`（2D array，5 rows x 3 cols）
- 依 EVENT_TYPES.weight 加權隨機分配 15 張
- **Boss 規則**：每天最多 1 張 bossBattle。多出的轉為 eliteBattle
- 寫入 `GameState.flipMatrix`

### 2. FlipMatrix UI (`src/substates/FlipMatrixUI.js`)

由 GameScene 建立，加入 `containers.flipMatrix`。

**佈局（375x812，扣除 top HUD 48px + bottom tab 56px = 可用 708px）：**
- 卡片尺寸 90x120px，間距 10px
- 總寬：90*3 + 10*2 = 290px，水平置中
- 總高：120*5 + 10*4 = 640px，放入 708px 可用空間

**卡片視覺：**
- Face-down：深紫色底 #2d2d4e + "?" 白色文字 + 1px 亮邊框
- Face-up：依 EVENT_TYPES.color 填色 + label 文字

**翻牌動畫（300ms total）：**
- scaleX: 1→0（150ms, easeIn）→ 換視覺 → scaleX: 0→1（150ms, easeOut）
- 翻轉時 y 偏移 -4px

**Input lock**：從 pointerdown 開始設 `this._isProcessing = true`，禁用所有卡片互動。直到 `flipCard.resolved = true` 且所有附帶效果（toast、獎勵動畫、modal）完成後才解鎖。範圍涵蓋翻牌動畫 + 事件處理全流程。

### 3. 事件處理 (`src/substates/FlipEventHandler.js`)

翻牌後呼叫 `handleEvent(flipCard, gameState, gameScene)`。

**Battle events (normalBattle / eliteBattle / bossBattle)**：
- 顯示 toast "戰鬥開始！" 1 秒
- 呼叫 `gameScene.switchSubstate('dungeonMap')` 然後 `gameScene.showBattleOverlay(eventType)` → battle overlay 在 dungeonMap 上方（battle container visibility ON）
- 這符合 core spec：Battle = overlay on DungeonMap
- **Battle stub 內容**：placeholder 文字 + "結束戰鬥" 按鈕
- 點擊「結束戰鬥」→ 隱藏 battle overlay → `gameScene.returnToPreviousSubstate()` → 回到 flipMatrix
- 標記 `flipCard.resolved = true`

**Activity**：
- 隨機分支（加權）：
  - 60% 觸發 CardPick（source: 'activityReward', cost: 0）
  - 20% 直接獲得金幣 50-150
  - 20% 直接獲得 1 張隨機 HandCard 加入 hand
- 顯示獎勵 toast
- 標記 resolved

**Treasure**：
- 直接獲得金幣 100-300
- 更新 HUD 金幣顯示
- 標記 resolved

**Shop**：
- 顯示 shop modal：3 張隨機卡牌（rooms + traps，均勻隨機）
- 每張固定價格：room 100g, trap 80g
- 購買 → 扣金 + 加入 hand，該項灰化（不可重複購買），玩家可繼續購買其他商品
- 「離開」按鈕關閉 modal（玩家自行決定何時離開）
- Shop modal 使用 cardPick container（z-order 最高）
- 標記 resolved

### 4. CardPick Modal

**使用既有 `containers.cardPick`**（已在 GameScene SUBSTATES 中定義）。此 container 不參與 tab 切換，只作為最上層 modal，用 show/hide 控制。

**行為**：
- `openCardPick(request: CardPickRequest)` — 顯示 3 張卡
- 半透明黑底遮罩（depth 最高）
- 3 張卡牌並排（100x150px，間距 16px）
- 每張顯示：type icon + name + starRating
- 點擊選擇 → 加入 GameState.hand → 關閉 modal → callback
- 「跳過」按鈕（右上角）→ 不加入任何卡 → 關閉 modal → callback

**兩種入口明確分離**：
- `paidDraw`：先檢查 gold >= getDrawCost()，扣金 → drawCount++ → openCardPick
- `activityReward`：直接 openCardPick，cost=0，不影響 drawCount

**跳過規則**：
- `paidDraw` 跳過：drawCount++ 已在開啟時處理，金幣已扣，不退費
- `activityReward` 跳過：無任何消耗

**卡池**：rooms + traps 均勻隨機（MVP 不做 rarity 權重，R1 指出 JSON 無 weight 欄位）。starRating 隨機 1-3（70% 1星, 25% 2星, 5% 3星）。

### 5. Top HUD (`src/substates/TopHUD.js`)

固定在 flipMatrix container 頂部 48px：
- 左：`Day ${gameState.day}` 白色粗體
- 中：金幣數量 金色
- 右：「抽卡」按鈕 + 費用標示。金幣不足時 disabled（灰色）

### 6. Substate 導航增強 (`GameScene.js` 修改)

- 新增 `this._substateHistory: string[]`（最近 5 筆）
- `switchSubstate(name)` 時 push 前一個到 history
- `returnToPreviousSubstate()` — pop history 回到前一個 substate
- `showBattleOverlay()` / `hideBattleOverlay()` — 控制 battle container visibility（不影響底下的 dungeonMap）
- `cardPick` container 從 tab 切換邏輯中排除，專用於 modal

### 7. GameState 整合

- `initFlipMatrix()` method — 呼叫 FlipMatrixGenerator，結果存入 `this.flipMatrix`
- `flipCard(row, col)` — 設 flipped=true，回傳 FlipCard
- `resolveCard(row, col)` — 設 resolved=true
- `isMatrixComplete()` — 檢查 15 張是否都 resolved
- `advanceDay()` — day++，呼叫 initFlipMatrix() 重生 matrix
- **Day transition 流程**：最後一張卡的事件效果完全結算後 → 顯示「本日結束」toast 2 秒 → 自動 advanceDay()。Run end 判定不在本 proposal 範圍，固定永遠 day++。

## Affected Files

```
new:      src/utils/constants.js (EVENT_TYPES, STAR_WEIGHTS — 中央常數供各模組 import)
new:      src/models/FlipMatrixGenerator.js
new:      src/substates/FlipMatrixUI.js (建構 flipMatrix container 內部的 UI 元件)
new:      src/substates/FlipEventHandler.js
new:      src/substates/CardPickUI.js (封裝 containers.cardPick 的顯示/隱藏/互動邏輯)
new:      src/substates/TopHUD.js
modified: src/scenes/GameScene.js (substateHistory, battle overlay, cardPick modal exclusion)
modified: src/models/GameState.js (initFlipMatrix, flipCard, resolveCard, isMatrixComplete, advanceDay)
modified: openspec/specs/cards/spec.md (MVP deviation: 均勻隨機取代 rarity weight, 1-3星取代 1-5星)
```

## Verification

1. `npm run dev` → 開始遊戲 → 看到 3x5 翻牌矩陣，卡牌 face-down
2. 點擊卡牌 → 翻轉動畫 300ms → 顯示事件類型和顏色
3. 翻牌動畫期間點擊其他卡牌 → 無反應（input lock）
4. 翻到 treasure → 金幣增加 + HUD 即時更新
5. 翻到 battle → 切到 dungeonMap + battle overlay（placeholder + 結束按鈕）→ 點結束 → 回到 flipMatrix
6. 翻到 activity → 可能觸發 CardPick（3 張卡，免費）
7. 點「抽卡」按鈕 → 第 1 次免費 CardPick，第 2 次 50g → drawCount 遞增
8. 跳過 CardPick → paidDraw 時金幣不退
9. 15 張全 resolved → 「本日結束」toast → 自動生成新 matrix，Day+1
10. Tab 切換再回來 → matrix 狀態保留

## Risk

Medium — 主要風險：
- scaleX 翻轉在低性能裝置可能卡頓（可後續改用 shader）
- event stub 的介面設計需確保後續 proposal 無縫接入
- 卡片尺寸在極端螢幕比例可能需微調
