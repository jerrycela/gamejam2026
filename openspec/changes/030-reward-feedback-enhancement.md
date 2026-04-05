# P030: 獎勵回饋強化 — 金幣動畫 + Toast 系統改善

## Why
Gemini 影片分析指出獎勵呈現平淡（P1）：
- 獲得金幣時僅更新數字，缺乏飛入動畫和音效回饋
- Toast 訊息瞬間出現/消失，無動畫過渡
- 不同事件類型的 Toast 沒有視覺區分

## What

### Part A: 金幣飛入動畫

翻牌獲得金幣時（treasure、activity gold reward），在 FlipEventHandler 中：
1. 從翻開的卡牌位置生成 3-5 個金幣圖示（黃色圓形 12px + "G" 文字）
2. 金幣沿 quadratic bezier 弧線飛向 TopHUD.goldText 的世界座標
3. 飛行 500ms，每個延遲 80ms 錯開
4. 金幣到達時觸發 TopHUD.animateGoldChange()
5. 播放 coin 音效
6. 金幣物件在到達後 destroy

座標取得方式：
- 卡牌位置：透過 FlipMatrixUI.cardObjects[row][col].x/y（已是 world coord，matrix container offset=0）
- FlipEventHandler.handleEvent 簽章改為接收 flipCard + row/col 資訊
- TopHUD.goldText 位置：TopHUD 提供 getGoldPosition() method

Bezier 實作：使用單一 dummy `{t:0}` tween 到 `{t:1}`，onUpdate 中計算：
```
x = (1-t)^2 * startX + 2(1-t)*t * controlX + t^2 * endX
y = (1-t)^2 * startY + 2(1-t)*t * controlY + t^2 * endY
```
controlPoint = (midX, startY - 80) 產生向上弧線

### Part B: Toast 動畫 + 替換邏輯

現有 Toast 改為有動畫的版本。新增 replace 機制防止重疊：

1. 保存 `this._currentToast` 引用
2. 新 Toast 出現時，若已有 Toast 則立即 destroy 舊的（含其 tween）
3. **淡入** (200ms)：alpha 0→1 + y 從 height/2-20 移到 height/2
4. **停留**：原有 duration
5. **淡出** (300ms)：alpha 1→0 + y 上移 10px，完成後 destroy + callback
6. **顏色變體**：使用 Rectangle + Text container（不用 Text.backgroundColor 以避免 CANVAS 兼容問題）
   - 戰鬥類 bgColor: 0xc0392b alpha 0.85
   - 寶藏/金幣 bgColor: 0xb8860b alpha 0.85（深金色，確保白字可讀）
   - 事件/獎勵 bgColor: 0x27ae60 alpha 0.85
   - 商店 bgColor: 0x2980b9 alpha 0.85
   - 預設 bgColor: 0x000000 alpha 0.7

_showToast 簽章：`_showToast(text, duration, callback, toastType='default')`

### Part C: TopHUD 金幣計數器動畫

不在 update() 偵測變化。改為新增 `animateGoldChange()` method：
- 外部呼叫時更新 goldText 文字
- 觸發 scale 1→1.3→1 彈跳 (200ms, Back.easeOut)
- 若已有彈跳 tween 進行中，先 stop 再重新開始

FlipEventHandler 中金幣實際加到 gameState.gold 的時機：
- 金幣飛行動畫開始時立即更新 gameState.gold（確保邏輯正確）
- 但 goldText 顯示延遲到最後一個金幣到達時才更新（視覺同步）

## Affected Files
- `src/substates/FlipEventHandler.js` — Toast 系統 + 金幣動畫 + handleEvent 簽章
- `src/substates/TopHUD.js` — animateGoldChange() + getGoldPosition()
- `src/substates/FlipMatrixUI.js` — _onFlipCallback 傳遞 row/col 資訊

## Risk
低風險 — 純視覺增強。場景切換時需確保 tween 安全清理（onComplete 檢查 scene 存活）。

## Verification
1. 翻寶藏卡 — 金幣飛入動畫 + 計數器彈跳
2. 翻事件卡（金幣獎勵）— 動畫 + 計數器
3. Toast 顏色變體：戰鬥(紅)/寶藏(金)/事件(綠)/商店(藍)
4. 連續快速翻牌 — Toast 替換不重疊
5. 金幣飛行中切換 tab — 不 crash
