# P025: 地城地圖全面改善 — 設計規格

## 概要

重寫地城地圖的拓撲生成、路徑渲染、格子視覺，使其符合原始設計規格的塔防 gameplay 與 Dark Gothic Fantasy 視覺風格。

## 問題陳述

1. 路徑連線意涵不明（半透明直線+小圓點，看不出英雄推進方向）
2. 隨機 jitter ±30px 導致路徑交叉混亂
3. 格子太小（64px），內容看不清
4. 背景色偏離設計（深藍灰 vs 深棕 `#1a1510`）
5. 缺少鎖鏈裝飾、符文圖標、羊皮紙材質
6. 分支拓撲讓部分格子被繞過，不符合塔防「每格都經過」的核心

---

## 拓撲設計

### 模板枚舉制

取代隨機生成，改用 4 種預定義模板，加權隨機選取：

| 模板 | 結構 | Normal Cell 數 | 權重 |
|------|------|---------------|------|
| **A** | 無分叉，直線 | 4 | 10% |
| **B** | 單分叉（跨 1 row） | 5 | 40% |
| **C** | 單分叉（跨 2 row） | 6 | 30% |
| **D** | 雙分叉（各跨 1 row） | 6 | 20% |

### 模板結構定義

```javascript
// 模板 B 範例
const TEMPLATE_B = {
  rows: [
    { cells: ['portal'] },               // row 0: Portal
    { cells: ['normal'] },               // row 1: 主幹
    { cells: ['normal', 'normal'] },     // row 2: 分叉（左+右）
    { cells: ['normal'] },               // row 3: 匯合
    { cells: ['normal'] },               // row 4: 主幹
    { cells: ['heart'] },                // row 5: Heart
  ],
  connections: [
    [0, 1],    // portal → row1
    [1, 2],    // row1 → 左分叉
    [1, 3],    // row1 → 右分叉
    [2, 4],    // 左分叉 → 匯合
    [3, 4],    // 右分叉 → 匯合
    [4, 5],    // row4 → heart (根據 row 展開後的 cell index)
  ],
  forkNodes: [1],    // fork 發生在第幾個 cell
  mergeNodes: [4],   // merge 發生在第幾個 cell
};
```

### 規則

- **Fork/Merge node 強制中欄**（x=187）
- **Fork/Merge node 本身也是 normal cell**，可放置房間/陷阱/怪物
- **分叉側格數**：branch-exclusive cell 數量（不含 fork/merge node），每側 1-2 格
- **50% 機率左右鏡像**：選定模板後隨機決定分叉的左/右方向
- **每梯次英雄在 fork node 隨機選邊**，確保兩側都有英雄經過

### 格子欄位座標

| 欄 | X 座標 |
|----|--------|
| 左 | 82 |
| 中 | 187 |
| 右 | 292 |

---

## 座標雙軌制

每個 GridCell 有兩組座標：

```
logicalPos:  { x: colX, y: rowY }
  → 固定在欄/行交叉點
  → 用於 hit-test（玩家點擊格子）、遊戲邏輯

visualPos:   { x: colX + jx, y: rowY + jy }
  → jx = seededRandom(mapSeed, cellId, 'x') * 16 - 8   // [-8, +8]
  → jy = seededRandom(mapSeed, cellId, 'y') * 8 - 4     // [-4, +4]
  → 生成一次，存入 cell 物件，整局不變
  → 用於路徑渲染、格子 sprite 定位、英雄移動插值
```

### 英雄移動與觸發

- 英雄 spawn 時根據 wave seed 決定完整 route（cellId 序列），fork 走左或右在此時確定
- 移動：沿 visualPos polyline 線性插值，400ms/格
- **觸發時機**：英雄抵達 segment 終點（visualPos）= 「進入該 cell」
- 進入 cell 後觸發順序：陷阱效果 → 怪物戰鬥（不變）
- 不使用距離碰撞檢測，純狀態機驅動

---

## Layout Budget

### 螢幕分配（375 x 812）

```
HUD:              48px
Map viewport:     644px（可捲動）
Hand area:        64px
Tab bar:          56px
Total:            812px
```

### 地圖世界座標

```
topPadding:       40px
Portal (row 0):   y = 80
Row 1:            y = 220
Row 2:            y = 360
Row 3:            y = 500
Row 4:            y = 640
Heart (row 5):    y = 780
bottomPadding:    40px

worldHeight = 40 + (780 - 80) + 80 + 40 = 860px
scrollRange = 860 - 644 = 216px
```

### 格子尺寸

- Cell: **80 x 80px**
- 3 欄間距: 105px（82→187→292）
- 左右 padding: 82 - 40 = 42px, 375 - 292 - 40 = 43px

---

## 路徑渲染（兩層架構）

### Layer 1: Static Path（RenderTexture，烘焙一次）

1. **底圖**：`0x2d1b0e` 填滿 375 x 860，加 noise pattern（8x8 tile 重複 stamp）
2. **路徑線**：4px `0x8B4513` 0.8 alpha 直線，連接 visualPos
3. **鎖鏈環**：預製 8x8px png（棕色描邊圓環），沿整條 polyline 總路徑長度每 30px stamp 一次，rotate 到路徑角度。轉角 5px 內不 stamp，避免擠壓重疊
4. **箭頭**：每段路徑終端前 12px，10px 三角形指向下游
5. **Fork 標記**：fork/merge node 位置畫 12px 菱形

### Layer 2: Dynamic Forecast（Phaser Graphics，每波重畫）

- 下一波英雄的預定路線：3px `0x4a9eff`（冰藍）虛線疊在路徑上
- 戰鬥開始前繪製，每波更新
- 不烘焙，動態 Graphics 物件

---

## 格子視覺

### 尺寸：80 x 80px，圓角 8px

| 類型 | 邊框 | 填充 | 內容 |
|------|------|------|------|
| **Portal** | 3px cyan `0x00FFFF` + glow | `0x003366` 0.6 | 拱門符文 + 「入口」 |
| **Heart** | 3px purple `0x9B59B6` + glow | `0x4b0082` 0.7 | 魔王 sprite 64px + 「地城之心」 |
| **空地** | 2px `0x8B4513` dashed 0.4 | `0x8B4513` 0.2 | 灰色問號 |
| **有房間** | 3px `0x8B4513` | `0x1a1a2e` 0.85 | 符文圖標 + 底部房間名 |
| **房間+陷阱** | 3px `0x8B0000` | `0x1a1a2e` 0.85 | 符文圖標 + 右上角陷阱圖標 |

### 格子內部佈局

```
┌──────────────────┐
│ [符文圖標 40px]    │ 陷阱 16px ↗
│                  │
│  [怪物 sprite     │
│   54px 居中]      │
│                  │
│  房間名 12px      │
└──────────────────┘
```

- 怪物 sprite：54px（格子 67%），垂直居中
- 陷阱圖標：右上角，16px，距邊 4px（箭矢/火/冰/毒/石 小圖標）
- 怪物和陷阱同格時互不影響

### 符文圖標（房間類型）

| 房間 | 符文 | 色調 |
|------|------|------|
| 孵化室 | 齒輪 | 暗紅 |
| 研究室 | 法杖 | 紫藍 |
| 訓練室 | 劍 | 棕金 |
| 地牢 | 骷髏 | 暗灰 |
| 寶藏室 | 金幣 | 金色 |

符文用 Phaser Graphics 繪製（簡化 SVG path），不需額外圖片資源。

---

## 背景色修正

- **全畫面背景**：`#1a1510`（深棕黑，設計規格的主背景色）
- 影響：BootScene、GameScene、ResultScene 的 camera background color
- 地圖區域的 `#2d1b0e` 羊皮紙色只在 Static RT 內

---

## 地圖生成流水線

```
1. selectTemplate()
   → 加權隨機選 A/B/C/D
   → 50% 隨機左右鏡像

2. buildLogicalGrid(template)
   → 產生 cells[]
   → 每個 cell 有 id, type, logicalPos, connections
   → logicalPos 由模板的 row/col 決定

3. computeVisualAnchors(cells, mapSeed)
   → 為每個 cell 計算 visualPos
   → jitter = seededRandom(mapSeed, cellId)
   → 存入 cell.visualPos，快取整局

4. bakeStaticPathRT(cells)
   → 繪製羊皮紙底 + noise
   → 繪製路徑線（cell.visualPos → cell.visualPos）
   → stamp 鎖鏈環（沿 polyline 總長，轉角避讓）
   → 繪製箭頭、fork 菱形

5. buildCellSprites(cells)
   → 在 visualPos 上放置格子容器
   → 繪製邊框、填充、符文、怪物、陷阱圖標
```

---

## 影響範圍

### 重寫

| 檔案 | 變更 |
|------|------|
| `src/models/GridTopologyGenerator.js` | 完全重寫：模板式生成 + 雙座標 |
| `src/substates/DungeonMapUI.js` | 重寫 `_rebuildBackground`（兩層）、`_rebuildCells`（80px + 符文）、`_drawCellVisual` |

### 修改

| 檔案 | 變更 |
|------|------|
| `src/scenes/GameScene.js` | 背景色改 `#1a1510` |
| `src/scenes/BootScene.js` | 背景色改 `#1a1510` |
| `src/scenes/ResultScene.js` | 背景色改 `#1a1510` |
| `src/models/GameState.js` | cell 結構新增 `visualPos` 欄位 |
| `src/substates/BattleUI.js` | 英雄移動改用 visualPos polyline + 狀態機 |

### 新增

| 檔案 | 內容 |
|------|------|
| `src/utils/seededRandom.js` | seed-based random 函式 |
| `src/assets/chain-link.png` | 8x8px 鎖鏈環 stamp 貼圖 |

### 不改

- 手牌操作（`_rebuildHand`, `_buildHandInput`）
- 格子 popup（`_showCellPopup`）
- 卡牌放置流程（`_handleCardPlacement`）
- 捲動/拖拽邏輯（`_buildScrollInput`）

---

## 驗收條件

1. 地圖用模板生成，路徑清晰（鎖鏈裝飾+箭頭+fork 菱形）
2. 格子 80px，房間有符文圖標，怪物 sprite 54px
3. 全畫面背景 `#1a1510`，地圖區羊皮紙 `#2d1b0e` + noise
4. 英雄沿 visualPos polyline 移動，進格觸發正確
5. 戰鬥前顯示下一波英雄路線（冰藍虛線）
6. 手牌操作、卡牌放置、格子 popup 功能不受影響
