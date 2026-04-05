# P032: 戰鬥視覺回饋強化

## Why
Gemini 影片分析指出戰鬥過程缺乏視覺回饋（P1）：
- 勇者在地圖上移動時僅有藍色路線，看不出在戰鬥
- 戰鬥節點無閃爍或交戰特效
- 勝利/失敗結果呈現突然

## What

### Part A: 戰鬥節點閃爍

BattleUI 中，當勇者進入某格與怪物戰鬥時：
1. 該格子背景做短暫紅色閃爍（alpha 脈衝 0→0.4→0，300ms）
2. 每次攻擊觸發一次閃爍
3. 使用 BattleManager 的現有 hero state 偵測 fighting 狀態

### Part B: 傷害數字彈出

BattleUI 中已有 damage popup 系統。確認其可見性和動畫效果：
- 傷害數字從攻擊位置向上飄浮 + 淡出
- 治療用綠色、傷害用白色、暴擊用黃色放大

### Part C: 戰鬥結果 Toast

戰鬥結束時的結果 toast 改善：
- 成功防禦：綠色 Toast "防禦成功！擊殺 X 名勇者"
- Boss 被突破：紅色 Toast "魔王被突破！"
- 使用 P030 已實作的 Toast 顏色系統

## Affected Files
- `src/substates/BattleUI.js` — 節點閃爍 + 傷害數字
- `src/scenes/GameScene.js` — 戰鬥結果 toast（如需要）

## Risk
低 — 純視覺增強。需注意多格同時戰鬥時的效能。

## Verification
1. 觸發戰鬥，觀察格子閃爍
2. 傷害數字可見且動畫流暢
3. 戰鬥結束 toast 顏色正確
