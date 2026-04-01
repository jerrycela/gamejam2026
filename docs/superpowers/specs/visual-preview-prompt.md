# 魔王創業 - 視覺預覽生成指南

> 本文件搭配 `2026-04-01-dungeon-lord-startup-design.md`（完整遊戲設計文件）使用。
> 目的：讓 Claude 網頁版（Artifacts）能直接產出遊戲各畫面的高品質 HTML/CSS 互動預覽。
> 使用方式：上傳本文件 + 設計文件 + reference/ 資料夾中的參考截圖，要求產出各畫面預覽。

---

## 參考圖說明（上傳這些圖片）

| 檔案 | 內容 | 用途 |
|------|------|------|
| `dungeon_maker_grid_detail.png` | Dungeon Maker 地城網格近距離截圖：羊皮紙底圖上的格子、紅色符文圖標、像素角色站在格子上、格子間的連結 | **地城地圖畫面的核心視覺參考** |
| `dungeon_maker_flip_matrix.png` | Dungeon Maker 翻牌矩陣：粉色問號覆蓋牌、已翻開的戰鬥/活動/地宮牌 | **翻牌矩陣畫面的參考** |
| `dungeon_maker_card_upgrade.png` | Dungeon Maker 卡牌升級介面：左側兩張羊皮紙卷卡牌（冰 vs 改造冰箭），右側地城網格 | **三選一/卡牌 UI 的參考** |
| `dungeon_maker_monster_card.png` | Dungeon Maker 怪物卡牌詳情：像素角色 + 名稱 + 等級 + 三維數值 + 技能列表 + 星級 | **怪物/英雄卡牌 UI 的參考** |
| `pikmin_bloom_planter.png` | Pikmin Bloom 花盆介面：多個圓形底座欄位、每個有進度條和植物、底部等待區 | **刑求室 UI 的參考** |
| `截圖 2026-04-01 上午10.36.55.png` | Dungeon Maker 陷阱選擇 + 地城全景 | 補充視覺細節 |
| `截圖 2026-04-01 上午10.37.03.png` | Dungeon Maker 三選一介面 | 補充卡牌選擇 UI |
| `截圖 2026-04-01 上午10.37.13.png` | Dungeon Maker 卡牌升級對比 | 補充升級 UI |

---

## 全域視覺規格（每個畫面都適用）

### 手機直式框架

```css
/* 模擬手機螢幕 */
.phone-frame {
  width: 375px;          /* iPhone SE/8 寬度 */
  height: 812px;         /* iPhone X 高度 */
  border-radius: 40px;
  border: 3px solid #5a4a38;
  overflow: hidden;
  position: relative;
  background: #1a1510;
  font-family: 'VT323', 'Noto Sans TC', monospace;
}
```

### 色彩 Token

```css
:root {
  /* 背景 */
  --bg-dungeon: #1a1510;        /* 主背景：深棕黑 */
  --bg-parchment: #d4c4a0;      /* 羊皮紙 */
  --bg-parchment-dark: #bfaf80; /* 羊皮紙暗部 */
  --bg-card: linear-gradient(#f5e9d3, #e8d5b8);  /* 卡牌底色 */

  /* 強調色 */
  --gold: #f0c040;              /* 金色：標題、星級、金幣 */
  --red-trap: #8B0000;          /* 暗紅：陷阱、火焰、傷害數字 */
  --purple-magic: #8a2be2;      /* 魔法紫：魔王、特殊房間 */
  --blue-hero: #4a9eff;         /* 冰藍：英雄陣營 */
  --green-poison: #2ecc71;      /* 毒綠：治療、增益 */
  --red-damage: #e74c3c;        /* 亮紅：傷害數字彈出 */

  /* 邊框 */
  --border-brown: #8B4513;      /* 深棕：格子邊框 */
  --border-frame: #5a4a38;      /* 框線 */
  --border-card: #8a7a5a;       /* 卡牌邊框 */

  /* 文字 */
  --text-light: #F8FAFC;        /* 亮色文字（HUD） */
  --text-dark: #2a1a0a;         /* 暗色文字（卡牌） */
  --text-muted: #8a7a6a;        /* 輔助文字 */
}
```

### 字體

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Noto+Sans+TC:wght@400;700&display=swap');

/* Press Start 2P: 傷害數字、等級數字、標題（注意：此字體非常寬大，font-size 通常要設 8-12px） */
/* VT323: UI 文字、卡牌描述、一般內文（16-20px 適合） */
/* Noto Sans TC: 中文名稱、技能描述 */
```

### HUD（頂部固定）

```css
.hud {
  position: fixed; top: 0; left: 0; right: 0;
  background: linear-gradient(var(--bg-dungeon) 70%, transparent);
  padding: 12px 16px 24px;
  z-index: 100;
  display: flex; justify-content: space-between;
  font-family: 'Press Start 2P'; font-size: 9px;
  color: var(--text-light);
}
/* 內容：魔王頭像+Lv | HP條（紅） | 金幣數（金色） | Day 數 */
```

### 底部操作列（固定）

```css
.bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, var(--bg-dungeon) 30%);
  padding: 24px 12px 16px;
  z-index: 100;
}
/* 按鈕：圓角 8px，半透明色底 + 同色邊框，font-size 12px VT323 */
```

---

## 畫面 1：翻牌矩陣（主畫面）

**參考圖**：`dungeon_maker_flip_matrix.png`

### 佈局

```
手機螢幕 375 x 812px
├─ HUD (固定，高 48px)
├─ 翻牌區域 (佔滿剩餘空間，垂直置中)
│   ├─ 3 列 x 5 行 = 15 張牌
│   ├─ 每張牌寬 100px 高 140px
│   ├─ 間距 8px
│   └─ 整個矩陣置中
├─ 底部 Tab (固定，高 56px)
│   └─ [翻牌] [地城] [刑求室] [怪物]
```

### 卡牌視覺

**未翻（覆蓋面）**：
```css
.card-face-back {
  width: 100px; height: 140px;
  background: radial-gradient(ellipse at 30% 30%, #e8a0c8, #c070a0);
  /* 粉紫漸層，參考 Dungeon Maker 的粉色覆蓋牌 */
  border: 2px solid #8a5a7a;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.card-face-back::after {
  content: '?';
  font-family: 'Press Start 2P';
  font-size: 28px;
  color: rgba(255,255,255,0.8);
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
/* 加上 CSS animation: 邊角有微弱的閃光粒子效果 */
```

**已翻（正面）**：
```css
.card-face-front {
  width: 100px; height: 140px;
  background: var(--bg-card);
  border: 2px solid var(--border-card);
  border-radius: 8px;
  overflow: hidden;
}
.card-face-front .card-image {
  height: 65%;
  /* 像素風插圖區：勇者群(戰鬥)、寶箱(寶箱)、商人(商店)、暗黑祭壇(地宮) */
  background-size: cover;
}
.card-face-front .card-label {
  height: 35%;
  background: #1a1a1a;
  color: var(--text-light);
  font-family: 'Noto Sans TC';
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
}
/* 戰鬥類標籤底色偏紅 #3a1a1a，活動類偏紫 #2a1a3a，寶箱類偏金 #3a2a1a */
```

### 背景

```css
.flip-screen-bg {
  background:
    /* 羊皮紙噪點紋理 */
    url("data:image/svg+xml,...") /* SVG noise filter */,
    /* 羊皮紙漸層 */
    radial-gradient(ellipse at 40% 40%, #d4c4a0, #c8b890, #bfaf80);
  /* 邊緣加暗暈 */
}
```

---

## 畫面 2：地城地圖（核心畫面）

**參考圖**：`dungeon_maker_grid_detail.png`、`截圖 2026-04-01 上午10.36.55.png`

### 佈局

```
手機螢幕 375 x 812px
├─ HUD (固定，高 48px，漸層消失)
├─ 可捲動地圖 viewport (佔滿中央)
│   └─ 地圖 canvas (實際尺寸 600 x 900+px)
│       ├─ 頂部：英雄傳送門（發光拱門，紫色光暈）
│       ├─ 中間：格子網絡（3-4 列，4-6 行）
│       │   ├─ 每格 90x90px
│       │   ├─ 格子間 SVG 鎖鏈路徑連結
│       │   └─ 路徑方向由上到下
│       └─ 底部：地城之心（大型格子，紫色發光）
├─ 手牌區 (固定，高 64px，可左右滑動)
├─ 底部操作列 (固定，高 56px)
│   └─ [建造] [防禦戰] [刑求室] [下一步]
```

### 格子視覺（最重要，參考 dungeon_maker_grid_detail.png）

```css
.cell {
  width: 90px; height: 90px;
  border: 3px solid var(--border-brown);
  border-radius: 6px;
  position: relative;
  cursor: pointer;
}

/* 格子內部結構：底層符文 + 中層陷阱標記 + 頂層怪物 */

/* 房間符文圖標（佔格子中央，50x50px，SVG 筆觸風） */
.cell-rune {
  position: absolute;
  width: 50px; height: 50px;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.6;
  /* SVG 圖標：用 stroke 而非 fill，模擬手繪符文 */
  /* 孵化室=蛋形、研究室=書本、訓練室=劍、地牢=骷髏、寶藏室=金幣堆 */
}

/* 陷阱小圖標（右上角） */
.cell-trap-icon {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px;
  /* 箭矢=箭頭、焚燒=火焰、冰霜=雪花、毒沼=水滴、落石=石頭 */
}

/* 怪物像素角色（格子中央，佔 70%） */
.cell-monster {
  position: absolute;
  width: 63px; height: 63px; /* 90 * 0.7 */
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  image-rendering: pixelated;
  z-index: 5;
}

/* 格子狀態 */
.cell--empty {
  border-style: dashed;
  border-color: rgba(139, 69, 19, 0.4);
  background: rgba(200, 184, 144, 0.2);
}
.cell--occupied {
  background: radial-gradient(circle, rgba(200, 168, 112, 0.25), transparent);
}
.cell--trap {
  border-color: var(--red-trap);
  background: radial-gradient(circle, rgba(139, 0, 0, 0.1), transparent);
}
.cell--boss {
  border: 3px solid var(--purple-magic);
  box-shadow: 0 0 16px rgba(138, 43, 226, 0.3);
  background: radial-gradient(circle, rgba(138, 43, 226, 0.15), transparent);
}
```

### 格子間連結路徑

```css
/* SVG 繪製在格子層下方 */
.path-link {
  stroke: var(--border-brown);
  stroke-width: 3px;
  opacity: 0.5;
}
/* 每條路徑上加小圓環裝飾，模擬鎖鏈 */
.path-chain-link {
  r: 4px;
  fill: none;
  stroke: var(--border-brown);
  stroke-width: 1.5px;
  opacity: 0.5;
}
```

### 羊皮紙地圖背景

```css
.map-canvas {
  width: 600px; height: 900px;
  background:
    /* 羊皮紙噪點 */
    url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E"),
    /* 漸層 */
    linear-gradient(135deg, #d4c4a0 0%, #c8b890 30%, #bfaf80 60%, #d0c098 100%);
}
```

### 手牌區

```css
.hand-area {
  height: 64px;
  background: var(--bg-dungeon);
  border-top: 1px solid var(--border-frame);
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.hand-card {
  width: 48px; height: 48px;
  flex-shrink: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: 4px;
  /* 縮圖顯示房間/陷阱符文圖標 */
}
```

---

## 畫面 3：卡牌三選一（模態）

**參考圖**：`dungeon_maker_card_upgrade.png`、`截圖 2026-04-01 上午10.37.03.png`

### 卡牌詳細結構

```css
.pick-card {
  width: 110px; height: 200px;
  background: var(--bg-card);
  border: 2px solid var(--border-card);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.pick-card:active, .pick-card.selected {
  transform: scale(1.05);
  box-shadow: 0 0 12px var(--gold);
  border-color: var(--gold);
}
```

卡牌內部分區（由上到下）：

| 區塊 | 高度佔比 | 內容 |
|------|----------|------|
| 符文圖案區 | 40% | 羊皮紙卷軸背景 + 中央紅/紫色符文 SVG |
| 名稱 | 12% | 粗體，Noto Sans TC 14px，居中 |
| 類型+等級 | 8% | VT323 11px，灰色，如「陷阱 Lv.3 (10.3%)」 |
| 效果描述 | 28% | VT323 12px，關鍵字高亮（傷害紅/控制藍/強化黃） |
| 星級 | 12% | 金色星星（SVG），1-5 星 |

---

## 畫面 4：防禦階段

同畫面 2 的地城地圖，增加以下疊加層：

### 英雄資訊條（浮在地圖上方）

```css
.hero-info-bar {
  position: fixed; top: 56px; left: 12px; right: 12px;
  background: rgba(26, 21, 16, 0.9);
  border: 1px solid var(--border-frame);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex; align-items: center; gap: 8px;
  z-index: 50;
}
/* 內容：英雄像素頭像(32x32) | 名稱(VT323) | HP條(藍底紅填充) | HP數字 */
```

### 傷害數字彈出

```css
.damage-popup {
  position: absolute;
  font-family: 'Press Start 2P';
  font-size: 14px;
  color: var(--red-damage);
  text-shadow: 1px 1px 0 #000, -1px -1px 0 #000;
  animation: float-up 0.6s ease-out forwards;
  z-index: 60;
}
@keyframes float-up {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(1.3); }
}
/* 冰屬效果：color: var(--blue-hero) */
/* 毒屬效果：color: var(--green-poison) */
/* 治療效果：color: #2ecc71, 向上浮動帶 + 號 */
```

### 魔王技能按鈕

```css
.skill-button {
  width: calc(100% - 24px);
  margin: 0 12px;
  padding: 12px;
  background: rgba(138, 43, 226, 0.2);
  border: 2px solid var(--purple-magic);
  border-radius: 8px;
  color: var(--text-light);
  font-family: 'VT323'; font-size: 16px;
  text-align: center;
}
.skill-button.ready {
  box-shadow: 0 0 12px rgba(138, 43, 226, 0.5);
  animation: pulse-glow 1.5s infinite;
}
.skill-button.cooldown {
  opacity: 0.4;
  border-color: #555;
}
```

### 速度控制

```css
.speed-controls {
  display: flex; gap: 8px; justify-content: center;
  margin-top: 8px;
}
.speed-btn {
  padding: 6px 16px;
  background: rgba(255,255,255,0.1);
  border: 1px solid var(--border-frame);
  border-radius: 4px;
  color: var(--text-muted);
  font-family: 'VT323'; font-size: 14px;
}
.speed-btn.active { color: var(--gold); border-color: var(--gold); }
```

---

## 畫面 5：刑求室

**參考圖**：`pikmin_bloom_planter.png`

### 佈局

```
手機螢幕 375 x 812px
├─ HUD (固定)
├─ 標題「刑求室」(金色，Press Start 2P 12px，居中)
├─ 刑具台區域 (佔 60% 高度，flex-wrap 排列)
│   ├─ 欄位 1 (解鎖，有俘虜)
│   ├─ 欄位 2 (解鎖，空的)
│   ├─ 欄位 3 (鎖定)
│   └─ 欄位 4 (鎖定)
├─ 分隔線 + 「俘虜暫存區」標籤
├─ 俘虜列表 (水平滾動，高 80px)
├─ 底部 Tab (固定)
```

### 刑具台欄位

```css
.torture-slot {
  width: 140px; height: 180px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px;
}

.torture-platform {
  width: 120px; height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, #3a2a18, #2a2018);
  border: 3px solid #5a4a38;
  /* 邊緣鎖鏈裝飾：用 CSS border-image 或 SVG overlay */
  display: flex; align-items: center; justify-content: center;
  position: relative;
}

/* 有俘虜時 */
.torture-platform.occupied .prisoner-sprite {
  width: 64px; height: 64px;
  image-rendering: pixelated;
  /* 加上鎖鏈 overlay 效果 */
  filter: saturate(0.7) brightness(0.8); /* 稍微暗淡表示被囚禁 */
}

/* 進度條 */
.torture-progress {
  width: 100px; height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}
.torture-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--green-poison), var(--red-damage));
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* 鎖定欄位 */
.torture-platform.locked {
  opacity: 0.4;
  border-style: dashed;
}
.torture-platform.locked::after {
  content: '';
  /* SVG 鎖頭圖標 */
  width: 32px; height: 32px;
}
.unlock-cost {
  font-family: 'VT323'; font-size: 14px;
  color: var(--gold);
}
```

### 俘虜暫存區

```css
.prisoner-pool {
  display: flex; gap: 8px;
  padding: 8px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.prisoner-chip {
  width: 56px; height: 56px;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgba(74, 158, 255, 0.15);
  border: 1px solid var(--blue-hero);
  display: flex; align-items: center; justify-content: center;
  /* 拖拽到刑具台欄位的交互 */
}
```

---

## 畫面 6：怪物/英雄卡牌詳情

**參考圖**：`dungeon_maker_monster_card.png`

```css
.unit-detail-card {
  width: 280px;
  background: linear-gradient(#2a2018, #1a1510);
  border: 2px solid var(--border-frame);
  border-radius: 12px;
  overflow: hidden;
  margin: auto;
}

/* 角色展示區（上半） */
.unit-portrait {
  height: 200px;
  background: radial-gradient(circle at 50% 60%, #3a2a18 0%, #1a1510 100%);
  display: flex; align-items: center; justify-content: center;
}
.unit-portrait img {
  width: 128px; height: 128px;
  image-rendering: pixelated;
}

/* 名稱區 */
.unit-name {
  text-align: center;
  padding: 8px;
  font-family: 'Noto Sans TC';
  font-weight: 700;
  font-size: 18px;
  /* 怪物名：紅色 var(--red-trap)；英雄名：藍色 var(--blue-hero) */
}
.unit-type {
  text-align: center;
  font-family: 'VT323';
  font-size: 14px;
  color: var(--text-muted);
  /* 如 "怪獸 Lv.27 (23.6%)" */
}

/* 數值區 */
.unit-stats {
  padding: 12px 16px;
  border-top: 1px solid var(--border-frame);
}
.stat-row {
  display: flex; justify-content: space-between;
  font-family: 'VT323'; font-size: 16px;
  padding: 4px 0;
}
.stat-label { color: var(--text-muted); }
.stat-value { color: var(--red-damage); font-weight: bold; }

/* 技能區 */
.unit-skills {
  padding: 8px 16px;
  border-top: 1px solid var(--border-frame);
}
.skill-row {
  display: flex; justify-content: space-between;
  font-family: 'VT323'; font-size: 14px;
  padding: 2px 0;
}
.skill-name { color: var(--text-light); }
.skill-type { color: var(--gold); } /* (B)=被動, (S)=技能, (A)=主動 */

/* 星級 */
.unit-stars {
  text-align: center;
  padding: 8px;
  /* SVG 金星，最多 5 顆 */
}
```

---

## 產出指示（給 Claude 網頁版的 prompt 範例）

```
請根據附件的遊戲設計文件和視覺預覽指南，產出以下畫面的互動式 HTML 預覽（Artifact）：

1. 翻牌矩陣主畫面 - 3x5 的覆蓋牌矩陣，點擊可翻牌
2. 地城地圖畫面 - 可拖拽的羊皮紙大地圖，格子有符文和怪物
3. 卡牌三選一 - 三張羊皮紙卷卡牌的選擇介面
4. 刑求室 - Pikmin Bloom 花盆式的欄位介面

要求：
- 嚴格使用文件中定義的色彩 Token 和字體
- 手機直式 375x812px 框架
- 參考附件截圖的視覺風格（羊皮紙材質、像素風、暗黑奇幻氛圍）
- 可互動（點擊、拖拽）
- 每個畫面產出獨立的 Artifact
```
