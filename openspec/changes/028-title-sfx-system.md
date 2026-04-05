# 028: Title Screen + SFX System

## Why

Game Jam 遊戲目前完全無音效、標題畫面僅文字按鈕。這兩項是評審和玩家第一印象的最大缺口。

## What

1. **標題畫面**：nano banana 生成像素風標題圖，取代 BootScene 按鈕選單。Tap anywhere 進入遊戲，"Tap to Start" 文字淡入淡出循環。
2. **音效系統**：Gemini Native Audio Live API 生成 9 個 WAV 音效檔，SFXManager singleton 透過 Phaser game.sound 播放，整合到翻牌/戰鬥/金幣/陷阱/Boss/刑求/UI 等互動點。含靜音 toggle（localStorage 持久化）。

## Affected Files

- `public/sprites/title_bg.png` — 新增
- `public/audio/*.wav` (x9) — 新增
- `src/utils/SFXManager.js` — 新增
- `src/scenes/BootScene.js` — 修改
- `src/substates/FlipMatrixUI.js` — 修改（1 行）
- `src/substates/BattleUI.js` — 修改（~7 行）
- `src/substates/FlipEventHandler.js` — 修改（1 行）
- `src/substates/TopHUD.js` — 修改（靜音 toggle）
- `src/substates/TortureUI.js` — 修改（1 行）
- `src/substates/CardPickUI.js` — 修改（1 行）

## Risk

- Gemini 音效品質不確定（可 prompt 調整或後處理）
- 音效檔 ~400KB 增加 bundle（手機網頁可接受）

## Verification

- 啟動看到標題圖 + Tap to Start 脈動
- 各互動場景有對應音效
- 靜音 toggle 跨 session 記憶
- Console 無音效錯誤
