---
baseline_date: 2026-04-01
last_modified: 2026-04-02
version: 4.0
---

# P009 — Meta-progression 永久解鎖系統

## 目標

讓玩家透過跨局持久貨幣（metaGold）在主選單商店購買永久解鎖內容（怪物、房間、陷阱），增加重玩動力與經濟策略深度。

## 核心機制

- MetaState 新增 `metaGold` 持久貨幣，存於 localStorage
- 每局結算時，剩餘 `gameState.gold` 全數轉入 `metaGold`（勝敗皆轉）
- BootScene 主選單新增「魔王商店」按鈕，進入商店畫面
- 商店列出所有未解鎖項目，玩家用 metaGold 購買後永久解鎖
- 拷問轉化不受 monster unlock 限制（轉化怪物為臨時使用，不需永久解鎖）

## 解鎖項目定義（unlockShop.json）

### Schema

商店資料只存 `type/id/cost`，顯示名稱由 DataManager 既有資料表 lookup（避免雙源不同步）。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["type", "id", "cost"],
    "properties": {
      "type": { "type": "string", "enum": ["monsters", "rooms", "traps"] },
      "id": { "type": "string" },
      "cost": { "type": "integer", "minimum": 1 }
    },
    "additionalProperties": false
  }
}
```

### 項目清單

| type | id | cost |
|------|----|----- |
| monsters | bat_succubus | 300 |
| monsters | rage_demon | 500 |
| monsters | frost_witch | 400 |
| rooms | hatchery | 400 |
| rooms | lab | 350 |
| rooms | treasury | 600 |
| traps | fire | 250 |
| traps | frost | 200 |
| traps | poison | 300 |

名稱顯示：BootScene 商店 UI 從 `dataManager.monsters/rooms/traps` 用 id 查 `name` 欄位。

## 受影響檔案

### MetaState.js

- `SCHEMA_VERSION` 升至 2
- DEFAULT_META 新增 `metaGold: 0`
- `_migrate(data)`:
  - v1→v2: 補 `metaGold: 0`
  - 所有數值欄位套用 `Number.isFinite()` 驗證，無效值 fallback 0
  - `metaGold` clamp 至 `Math.max(0, value)`（防負數）
- 新增 `addMetaGold(amount)` — 加金幣並 save()
- 新增 `spendMetaGold(amount)` — 扣金幣並 save()，餘額不足回傳 false
- **新增 `purchaseUnlock(type, id, cost)` — 原子購買 API**：
  - 先檢查餘額 ≥ cost，不足 return false
  - 先扣款 spendMetaGold(cost)
  - 再解鎖 unlockContent(type, id)
  - save() 一次（或由 spendMetaGold/unlockContent 各自 save）
  - 回傳 true
- 新增 `beginRun()` — 重置 `_runFinalized = false`（每局開始時由 GameScene.create() 呼叫）
- 新增 `finalizeRun(gameState, victory)`:
  - 冪等保護：內部 flag `_runFinalized`，重複呼叫直接 return
  - 執行順序：recordRunEnd(victory) → addMetaGold(gameState.gold) → set `_runFinalized = true`
- save()/load()/reset() 納入 metaGold

### DataManager.js

- registerPreload 新增 `data_unlockShop` → `src/data/unlockShop.json`
- initialize 載入 `this.unlockShop`
- 新增 `getUnlockShopItems()` 回傳全部商店項目
- 新增 `lookupName(type, id)` — 從 monsters/rooms/traps 陣列中依 id 查 name

### 新增 src/utils/buildUnlockedPool.js

純函數，不放 DataManager（保持 DataManager 為純資料存取層）。

```js
/**
 * @param {Array} allItems - DataManager 的原始全集（monsters/rooms/traps）
 * @param {string} type - 'monsters' | 'rooms' | 'traps'
 * @param {MetaState} metaState - 用於讀取 unlockedX
 * @returns {Array} 可用項目清單（base pool + 已解鎖）
 */
export function buildUnlockedPool(allItems, type, metaState) { ... }
```

### ResultScene.js

- 結算改用 `metaState.finalizeRun(gameState, victory)` 單一入口（取代分散呼叫）
- 顯示「金幣已存入儲備: +XXX」文字
- 顯示目前 metaGold 總額
- **新增「返回主選單」按鈕**，點擊後 `this.scene.start('BootScene')`

### BootScene.js

- 使用 **container toggle** 架構：`menuContainer` / `shopContainer`
  - `menuContainer`: 標題 + 開始遊戲按鈕 + 魔王商店按鈕
  - `shopContainer`: metaGold 餘額 + 商品列表 + 返回按鈕
  - 切換時 `menuContainer.setVisible(false)` / `shopContainer.setVisible(true)`（反之亦然）
- 商店畫面：
  - 頂部顯示 metaGold 餘額
  - 列出所有 unlockShop 項目，名稱用 `dataManager.lookupName(type, id)` 取得
  - 已解鎖標記「已擁有」，未解鎖顯示價格+購買按鈕
  - **購買改用 `metaState.purchaseUnlock(type, id, cost)` 單一原子呼叫**
  - 餘額不足時按鈕 disabled（灰色）
  - 「返回」按鈕回 menuContainer
- 商店不做分頁，9 項一頁垂直列表

### GameScene.js

- `create()` 開頭呼叫 `metaState.beginRun()` 重置結算 flag

### 新增 src/data/unlockShop.json

- 格式如上方 Schema 所述（type/id/cost，無 name）

### openspec/specs/meta/spec.md

- 已同步更新至 v2.0：
  - 刪除 totalRuns/bossLevel 自動解鎖 matrix
  - 新增商店購買解鎖規則 + metaGold economy
  - schema 升至 v2（含 metaGold 欄位 + migration 規格）

### 卡池過濾統一（完整 call-site 清單）

以下所有從靜態資料組池的入口，全部改用 `buildUnlockedPool`：

1. **FlipEventHandler.js:L120-124** — activity 獎勵隨機房間/陷阱卡
2. **CardPickUI.js:L121-122** — CardPick 選項（房間/陷阱）
3. **GameScene.js:L332-336** — 局內商店（openShop）的房間/陷阱池
4. **GameState 初始化怪物 roster** — `GameState` constructor 建立 monsterRoster 時，直接取 `metaState.unlockedMonsters`（已有此邏輯，確認不需額外改動）

不使用 buildUnlockedPool 的位置：
- **TortureUI / BattleManager** — 拷問轉化結果不受 unlock 限制

### 驗收清單

- [ ] 上述 3 個房間/陷阱 call-site 全部改用 buildUnlockedPool
- [ ] GameState 怪物 roster 依 unlockedMonsters 建立（確認現有邏輯正確）
- [ ] 未解鎖的房間/陷阱/怪物不出現在任何卡池
- [ ] 拷問轉化仍可產生未解鎖怪物
- [ ] 連續兩局結算 metaGold 正確累加（beginRun 重置驗證）
- [ ] 商店購買用 purchaseUnlock 原子 API，無法免費解鎖
- [ ] meta/spec.md 已更新至 v2.0

## 設計決策記錄

1. **轉化不受 unlock 限制**：拷問轉化產生的怪物是臨時使用（僅限當局），不等於永久解鎖。這讓玩家在未解鎖時仍能「試用」某些怪物，增加解鎖動力。
2. **finalizeRun 冪等性 + beginRun 重置**：ResultScene 可能因 UI 重繪等原因多次觸發結算邏輯，`_runFinalized` flag 確保 metaGold 只加一次。`beginRun()` 在 GameScene.create() 呼叫，確保每局開始時 flag 乾淨，不依賴是否經過 BootScene。
3. **container toggle**：BootScene 商店與主選單共用同一 Scene，避免額外 Scene 管理開銷，與現有 substate 架構一致。
4. **buildUnlockedPool 獨立 util**：DataManager 保持純資料存取，解鎖過濾邏輯為獨立純函數，易於測試且不增加耦合。
5. **unlockShop.json 無 name**：名稱由 DataManager 既有資料表提供，避免雙源不同步。
6. **purchaseUnlock 原子 API**：先扣款再解鎖，封裝為單一方法，避免 UI 層串兩個可失敗操作導致免費解鎖。
7. **怪物 roster 邊界在 GameState**：FlipMatrixGenerator 不組 monster pool，怪物可用性在 GameState 初始化時由 metaState.unlockedMonsters 決定。

## 不做的事

- 不做成就系統
- 不做翻牌解鎖
- 不做商店分頁或分類 tab
- 不做退款機制
- 不做解鎖動畫（文字回饋即可）
- 不做 metaGold 上限

## 風險

- 低：metaGold 存 localStorage，與既有 MetaState schema 一致，migration 路徑明確
- 低：商店 UI 為獨立容器，不影響遊戲內 substate 架構
- 低：buildUnlockedPool 為純函數，易於測試
