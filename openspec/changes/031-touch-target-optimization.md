# P031: 觸控目標優化 — 底部 Tab Bar + 速度控制按鈕

## Why
Gemini 影片分析指出（P1）：
- 底部導航按鈕觸控區域不足 44x44px，容易誤觸
- 戰鬥速度控制按鈕 [x1]/[x2]/[Skip] 字體小且密集，難以點擊

## What

### Part A: Tab Bar 觸控優化
- Tab bar 高度從 56px 維持不變（已足夠）
- 確保每個 tab 的 hit zone 覆蓋完整高度（56px）
- Tab 文字字體從 14px 增大為 16px

### Part B: 速度控制按鈕優化
- 按鈕字體從現有大小增為 16px
- 按鈕 padding 增加（x:16, y:8）
- 按鈕間距增加到 12px
- 按鈕背景明確（帶圓角或邊框）

## Affected Files
- `src/scenes/GameScene.js` — Tab bar 字體大小 + hit zone
- `src/scenes/GameScene.js` 或 battle overlay — 速度按鈕

## Risk
極低 — 僅調整尺寸和間距

## Verification
截圖確認按鈕大小合理、間距充足
