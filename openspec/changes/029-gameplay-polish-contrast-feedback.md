# P029: Gameplay 打磨 — 文字對比度 + 翻牌回饋

## Why
Gemini 影片分析指出兩個 P0 問題：
1. 遊戲中大量文字對比度不足（#555555、#7777aa 在 0x2d2d4e 背景上幾乎看不見），嚴重影響資訊獲取
2. 翻牌動畫僅有 scaleX 縮放，缺乏翻轉感和揭示驚喜，Game Feel 不足

## What

### Part A: 文字對比度統一修正

背景色 #2d2d4e，建立 WCAG AA 最低標準（普通文字 >= 4.5:1）。
對比度已驗證值：#9999cc=4.87:1, #9999bb=5.20:1, #aaaacc=5.84:1, #cccccc=8.19:1, #dddddd=9.68:1。

| 檔案 | 問題元素 | 現有顏色 | 現有對比度 | 修正為 | 修正對比度 |
|------|---------|---------|-----------|--------|-----------|
| FlipMatrixUI.js | 未翻卡片 ? | #7777aa | 3.13 | #9999cc | 4.87 |
| TortureUI.js | 空格「空」 | #555555 | 1.76 | #9999bb | 5.20 |
| TortureUI.js | 俘虜標題 | #888888 | 3.71 | #aaaacc | 5.84 |
| TortureUI.js | 空俘虜提示 | #555555 | 1.76 | #9999bb | 5.20 |
| TortureUI.js | 鎖定金額 | #aaaaaa | 5.66 | #cccccc | 8.19 |
| MonsterListUI.js | 空列表訊息 | #555555 | 1.76 | #9999bb | 5.20 |
| MonsterListUI.js | 更多指示 (...) | #666666 | 2.29 | #aaaacc | 5.84 |
| MonsterListUI.js | 已部署狀態 | #888888 | 3.71 | #9999bb | 5.20 |
| MonsterListUI.js | 格子 ID | #666688 | 2.39 | #9999bb | 5.20 |
| BestiaryUI.js | 鎖定英雄名 | #444455 | 1.36 | #9999cc | 4.87 |
| BestiaryUI.js | 鎖定提示 | #333344 | 1.13 | #9999bb | 5.20 |
| BestiaryUI.js | 更多指示 (...) | #666666 | 2.29 | #aaaacc | 5.84 |
| BestiaryUI.js | balanced 類型色 | #aaaaaa | 5.66 | #cccccc | 8.19 |
| BestiaryUI.js | tank 類型色 | #95a5a6 | 5.14 | 保留（已達標） | 5.14 |
| CardPickUI.js | 跳過按鈕 | #aaaaaa | 5.66 | #cccccc | 8.19 |
| CardPickUI.js | 卡片類型 | #bbbbbb | 6.85 | 保留（已達標） | 6.85 |
| ResultScene.js | 選單按鈕 | #aaaaaa | 5.66 | #cccccc | 8.19 |
| DungeonMapUI.js | 手牌空提示 | #555577 | 1.85 | #9999bb | 5.20 |
| TopHUD.js | 靜音按鈕(muted) | #666666 | 2.29 | #9999bb | 5.20 |
| GameScene.js | 無怪物提示 | #555577 | 1.85 | #9999bb | 5.20 |
| GameScene.js | 戰鬥debug文字 | #888888 | 3.71 | #aaaacc | 5.84 |

### Part B: 翻牌動畫增強

注：Phaser CANVAS renderer 僅支援 2D tween，以下為模擬翻牌效果（非 3D 旋轉）。

現有動畫 300ms scaleX 來回 + 4px Y 浮動，改為更豐富的模擬翻牌體驗：

1. **Phase 1 壓縮** (180ms)：scaleX 1→0 + scaleY 1→1.1（微膨脹），Quad.easeIn
2. **Phase 2 展開** (220ms)：scaleX 0→1 + scaleY 1.1→1，Back.easeOut（彈性回彈）
3. **白色閃光**：Phase 2 開始時加入白色 flash 矩形（alpha 0.6→0，200ms），使用 ADD blend mode
4. **卡牌彈跳**：展開後 y 向上偏移 8px 再 yoyo 回來（200ms），Bounce.easeOut
5. **音效同步**：card_flip 音效在 Phase 2 開始時播放（與視覺揭示同步）
6. **Tween 安全**：若 matrix rebuild 發生在動畫進行中，需確保所有 tween target 存活；動畫完成 callback 檢查 target 是否已 destroy

### Part C: 底部 Tab Bar 對比度

| 元素 | 現有 | 現有對比度 | 修正 | 修正對比度 |
|------|------|-----------|------|-----------|
| 非選中 tab | #888899 | 3.78 | #aaaacc | 5.84 |
| 懸停 tab | #aaaacc | 5.84 | #ccccee | 8.42 |
| 選中 tab | #e74c3c | 3.44 | #ff6b6b | 5.10 |

## Affected Files
- `src/substates/FlipMatrixUI.js` — 翻牌動畫 + 卡牌文字
- `src/substates/TopHUD.js` — 靜音按鈕灰色 #666666 → #9999bb
- `src/substates/TortureUI.js` — 空格/鎖定/俘虜文字
- `src/substates/MonsterListUI.js` — 空列表/狀態文字
- `src/substates/BestiaryUI.js` — 鎖定英雄文字 + balanced 類型色
- `src/substates/CardPickUI.js` — 跳過按鈕
- `src/substates/DungeonMapUI.js` — 手牌空提示
- `src/scenes/GameScene.js` — Tab bar 文字顏色 + 無怪物/debug 文字
- `src/scenes/ResultScene.js` — 選單按鈕

## Risk
低風險 — 純視覺改動，不改遊戲邏輯。翻牌動畫改動需確保 _isProcessing 計時正確，且 tween target 存活檢查。

## Verification
1. 每個畫面截圖確認文字可讀（所有顏色 >= 4.5:1）
2. 翻牌動畫錄影確認流暢度
3. 快速連續翻牌測試 _isProcessing 鎖定
4. matrix rebuild 中途測試動畫安全
5. 所有子畫面（翻牌/地圖/刑房/怪物/圖鑑/商店/結算）逐一驗證
