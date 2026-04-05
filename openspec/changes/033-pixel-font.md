# P033: 像素字體統一

## Why
全遊戲使用系統字體（sans-serif / serif / monospace），與像素美術風格不搭。
QA 截圖顯示文字與精美的 pixel art sprite 形成明顯的風格斷裂。
換成像素字體可立即提升視覺一致性，是打磨階段性價比最高的改動。

## What

### 字體選擇
- **Ark Pixel Font 16px（proportional, zh_tw）**
- 授權：SIL OFL 1.1（商用免費）
- 來源：github.com/TakWolf/ark-pixel-font
- 檔案：`public/fonts/ark-pixel-16px-proportional-zh_tw.ttf.woff2`（72KB）
- 已下載至 `public/fonts/`

### 實作方式
1. **index.html** 加 `@font-face` 載入 woff2，font-family 命名 `'Ark Pixel'`
2. **constants.js** 新增 `FONT_FAMILY = '"Ark Pixel", monospace'`
3. **BootScene.js** preload 時用 FontFace API 確保字體載入完成
4. **全部 12 個 JS 檔** 將 `fontFamily: 'sans-serif'` / `'serif'` / `'monospace'` 替換為 `FONT_FAMILY`
5. 字體大小保持不變（像素字體在各尺寸下都清晰）

### Affected Files
- `index.html` — @font-face
- `src/utils/constants.js` — FONT_FAMILY constant
- `src/scenes/BootScene.js` — font preload + fontFamily
- `src/scenes/GameScene.js` — fontFamily
- `src/scenes/ResultScene.js` — fontFamily
- `src/substates/FlipMatrixUI.js` — fontFamily
- `src/substates/FlipEventHandler.js` — fontFamily
- `src/substates/CardPickUI.js` — fontFamily
- `src/substates/DungeonMapUI.js` — fontFamily
- `src/substates/BattleUI.js` — fontFamily
- `src/substates/MonsterListUI.js` — fontFamily
- `src/substates/TortureUI.js` — fontFamily
- `src/substates/BestiaryUI.js` — fontFamily
- `src/substates/TopHUD.js` — fontFamily

### Risk
- Low：純視覺替換，不影響邏輯
- 字體渲染在 Canvas 模式下可能有抗鋸齒問題 → 確保 fontSize 為 16 的倍數或整數

### Verification
- 啟動遊戲，各畫面文字均顯示像素字體
- 中文字元正常渲染（無方塊/tofu）
- agent-browser 截圖與替換前對比
