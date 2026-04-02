---
baseline_date: 2026-04-02
last_modified: 2026-04-02
version: 2.0
---

# P010 — Trap Special Effects (frost/poison/fire)

## 目標

讓陷阱擁有差異化的特殊效果，增加放置陷阱的策略深度。目前所有陷阱都只是純傷害，frost/poison/fire 的 effectType 欄位已存在但沒有實際行為。

## 設計依據

完整設計見 `docs/superpowers/specs/2026-04-02-trap-effects-design.md`。

## 改動範圍

### 1. src/data/traps.json — 沿用既有欄位

traps.json 已有 `effectType`、`slowTurns`、`dotTicks` 欄位。不新增 `effect` 物件，直接讀取既有欄位：

| trap | effectType | 相關欄位 | 行為 |
|------|-----------|---------|------|
| arrow | physical | — | 純傷害，無 debuff |
| boulder | physical | — | 純傷害，無 debuff |
| frost | ice | slowTurns: 3 | 減速 x2，持續 3 格移動 |
| poison | poison_dot | dotTicks: 4 | 每格 5 傷害，持續 4 格 |
| fire | fire_aoe | — | MVP：只傷害觸發者（進入 cell 的英雄），不遍歷同 cell 其他英雄 |

不需修改 traps.json 結構。

### 2. src/models/HeroInstance.js — 初始化 debuffs

constructor 新增 `this.debuffs = []` 和 `this.effectiveMoveDuration = MOVE_DURATION`。

debuff 結構：`{ type: 'slow'|'dot', moveDurationMult?: number, tickDamage?: number, cellsRemaining: number }`

### 3. src/models/BattleManager.js — debuff 邏輯

**_resolveTrap 擴充**：base damage 之後讀取 `trapDef.effectType`：
- `ice` → push slow debuff `{ type: 'slow', moveDurationMult: 2, cellsRemaining: trapDef.slowTurns }`
- `poison_dot` → push dot debuff `{ type: 'dot', tickDamage: 5, cellsRemaining: trapDef.dotTicks }`
- `fire_aoe` → MVP 只傷害觸發者，行為等同純傷害（程式碼保留 effectType 判斷路徑，為未來多英雄 AoE 預留）

**覆蓋規則**：新 debuff 與現有同 type 比較 cellsRemaining，取較大值覆蓋；若新的較小，保留現有不變。不同 type 共存。

**_tickMoving 擴充**（hero 到達 cell 後，heroArrive emit 之後、cell 處理之前）：
1. 遍歷 hero.debuffs，對每個 debuff 執行 `cellsRemaining--`
2. `dot` debuff：apply tickDamage，emit `dotDamage` 事件，HP<=0 觸發 `_heroDefeated` 並 return
3. `slow` debuff：更新 `hero.effectiveMoveDuration = MOVE_DURATION * moveDurationMult`
4. 移除 cellsRemaining <= 0 的 debuff
5. 若無 slow debuff 殘留，重置 `hero.effectiveMoveDuration = MOVE_DURATION`

**移動門檻**：`_tickMoving` 的 `hero.moveTimer < MOVE_DURATION` 改為 `hero.moveTimer < hero.effectiveMoveDuration`。

### 4. src/substates/BattleUI.js — 視覺回饋

- lerp 計算改用 `hero.effectiveMoveDuration` 取代 `MOVE_DURATION`（解決減速視覺同步問題）
- 有 `slow` debuff 的英雄：circle 加藍色 stroke `setStrokeStyle(2, 0x3498db)`
- 有 `dot` debuff 的英雄：circle 加綠色 stroke `setStrokeStyle(2, 0x2ecc71)`
- 雙 debuff 共存時：stroke 優先顯示 slow（藍色）
- 無 debuff 時：`circle.setStrokeStyle(0)`（清除 stroke）
- DoT 傷害 popup：綠色 `#2ecc71`（區分一般紅色傷害）
- 監聯 `dotDamage` 事件顯示 popup

## 不做的事

- 無 debuff icon/計時器 UI
- 無 debuff 堆疊（同類覆蓋）
- 無英雄抗性/免疫
- 不新增檔案或抽象層
- 陷阱升級不影響 effect 參數（只影響 baseDamage）
- fire AoE 不遍歷同 cell 其他英雄（MVP）

## 驗收條件

- [ ] frost 陷阱觸發後英雄移動明顯變慢（x2），持續 3 格後恢復，視覺 lerp 同步
- [ ] poison 陷阱觸發後英雄每移動一格受 5 傷害（綠色 popup），持續 4 格
- [ ] fire 陷阱只傷害觸發者（不遍歷同 cell）
- [ ] 同類 debuff 重複觸發時覆蓋（取較長 cellsRemaining）
- [ ] 不同 debuff 共存（英雄可同時被 slow + dot）
- [ ] debuff 英雄有對應顏色 stroke 視覺指示（雙 debuff 時 slow 優先）
- [ ] DoT 致死正確觸發 heroDefeated 流程
- [ ] arrow/boulder 行為不變
- [ ] BattleUI lerp 使用 hero.effectiveMoveDuration，減速時視覺流暢

## 風險

- **低**：改動侷限於 4 個既有檔案（HeroInstance + BattleManager + BattleUI + 不改 traps.json），不新增模組
- **低**：debuff 邏輯附加於現有 hero 物件，不影響其他系統
- **低**：fire AoE MVP 為純觸發者傷害，無多英雄追蹤邏輯

## R1 審查修正記錄

| Finding | Sev | 來源 | 處理 |
|---------|-----|------|------|
| slow 與 BattleUI lerp 用同一 MOVE_DURATION 常數，會視覺不同步 | P1 | Codex | 改用 hero.effectiveMoveDuration |
| fire AoE MVP 與 waitingForCombat 多英雄同 cell 矛盾 | P1→P2 | Codex | 明確 fire 只傷害觸發者 |
| 新 effect 欄位與既有 effectType/slowTurns/dotTicks 重複 | P2 | Codex | 改用既有欄位 |
| cellsRemaining 遞減時機未明確 | P2 | Codex+Gemini | 明確：heroArrive 後、cell 處理前 |
| 雙 debuff stroke 規則未定義 | P2 | Codex | slow 優先 |
| 覆蓋規則需精確 | P2 | Gemini | 取較大 cellsRemaining |
| debuffs 應在 HeroInstance 初始化 | P3 | Codex | 採納 |

## 預估規模

~120-160 行，中型（4 檔案）。
