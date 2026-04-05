# P043: Fix Bestiary crash + UI leak (ISSUE-002 + ISSUE-003)

## Why

QA dogfood 發現兩個互相關聯的 bug：
1. **ISSUE-002 (Medium)**: 點「圖鑑」tab 時 TypeError crash — `Cannot read properties of undefined (reading 'name')` at `_buildDiscoveredRow`
2. **ISSUE-003 (Medium)**: 圖鑑 UI 殘留在翻牌畫面 — 盜賊的資訊卡浮在翻牌矩陣上方

**根因相同**：`src/data/heroes.json` 中 thief 英雄的 `skill` 為 `null`。當 `_buildDiscoveredRow` 執行到 line 105 (`hero.skill.name`) 時 crash，但 crash 前已透過 `scene.add.*` 建立了 5 個 UI 元素（rowBg, spriteIcon, nameText, typeText, statsText），這些元素未被加入 `_rootContainer`（因為 line 118 的 `add()` 未執行），成為場景中的孤兒物件。`switchSubstate` 的 `setVisible(false)` 只能管到 container 內的物件，孤兒物件不受影響，造成視覺殘留。

## What

1. `src/substates/BestiaryUI.js` line 105: 加 null check — `hero.skill` 為 null 時顯示「無」
2. 確保所有元素都能正常加入 container

## Affected Files

- `src/substates/BestiaryUI.js` (1 line change)

## Risk

Low — 單一 UI 顯示修正，不影響遊戲邏輯

## Verification

- 點「圖鑑」tab 不再 crash
- 切回「翻牌」tab 無殘留 UI
- 盜賊英雄在圖鑑中正確顯示「技 無」
