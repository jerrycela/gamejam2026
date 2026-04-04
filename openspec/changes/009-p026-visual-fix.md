# 009: P026 格子視覺修正 + 動畫安全性

## Why

P026 實作完成後兩個面向需要修正：

**視覺（QA 截圖 dogfood-output/screenshots/ #40-#44）：**
- 怪物 40px 在 80px 格子中視覺主體感不足
- Room icon 10px、trap icon 12px 過小，幾乎不可辨識
- 怪物直接疊在 room tile 上無對比層，暗色怪物融入暗色底圖

**動畫安全性（三輪雙審 P1/P2）：**
- P1: swap state commit 在 tween callback 中（kill tween = 丟失狀態）
- P1: swap 動畫期間可重複觸發 placement
- P2: tween 未納入 lifecycle 管理

## What

### A. 視覺修正（最終數值經 Gemini 兩輪迭代確認）

#### A1. 怪物 sprite 放大：40px → 58px
58/80 = 72.5% 佔比。比 54px 更具衝擊力，比 60px 保留彈性避免動畫幀超出邊界。

#### A2. 怪物橢圓形底座（影子效果）
在怪物 sprite 下方加橢圓形半透明底座，模擬角色投影：
- 形狀：橢圓 (Ellipse)
- 中心：(0, 8) — 略偏下，模擬影子
- 大小：rx=25, ry=12
- 顏色：0x1a1a1a, alpha=0.5

#### A3. Room icon + backing（左下角）
Icon backing：fillRoundedRect(-38, 16, 22, 22, 6), color 0x000000, alpha 0.7
Icon：position (-27, 27), displaySize 18px, alpha 1.0

#### A4. Trap icon + backing（右上角）
Icon backing：fillRoundedRect(16, -38, 22, 22, 6), color 0x000000, alpha 0.7
Icon：position (27, -27), displaySize 18px, alpha 1.0

#### A5. Deploy animation 同步更新
_playDeployAnimation 中 sprite size 改為 58px，橢圓底座在 deploy 時一起建立。

### B. 動畫安全性修正

#### B1. Swap 狀態先行（解 P1）
swap confirm yesBtn 改為「先 commit state → 再播動畫」：
1. 按「是」立即 setCellMonster + _resetSelectionState + _clearPlacementHighlights
2. 然後才播 remove → deploy 動畫
3. 動畫只負責視覺，callback 不修改 gameState

#### B2. 動畫期間 busy flag（解 P1）
新增 _isAnimating = false。Guard 覆蓋所有入口：
- _handleMapTap()
- _onCardTap()
- enterMonsterPlacement()

#### B3. Tween lifecycle 管理（解 P2）
- _activeAnimTweens = [] 追蹤
- _rebuildCells / destroy 先 killAll + reset _isAnimating
- callback 加 scene guard

#### B4. noBtn 精簡化
從 _clearSelection() 改為 _resetSelectionState + _clearPlacementHighlights

#### B5. Spritesheet metadata 移入 manifest
manifest 新增 animation: { start, end, frameRate, repeat }
BootScene + DungeonMapUI 從 manifest 讀取

## Affected Files

- `src/substates/DungeonMapUI.js`
- `src/data/spriteManifest.js`
- `src/scenes/BootScene.js`

## Verification

1. 怪物 58px + 橢圓底座清晰可見
2. 哥布林在孵化室中可辨識（底座分離效果）
3. Room/trap icon + backing 可辨識
4. 快速連點不產生 ghost sprite
5. swap 後切 tab 再回 → 狀態正確
6. Console 無錯誤
