---
id: "003"
title: "DungeonMap Substate — Scrollable Grid + Cell Placement + Hand Area"
status: approved
date: "2026-04-01"
specs_affected:
  - map
  - core
risk: medium
revision: 4
review_history:
  - round: 1
    codex: "74% NO — 3 P1, 3 P2"
    gemini: "65% NO — 2 P1, 3 P2, 1 P3"
  - round: 2
    codex: "86% NO — 1 P1, 2 P2"
    gemini: "95% YES — 0 P1, 0 P2, 2 P3"
  - round: 3
    codex: "71% NO — 1 P1 (setCellMonster ordering), 1 P2 (spec file not yet modified)"
    gemini: "skipped (R2 already YES 95%)"
    exit: "R3 Codex P1 fixed in Rev.4 (removeMonster before placeMonster). P2 clarified as apply-time action. P1=0, Gemini YES 95%."
---

# Proposal 003: DungeonMap Substate

## Why

DungeonMap 是玩家配置地城防禦的核心界面。FlipMatrix 產出的卡牌需要放到地圖上才有意義，Battle substate 也需要在 DungeonMap 之上疊加。沒有地圖，遊戲的策略深度為零。

## Data Schemas

### GridCell (GameState.dungeonGrid 元素)

已在 core/spec.md 定義，本 proposal 遵循：

```js
{
  id: 'cell_01',
  type: 'normal' | 'portal' | 'heart',  // portal=英雄入口, heart=魔王房
  position: { x: 150, y: 275 },         // 邏輯座標（地圖世界空間）
  connections: ['cell_02', 'cell_03'],   // 有向邊，指向下游（朝 heart）
  room: { typeId: 'hatchery', level: 1 } | null,
  trap: { typeId: 'fire', level: 1 } | null,
  monster: { instanceId: 'm_001', typeId: 'rage_demon', currentHp: 120 } | null
}
```

**Spec extension**：新增 `type` 欄位區分特殊節點（core/spec.md GridCell 原無此欄位）：
- `portal`：英雄入口，不可放置 room/trap/monster
- `heart`：魔王房，不可放置（Boss 固定佔據）
- `normal`：可配置的一般格子

### SelectionState（DungeonMapUI 內部狀態）

```js
{
  mode: 'none' | 'card' | 'monster',
  handIndex: -1,       // mode='card' 時，hand 中的 index
  monsterId: null,     // mode='monster' 時，MonsterInstance.instanceId
}
```

## What

### 1. GridTopologyGenerator (`src/models/GridTopologyGenerator.js`)

**職責**：生成一局的地城格子佈局，回傳 `GridCell[]`。

**演算法**：
1. 地圖世界寬 375px，高 1200px
2. 垂直分 6 層（row 0 = portal, row 1-4 = normal, row 5 = heart）
3. 每中間層水平分佈 2-3 個節點，x 軸隨機偏移（±30px jitter）
4. **節點數量保證**：4 中間層中至少 1 層必須有 3 個節點，確保 normal cells >= 9。生成後檢查，不足 9 則重新分配
5. 層間連線：每個節點至少連到下一層 1 個節點，每個下一層節點至少被上一層 1 個連到
6. 生成結果：1 portal + **9-12 normal cells** + 1 heart = 11-14 total nodes
7. **驗證**：生成後 BFS 確認 portal 到 heart 至少一條完整路徑，否則重新生成（最多 10 次）

**具體步驟**：
```
Row 0: 1 portal node (x=187, y=60)
Row 1: random 2-3 nodes (y=260)
Row 2: random 2-3 nodes (y=460)
Row 3: random 2-3 nodes (y=660)
Row 4: random 2-3 nodes (y=860)
Row 5: 1 heart node (x=187, y=1060)
// 生成後驗證: sum(row1..4 nodes) must be in [9,12]
// 若 < 9: 隨機選一個 2-node row 增加到 3
// 若 > 12: 隨機選一個 3-node row 減少到 2（理論上 4*3=12 不會超過）
```

連線：row N 的每個節點隨機連到 row N+1 的 1-2 個節點。掃描確保 row N+1 每個節點至少有 1 個入邊（沒有的話從 row N 隨機一個補連）。

**API**：
```js
static generate() → GridCell[]
```

### 2. DungeonMapUI (`src/substates/DungeonMapUI.js`)

由 GameScene 建立，管理 `containers.dungeonMap` 內的所有 UI。

**架構**：
- **Spec deviation (scroll)**：原 spec 要求 `camera.scrollX/scrollY` + `setBounds`。但 GameScene 多 substate 共用同一 scene/camera，camera scroll 會影響其他 substate。改用 container-based scroll（`mapWorldContainer.y`）。**此 deviation 需同步更新 map/spec.md**（見 Spec Changes 段落）
- 固定 UI（TopHUD + hand area + tab bar）不在 mapWorldContainer 內
- 靜態背景（羊皮紙 + path lines）用 `RenderTexture` 預渲染（符合 spec performance 要求），只有 cell 內容是 live objects

**地圖 container 結構**：
```
dungeonMapContainer (this.containers.dungeonMap)
  ├─ mapWorldContainer (y 隨 scroll 變動)
  │   ├─ bgTexture (RenderTexture: 羊皮紙底 + path lines)
  │   ├─ cellSprites[] (每個 GridCell 的視覺物件)
  │   └─ pathGraphics (chain-link path lines)
  ├─ handAreaContainer (固定在底部, y = height - TAB_BAR_H - 64)
  └─ selectionIndicator (當前選中卡牌/怪物的高亮)
```

**觸控仲裁（Pan vs Tap）**：
- `pointerdown`：記錄起始位置 `(startX, startY)`，設 `isPanning = false`。**若 pointerdown 時慣性滾動中 → velocity 立即歸零，停止慣性**
- `pointermove`：若距離 > 8px → `isPanning = true` → 更新 `mapWorldContainer.y`（delta clamp 在 bounds 內）
- `pointerup`：若 `!isPanning` → 判定為 tap → hitTest 找到對應 cell → 執行互動
- **慣性滾動**：pointerup 時計算最後 3 幀平均速度 → `this._velocityY`。scene.update() 每幀：`mapWorldContainer.y += _velocityY`，`_velocityY *= 0.92`（~300ms 衰減到 < 1px）。當 `|_velocityY| < 0.5` 時歸零

**Touch 區域隔離（Hand Area vs Map）**：
- Hand area container 設定獨立的 `setInteractive()` 區域（覆蓋 64px 高度）
- Hand area 內的 `pointerdown` → 設 `_isHandTouch = true`，所有後續 pointermove 只處理水平 hand scroll，不觸發 map vertical scroll
- **Scene-level** `pointerup` / `pointerupoutside` / `pointercancel` → 統一重置 `_isHandTouch = false`（不只在 hand area 內 reset，避免拖出區域外放開時 flag 殘留）
- 實作：hand area 的 interactive zone 在 pointerdown 時 `event.stopPropagation()` 阻止事件冒泡到 map scroll handler

**滾動範圍**：
- 可用視窗高度 = 812 - 48(HUD) - 64(hand) - 56(tab) = 644px
- 地圖世界高度 = 1200px
- scroll range: 0 to -(1200 - 644) = -556px（container.y 值）

### 3. Cell 視覺狀態

每個 cell 由一個 Phaser.GameObjects.Container 表示：

```js
cellContainer
  ├─ border (Graphics: roundedRect)
  ├─ background (Graphics: radial-ish gradient via fillGradientStyle)
  ├─ roomIcon (Text placeholder: emoji/letter, 後續換 sprite)
  ├─ trapIcon (Text, 右上角小圖示)
  ├─ monsterSprite (Text placeholder, 居中 70%)
  └─ labelText ("?" for empty)
```

**States 對照 spec**：

| State | Border | Background | Content |
|-------|--------|------------|---------|
| Empty | dashed brown 40% | transparent 20% | "?" |
| Room only | solid brown | dark gradient | Room name initial |
| Room + Trap | solid dark red | dark gradient | Room + trap icon |
| Room + Monster | solid brown | dark gradient | Room + monster initial |
| Room + Trap + Monster | solid dark red | dark gradient | All three |
| Portal | solid cyan, glow | blue tint | "入口" |
| Heart | solid purple, glow | purple gradient | "魔王" |

Cell 尺寸：64x64px（邊框）+ 8px padding = 80x80px hit area。

### 4. Card Placement Flow

**前提**：玩家手中有 HandCard（來自 FlipMatrix 事件或抽卡）。

**流程**：
1. 玩家在 hand area 點擊一張卡 → `selectionState = { mode: 'card', handIndex: i }`
2. **視覺反饋**：
   - 選中卡牌：放大至 56x56 + 金色邊框 glow
   - 其他手牌：alpha 0.4 暗化
   - **Valid target cells**：所有 `type='normal'` 且該 layer 可放置的 cell → 綠色脈衝邊框（tween loop, alpha 0.3-0.8, 600ms）
   - Invalid cells（portal/heart/已滿）：無變化
3. 玩家點擊地圖上一個 highlighted valid cell：
   - cell 無同類型 → 放置（room 或 trap 層），從 hand 移除
   - cell 已有同類型同 id → 升級（level+1），從 hand 移除
   - cell 已有同類型不同 id → 顯示確認 "替換？" → 確認後替換，從 hand 移除
4. **取消**：點擊非 valid cell / 再次點擊已選卡牌 / 點擊地圖空白處 → 取消選擇，恢復所有視覺狀態
5. 放置後 → `gameState.recalcGlamour()` → 更新 TopHUD

### 5. Monster Placement（Stub）

本 proposal 只做 stub，完整 MonsterList UI 留給後續 proposal。

- DungeonMapUI 暴露 `enterMonsterPlacement(instanceId)` API
- 設定 `selectionState = { mode: 'monster', monsterId }`
- 點擊 empty-monster cell → `gameState.setCellMonster(cellId, instanceId, typeId)`
- 點擊已有 monster 的 cell → 顯示 "交換？" 確認
- 取消同 card placement

**Source of truth 定義**：`monsterRoster[].placedCellId` 是 authority。`GridCell.monster` 是 view cache。`setCellMonster()` 和 `removeCellMonster()` 必須同時更新兩者（見 Section 10 GameState 修改）。

### 6. Cell Detail Popup

**觸發**：tap cell without selection（selectionState.mode === 'none'）

**內容**（簡易 modal，depth 高於 map）：
- 標題：cell id
- Room info: name, level（or "空"）
- Trap info: name, level（or "無"）
- Monster info: name, currentHp（or "無怪物"）
- 按鈕：[關閉]
- **MVP deviation**：Upgrade/Replace/Remove 按鈕顯示但 disabled（spec 要求可操作，但完整邏輯留給 card placement flow 中的 confirm 步驟處理；Cell detail 只做資訊展示 + 關閉）。Synergy bonus 顯示留待 battle proposal（synergy 計算需 battle system）

### 7. Path Visualization

**繪製時機**：地圖生成後一次性繪製到 RenderTexture（與羊皮紙背景合併，減少 draw calls）。

**風格**：
- 每條 connection：從 cellA.position 到 cellB.position 畫線段
- Stroke: `#8B4513` (brown), 3px, alpha 0.5
- 每隔 20px 畫一個小圓（r=3, 同色）模擬鏈條
- 下游端點畫一個稍大圓（r=5）表示方向
- 繪製用臨時 Graphics → draw 到 RenderTexture → destroy Graphics

### 8. Hand Area

固定在地圖下方（不隨 scroll 移動）。

**佈局**：
- 高度 64px，寬度 375px
- 背景：半透明深色 `0x1a1a2e` alpha 0.9
- 卡牌 thumbnail：48x48px，水平排列，間距 8px
- 超過可顯示數量（~6 張）→ 水平可滾動（touch drag）
- 每張顯示：type 顏色邊框（room=brown, trap=red）+ id 首字 + star dots
- 點擊 → 進入 card placement mode

**空手牌提示**：居中顯示 "翻牌取得卡牌" 灰色文字

### 9. GameScene 整合修改

```js
// GameScene.create() 修改：

// TopHUD 改為 scene-level 固定 UI（不再屬於 flipMatrix container）
// 從 containers.flipMatrix 移出，改為獨立 add 到 scene，depth 高於 substate containers
this.topHUD = new TopHUD(this, this.gameState);
// topHUD container 設 depth(1000)，setScrollFactor(0)，不受任何 substate toggle 影響

// DungeonMapUI 初始化
this.dungeonMapUI = new DungeonMapUI(this, this.gameState);
this.containers.dungeonMap.add(this.dungeonMapUI.getContainer());

// 移除 dungeonMap 的 placeholder（bg + label）
```

**DungeonMap 啟動時機**：
- GameScene.create() 時就生成 dungeonGrid（`GridTopologyGenerator.generate()` → 存入 `gameState.dungeonGrid`）
- DungeonMapUI 根據 dungeonGrid 繪製
- Tab 切換到 dungeonMap → container visible，手牌從 gameState.hand 即時刷新
- TopHUD 始終可見（scene-level），金幣/天數在所有 substate 都顯示

**advanceDay 時地圖不重置**（同一局 run，地圖是持久的）。

### 10. GameState 修改

```js
// GameState constructor 新增：
this.dungeonGrid = GridTopologyGenerator.generate();

// 新增 method：
getCell(cellId) → GridCell | undefined
setCellRoom(cellId, typeId, level)
setCellTrap(cellId, typeId, level)

// Monster placement: 同時更新 cell.monster (view cache) + roster.placedCellId (authority)
setCellMonster(cellId, instanceId, typeId) {
  // 0. 若 monster 已在別的 cell → 先完整移除（原子操作）
  //    const monster = roster.find(m => m.instanceId === instanceId);
  //    if (monster.placedCellId && monster.placedCellId !== cellId) {
  //      this.getCell(monster.placedCellId).monster = null;  // 清舊 cell view cache
  //      this.removeMonster(instanceId);                      // 清 roster.placedCellId → null
  //    }
  // 1. 更新 cell.monster = { instanceId, typeId, currentHp: <from monster def> }
  // 2. 呼叫 this.placeMonster(instanceId, cellId) 更新 roster（此時 placedCellId 已為 null，不會 reject）
}
removeCellMonster(cellId) {
  // 1. 從 cell.monster 取 instanceId
  // 2. cell.monster = null
  // 3. 呼叫 this.removeMonster(instanceId) 更新 roster
}
```

## Spec Changes

本 proposal 的 apply 階段需同步修改以下 spec 文件（proposal 階段定義改什麼，apply 時才實際修改）：

### map/spec.md 修改
- **Scrollable Parchment Map > Touch Input Arbitration**：移除 "Pan SHALL use camera.scrollX/scrollY updates, NOT container position changes"，改為 "Pan SHALL use container.y offset (not camera scroll) because GameScene shares a single Phaser scene across all substates. Camera-based scroll would affect non-map substates."
- **Tap cell without selection (popup)**：降級為 MVP read-only — popup 顯示 room/trap/monster 資訊，Upgrade/Replace/Remove Monster 按鈕為 disabled stub，synergy bonus 留待 battle proposal。原文 "offer actions: [Upgrade] [Replace] [Remove Monster]" 改為 "MVP: read-only info display. Post-MVP: offer actions [Upgrade] [Replace] [Remove Monster] with synergy bonus."

### core/spec.md 修改
- **GridCell Schema**：新增 `type: 'normal' | 'portal' | 'heart'` 欄位

## Affected Files

```
new:      src/models/GridTopologyGenerator.js
new:      src/substates/DungeonMapUI.js
modified: src/scenes/GameScene.js (TopHUD 提升為 scene-level, dungeonMapUI init, remove placeholder)
modified: src/models/GameState.js (dungeonGrid init, cell helper methods, setCellMonster/removeCellMonster dual update)
modified: openspec/specs/map/spec.md (scroll method deviation)
modified: openspec/specs/core/spec.md (GridCell.type field)
```

## Verification

1. `npm run dev` → Tab 切換到「地圖」→ 看到羊皮紙風格地圖，1 portal + cells + 1 heart
2. 上下滑動 → 地圖平滑滾動 + 慣性
3. 快速滑動 → 慣性持續約 300ms 後停止
4. 短按（< 8px 移動）→ 判定為 tap
5. Cell 視覺：空格虛線 + "?"，有 room 的格子實線 + 名字
6. 翻牌取得卡牌 → 切到地圖 → hand area 顯示卡牌 thumbnail
7. 點手牌 → 高亮 → 點空 cell → 卡牌放置，cell 更新視覺
8. 同 room 同 id → 升級（level 2），不同 id → 確認替換
9. 點 cell（無選擇）→ detail popup 顯示 room/trap/monster info
10. Portal 和 Heart 不可放置（tap 時不反應）
11. Path lines 可見，有方向指示
12. 切回翻牌 tab → 再切回地圖 → 地圖狀態保留

## Risk

Medium —
- Container-based scroll（非 camera scroll）可能在低端裝置有 draw call overhead，若 cell > 12 個 + 所有裝飾物件，需觀察 FPS
- Pan vs Tap 的 8px 閾值在不同 DPI 裝置可能需微調
- Cell 視覺目前用 Text placeholder，後續換 sprite 時需重構 cell renderer
- 地圖世界 1200px 高度是固定值，若 row 數變動需調整
