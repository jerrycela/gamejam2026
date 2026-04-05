---
id: "049"
title: "Deployment UX Overhaul — Readable Cards + Contextual Actions + Guidance"
status: applied
date: "2026-04-05"
specs_affected:
  - dungeon_map
depends_on: ["041"]
supersedes: ["045"]
risk: medium
review_round: 2
---

# Proposal 049: Deployment UX Overhaul

## Why

玩家目前無法直覺理解如何部署房間和怪物，核心原因有三：

1. **手牌不可讀** — 卡片只顯示 ID 第一個字母（如 `d`、`t`）+ 星星，無法辨識是「牢房」還是「訓練場」
2. **格子只有資訊窗** — 點擊格子顯示詳細數據但沒有操作按鈕，玩家看完資訊不知道下一步
3. **缺少操作引導** — 選了卡後沒有提示「現在請點選格子放置」，未選卡時也沒引導

## What

### Phase 1: 手牌可讀性（最關鍵）

**現狀**：48x48 方塊，顯示 ID 第一個字母 + `★★`
**改為**：48x48 方塊，顯示房間/陷阱小圖示 + 名稱前 2 字 + 星級

```
現在:          改後:
┌──────┐      ┌──────┐
│  d   │      │ [圖] │    ← icon_dungeon 等 (16x16)
│ ★★  │      │ 牢房 │    ← DataManager name 前 2 字 (10px)
└──────┘      │ ★★  │    ← 星級不變 (8px)
              └──────┘
```

實作：
- `_rebuildHand()` 中，用 DataManager 取 room/trap 定義，顯示 name 前 2 字
- 使用現有 `_getRoomIconKey(card.id)` 或 `icon_trap` sprite (16x16)
- 佈局：icon 居中 y=-10，name 居中 y=6 (10px)，stars 居中 y=18 (8px)
- 手牌上限為 6 張（遊戲機制決定），48x48 + 8px gap = 336px < 375px，不溢出

### Phase 2: 操作模式指示文字（Mode Text）

**放在 HAND_H 64px 內部頂部**（不新增額外高度，不影響 `_viewportH()` 計算）：

- 將 hand area 的卡片向下偏移 8px，騰出頂部 16px 空間放指示文字
- 文字 10px，單行，水平居中

| 狀態 | 指示文字 | 顏色 |
|------|---------|------|
| 無選擇、有手牌 | 「點選手牌建設地城」 | #9999bb (灰紫) |
| 無選擇、手牌空 | 「翻牌取得卡牌」 | #9999bb |
| 選中 room 卡 | 「點擊格子放置房間」 | #00ff44 (綠) |
| 選中 trap 卡 | 「點擊格子放置陷阱」 | #ff6644 (橙) |
| 怪物放置模式 | 「點擊格子部署（金框=適性加成）」 | #ffcc00 (金) |

更新時機：`_rebuildHand()`、`_enterCardSelection()`、`enterMonsterPlacement()`��`_clearSelection()`。
戰鬥模式下隨 hand area 一起隱藏。

### Phase 3: 格子彈窗快捷操作

在 `_showCellPopup` 的關閉按鈕上方，增加操作按鈕列。

**Popup 高度計算**改為：`contentH + actionRowH(44px) + closeH(36px) + padding`

```
┌─────────────────────────┐
│    牢房 Lv.2            │
│    增益：近戰系 ...      │
│    陷阱：骨頭刺          │
│    怪物：地精            │
│                         │
│  [建房] [設阱] [放怪]   │  ← 44px action row
│       [ 關閉 ]          │
└─────────────────────────┘
```

#### 按鈕顯示規則（依格子狀態）

| 格子狀態 | 建房按鈕 | 設阱按鈕 | 放怪按鈕 |
|---------|---------|---------|---------|
| portal/heart | 不顯示 | 不顯示 | 不顯示 |
| 空房間 + 手牌有 room | 「建房」 | — | — |
| 有房間 + 手牌有同 id room | 「升級」 | — | — |
| 有房間 + 手牌有不同 room | 「換房」 | — | — |
| 手牌無 room | 不顯示 | — | — |
| 空陷阱 + 手牌有 trap | — | 「設阱」 | — |
| 有陷阱 + 手牌有同 id trap | — | 「升級」 | — |
| 有陷阱 + 手牌有不同 trap | — | 「換阱」 | — |
| 手牌無 trap | — | 不顯示 | — |
| 無怪物 + roster 有待命怪 | — | — | 「放怪」 |
| 有怪物 + roster 有待命怪 | — | — | 「換怪」 |
| roster 無待命怪 | — | — | 不顯示 |

#### 按鈕行為

1. **建房/升級/換房**：關閉彈窗 → 自動選中手牌中第一張匹配的 room 卡（優先同 id，其次任意 room）→ 自動高亮目標格子 → 玩家確認點擊格子完成放置
2. **設阱/升級/換阱**：同上，匹配 trap 卡
3. **放怪/換怪**：關閉彈窗 → 設定 `_pendingTargetCell = cell.id` → 切到怪物 tab（`scene.switchSubstate('monsterList')`）→ 玩家選怪後 MonsterListUI 回調 `enterMonsterPlacement(instanceId)` → 此時檢測 `_pendingTargetCell`，直接執行 `_handleMonsterPlacement(targetCell)` 而非進入自由選格模式

#### _pendingTargetCell 機制

```js
// DungeonMapUI.js
enterMonsterPlacement(instanceId) {
  // ...existing selection setup...
  if (this._pendingTargetCell) {
    const cell = this.gameState.getCell(this._pendingTargetCell);
    this._pendingTargetCell = null;
    if (cell) {
      this._handleMonsterPlacement(cell);
      return;
    }
  }
  this._highlightValidCells(); // fallback to free selection
}
```

不需要修改 MonsterListUI — 它已經呼叫 `scene.dungeonMapUI.enterMonsterPlacement()`，只需 DungeonMapUI 內部檢測 pending target。
GameScene.switchSubstate('monsterList') 已存在，不需新增 API。

按鈕樣式：56x32px，背景色區分（建房 #2a3a5a、設阱 #5a3a2a、放怪 #5a2a2a），12px 文字。

## Affected Files

| 檔案 | 改動 | ~行數 |
|------|------|-------|
| `src/substates/DungeonMapUI.js` | 手牌重構 + mode text + popup 按鈕 + `_pendingTargetCell` | ~130 |

## Risk

中。手牌區和彈窗是高頻互動區域。
緩解：Phase 1 可獨立驗證，Phase 2/3 在 Phase 1 確認後再加。所有操作最終都走現有 `_placeCard` / `_handleMonsterPlacement`。

## Verification

### Phase 1
- [ ] 手牌卡片顯示房間/陷阱圖示 + 中文名前 2 字 + 星級
- [ ] 使用 DataManager 取名（不重複資料）
- [ ] 選中狀態（gold border + dim）保持正常
- [ ] 375px 螢幕上 6 張卡不溢出

### Phase 2
- [ ] Mode text 在 hand area 內部頂端，不影響地圖 viewport
- [ ] 各狀態顯示對應文字和顏色
- [ ] 戰鬥模式下隨 hand area 隱藏

### Phase 3
- [ ] 彈窗按鈕依格子狀態正確顯示/隱藏
- [ ] 「建房」自動選中 room 卡 + 高亮格子
- [ ] 「放怪」切到怪物 tab，選怪後自動放到目標格
- [ ] `_pendingTargetCell` 在放置成功/取消後清空
- [ ] portal/heart 格子不顯示操作按鈕
- [ ] popup 高度正確容納按鈕列不截斷

## Review History

### Round 1: Codex READINESS 70% NO / Gemini READINESS 60% YES

| # | Sev | Finding | Decision | Action |
|---|-----|---------|----------|--------|
| 1 | P1 | Phase 3 放怪缺 `_pendingTargetCell` + 跨 tab 回調 | AGREE | 加入 `_pendingTargetCell` 機制，利用現有 `enterMonsterPlacement` |
| 2 | P2 | 建房/設阱按鈕在已佔用格子行為未定義 | AGREE | 加入按鈕顯示規則表 |
| 3 | P2 | Mode bar 24px 影響 viewport | AGREE | 改為放在 HAND_H 64px 內部 |
| 4 | P2 | 手牌 7+ 張溢出 | PARTIAL | 手牌上限 6 張（遊戲機制），已說明 |
| 5 | P3 | CARD_LABEL_MAP 重複資料 | AGREE | 改為從 DataManager 取名 |
| 6 | P3 | Popup height 計算需預留 action row | AGREE | 加入計算公式 |
| G-P1 | P1 | 放怪應用 inline picker | PARTIAL | Game Jam 範圍，跳 tab + auto-place 已足夠 |
| G-P2 | P2 | 自動選第一張卡歧義 | AGREE | 優先同 id，其次任意同 type |
