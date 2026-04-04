# P026 怪物/房間格子呈現優化 — 設計規格

## 目標

提升地城地圖格子的視覺品質：怪物為視覺主體 + idle 動畫生命感 + 移除文字標籤全面圖像化 + 部署互動回饋。

## 設計決策

- 怪物為格子視覺主體，房間退為底圖 tile + 左下角小 icon
- 移除所有文字標籤（「牢房」「?」等），房間類型完全靠底圖 tile 區分
- 陷阱 emoji 改 pixel art icon
- 怪物 idle 用 4 幀 spritesheet 動畫
- 素材透過 nano banana MCP 產生
- 現有靜態怪物 sprite（monster_xxx）保留不動，idle spritesheet 用新 key（monster_xxx_idle）

## 格子元素配置

| 元素 | 現有 | 新版 |
|------|------|------|
| 底圖 | cell_dungeon 等 room tile | 不變 |
| 房間 icon | 居中偏上 16px | 左下角 10px |
| 文字標籤 | 居中（牢房、?等） | 移除 |
| 怪物 sprite | 居中偏下 54px 靜態 image | 居中 40px，4 幀 idle sprite |
| 陷阱 icon | 右上角 emoji ⚠ | 右上角 pixel art icon_trap 12px |
| 邊框 | 依狀態變色 | 不變 |
| buff dot | 戰鬥時右上角 5px 圓點 | 不變 |

格子狀態組合：
- 空格子：cell_empty + 邊框
- 有房間無怪物：room tile + 左下角 room icon
- 有房間有怪物：room tile + 怪物居中 idle 動畫 + 左下角 room icon
- 有陷阱：右上角 icon_trap（疊加在上述任何狀態）

## 素材規格

### 怪物 idle spritesheet（5 張）

| sprite key | 檔名 | 對應怪物 |
|------------|-------|----------|
| monster_skeleton_knight_idle | monster_skeleton_knight_idle.png | 骷髏騎士 |
| monster_goblin_idle | monster_goblin_idle.png | 哥布林 |
| monster_bat_succubus_idle | monster_bat_succubus_idle.png | 蝙蝠魅魔 |
| monster_rage_demon_idle | monster_rage_demon_idle.png | 狂怒惡魔 |
| monster_frost_witch_idle | monster_frost_witch_idle.png | 冰霜女巫 |

- 每幀 32x32px，整張 128x32px（4 幀並排）
- 幀內容：idle 呼吸循環（靜止 → 微縮 → 靜止 → 微伸）
- 像素風格與現有 map sprites 一致

### 陷阱 icon（1 張）

| sprite key | 檔名 | 說明 |
|------------|-------|------|
| icon_trap | icon_trap.png | 32x32px 單張靜態 |

### 現有靜態怪物 sprite 保留

monster_skeleton_knight 等 5 張保留原 key，MonsterListUI 等場景繼續用 SpriteHelper 載入，不受 idle spritesheet 影響。

## 動畫系統

### Animation 全域註冊（BootScene.create）

在 BootScene.create() 中預註冊所有怪物 idle animations（冪等，先 `anims.exists()` 檢查再 create，避免 BootScene 重入時 duplicate-key warning）：
- key: `monster_{typeId}_idle`
- frames: generateFrameNumbers(key, { start: 0, end: 3 })
- frameRate: 4
- repeat: -1

DungeonMapUI 建立怪物 sprite 時直接 `sprite.play('monster_{typeId}_idle')`。

### 怪物 idle（常駐）

- 使用 `scene.add.sprite` 建立（非 SpriteHelper，因為需要 spritesheet animation）
- 播放預註冊的 idle animation，4fps 循環
- 每個怪物隨機起始幀（接受切頁重骰，4 幀差異不明顯）
- 顯示大小 40px

### 部署落地動畫

前提約束：monster placement 僅來自未部署怪物（standby），不存在 cell-to-cell 搬移。此約束下單格視覺更新成立。

流程：狀態優先原則
1. `_handleMonsterPlacement` 中立即呼叫 `gameState.setCellMonster()` 更新狀態
2. 立即重置 selection state 為 sentinel（`{ mode: 'none', handIndex: -1, monsterId: null }`），防止動畫期間玩家操作衝突
3. 不呼叫全量 `refresh()`，改為單格視覺更新：在目標 cell container 中建立怪物 sprite
4. 清除所有格子的 placement 高亮（停止 pulse tween、隱藏 highlightBorder）
5. 播放落地動畫：sprite 起始 y 偏移 -30px + alpha 0 → 200ms Back.Out 彈跳 → 格子 scale 1.0→1.05→1.0
6. 動畫完成後，重建 hand 區域

### Buff 加成特效

- 觸發時機：僅在「部署怪物到已有匹配房間的格子」時觸發一次
- 判斷：`monster.type` 包含 `room.buffTarget`
- 效果：落地後 200ms 延遲，底圖 alpha 脈衝 1.0→0.6→1.0（300ms）+ 房間 icon 放大 1.0→1.3→1.0（300ms）
- 不匹配時無特效
- 不處理「先有怪物後建房間」的情況（Game Jam scope）

### 移除動畫（地圖編輯態 swap 限定）

範圍：只處理地圖編輯態的 swap（被換走的怪物）。recall 發生在 MonsterListUI（怪物列表頁），DungeonMapUI 不在畫面上無法播���畫，不處理。不處理戰鬥中死亡（BattleUI 已有自己的處理）。

流程（swap）：
1. 觸發 swap 操作
2. 播放被換走怪物的淡出動畫：alpha 1→0 + scale 1.0→0.8，150ms
3. 動畫 onComplete 回調中：從 GameState 移除舊怪物 + 清理 sprite + 執行新怪物部署流程

## 程式架構變更

### spriteManifest.js

manifest 條目 schema 擴展：
```js
// image（現有）
{ key: 'cell_empty', path: 'sprites/cell_empty.png' }

// spritesheet（新增）
{ key: 'monster_goblin_idle', path: 'sprites/monster_goblin_idle.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 }

// 靜態 icon（新增，type 省略 = image）
{ key: 'icon_trap', path: 'sprites/icon_trap.png' }
```

新增 6 筆條目（5 idle spritesheet + 1 icon_trap）。

**不可拆分依賴**：以下三項必須作為原子變更同時落地，缺任一項皆不可驗收：
1. spriteManifest.js 新增 type/frameWidth/frameHeight schema
2. BootScene.js preload 加入 spritesheet 分支
3. BootScene.js create 加入 animation 註冊（含冪等守衛）

### BootScene.js

**preload**：迴圈中根據 type 判斷：
- `type === 'spritesheet'` → `this.load.spritesheet(key, path, { frameWidth, frameHeight })`
- 否則 → `this.load.image(key, path)`（現有邏輯）

**create**：預註冊所有怪物 idle animations（冪等）：
```js
// 遍歷 spriteManifest 中 type === 'spritesheet' 且 key 包含 '_idle' 的條目
if (!this.anims.exists(entry.key)) {
  this.anims.create({
    key: entry.key,  // e.g. 'monster_goblin_idle'
    frames: this.anims.generateFrameNumbers(entry.key, { start: 0, end: 3 }),
    frameRate: 4,
    repeat: -1
  });
}
```

### DungeonMapUI.js

**格子渲染（_renderCell 區域）：**
- 移除文字標籤建立
- 陷阱改用 `SpriteHelper.createSprite(scene, 'icon_trap', x, y, 12)`
- 房間 icon 位置改為左下角 `(-half+10, half-10)`，大小 10px
- 怪物改用 `scene.add.sprite(0, 0, idleKey)` + `sprite.play(idleKey)` + displaySize 40px

**_clearSelection 拆分為三段：**
- `_resetSelectionState()`：重置 selectionState 為 sentinel `{ mode: 'none', handIndex: -1, monsterId: null }`（純狀態，保持與現有讀取點 `selectionState.mode` 相容）
- `_clearPlacementHighlights()`：停止所有 pulse tween、隱藏 highlightBorder（純視覺清理）
- `_rebuildCells()`：重建整個 cell layer（現有 refresh 中的邏輯）
- 現有 `_clearSelection()` 改為依序呼叫三段（保持向後相容）

**部署流程重構（_handleMonsterPlacement）：**
- setCellMonster() 立即更新狀態
- 立即 `_resetSelectionState()` + `_clearPlacementHighlights()`
- 不呼叫 `_rebuildCells()` / `refresh()`
- 單格視覺更新：建立怪物 sprite → 播放落地動畫 → onComplete 重建 hand

**新增方法：**
- `_playDeployAnimation(cellContainer, cell, monsterTypeId)` — 落地 + buff 特效
- `_playRemoveAnimation(sprite, onComplete)` — 淡出 + 清理

**移除流程修改：**
- swap 時先播被換走怪物的淡出動畫，動畫結束後更新 GameState
- recall 不做動畫，MonsterListUI 沿用現行 removeCellMonster() 直接移除

### 不改動的檔案

- GameState.js — 不涉及
- BattleManager.js — 不涉及
- BattleUI.js — 不涉及（battle death 不在本次範圍）
- HeroInstance.js — 不涉及
- MonsterListUI.js — 繼續用現有靜態 sprite key，不受 idle spritesheet 影響
- SpriteHelper.js — 不修改，idle sprite 不走 SpriteHelper

## 驗收條件

1. 5 張怪物 idle spritesheet + 1 張 icon_trap 正確載入（console 無 missing texture）
2. 格子無文字標籤
3. 陷阱為 pixel art icon（非 emoji）
4. 怪物居中 40px 播放 idle 動畫（4fps 循環）
5. 房間 icon 在左下角 10px
6. 部署怪物有落地彈跳動畫
7. 部署到匹配房間時有 buff 閃光特效
8. swap 時被換走怪物有淡出動畫（recall 不含動畫）
9. 無 console error
10. 不影響 battle 流程（BattleUI、BattleManager 行為不變）
11. MonsterListUI 怪物列表顯示正常（使用原靜態 sprite）
