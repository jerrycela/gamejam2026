---
id: "001"
title: "Initial Project Setup — Phaser scaffold + data configs + core state"
status: proposed
date: "2026-04-01"
specs_affected:
  - core
  - units
risk: low
---

# Proposal 001: Initial Project Setup

## Why

建立專案基礎架構，讓後續所有模組的開發都有統一的基底。這是第一個 propose，不依賴其他任何變更。

## What

1. **Phaser 專案骨架**
   - 初始化 npm 專案 + Phaser 3 + Vite（dev server + build）
   - 建立 `src/` 目錄結構：scenes/, data/, models/, utils/
   - 建立 `index.html`（直式 viewport meta）
   - 建立 `src/main.js`（Phaser config: 375x812, CANVAS renderer）
   - 建立 BootScene（載入字體 + 顯示 loading）

2. **資料檔案**
   - `src/data/monsters.json` — 5 隻怪物定義
   - `src/data/heroes.json` — 5 種英雄定義
   - `src/data/rooms.json` — 5 種房間定義
   - `src/data/traps.json` — 5 種陷阱定義
   - `src/data/drawCosts.json` — 抽卡費用表

3. **核心狀態管理**
   - `src/models/GameState.js` — 單局 state
   - `src/models/MetaState.js` — 永久 state（localStorage 讀寫）
   - `src/models/DataManager.js` — 資料檔案載入與查詢

## Affected Files

```
new: package.json
new: vite.config.js
new: index.html
new: src/main.js
new: src/scenes/BootScene.js
new: src/models/GameState.js
new: src/models/MetaState.js
new: src/models/DataManager.js
new: src/data/monsters.json
new: src/data/heroes.json
new: src/data/rooms.json
new: src/data/traps.json
new: src/data/drawCosts.json
```

## Verification

- `npm run dev` 啟動後，瀏覽器顯示 375x812 黑色畫布 + BootScene loading 文字
- DataManager 能載入 5 個 JSON 並 console.log 輸出
- MetaState 能寫入/讀取 localStorage
- GameState 能初始化完整的 run state

## Risk

Low — 純新增，無既有程式碼受影響。
