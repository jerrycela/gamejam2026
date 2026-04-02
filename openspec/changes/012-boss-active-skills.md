---
id: "012"
title: "Boss Active Skills — Cooldown-based Abilities"
status: proposed
date: "2026-04-02"
specs_affected:
  - battle
  - boss
risk: medium
revision: 2
review_history:
  - round: 1
    codex: "58% NO — 2 P1 (integration path incomplete; baseHp/baseAtk dual source of truth), 2 P2, 1 P3"
    gemini: "60% NO — 1 P1 (one-action-per-tick violation), 2 P2, 2 P3"
    exit: "R1 fixes: remove baseHp/baseAtk from boss.json (MetaState owns stats), add DataManager+BootScene to affected files, consolidate boss actions into single _tickBossAction, specify shield applies to both normal+skill damage, add shield-active skip rule, simplify UI to popup text. REJECT generic target system + buff array (Game Jam scope)."
---

# Proposal 012: Boss Active Skills

## Why

終局戰是整局的高潮，但目前 Boss 只有普攻（每 2 秒打一個英雄），體驗單調。加入 2 個主動技能 + 冷卻機制，讓 Boss 戰有節奏變化和策略深度——玩家會根據 Boss 技能釋放時機調整佈陣順序。

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| 技能數量 | 2 個主動技能 | Game Jam 範圍，夠造成節奏變化 |
| 技能定義位置 | `src/data/boss.json`（僅 skills + attackCd） | data-driven，不硬編碼。**Stats（hp/atk）繼續由 MetaState 管理**，避免雙 source of truth |
| 技能 1: 震盪波 (Shockwave) | 對**所有**正在戰鬥的英雄造成 bossAtk * 0.6 傷害 | AOE 製造壓力，迫使玩家分散進入時間 |
| 技能 2: 暗影護盾 (Dark Shield) | Boss 獲得 5 秒 50% 減傷（**普攻 + 技能傷害都減**） | 節奏變化——shield 期間英雄輸出減半 |
| Shield 重複施放 | CD 到但 shield 仍 active → 跳過，等下次 CD | 避免 timer 重置或效果堆疊 |
| Boss 動作合併 | **單一 `_tickBossAction(dt)`** 取代分開的 skill + sharedAttack | 確保每 tick 只做一個動作：技能優先 > 普攻 |
| 冷卻機制 | 各技能獨立 CD timer，掛在 `_bossContext` | 與英雄 skill timer 同架構 |
| 技能優先級 | Shockwave > Dark Shield > 普攻 | 每 tick 至多一個 action |
| 首次施放延遲 | 技能 CD 從 50% 開始（不會一開場就放） | 給玩家反應時間 |
| UI 回饋 | emit `bossSkill` 事件，BattleUI 顯示技能名 popup + shake | 複用現有 popup pattern |
| Shield 視覺 | bossHit popup 顯示「(護盾)」+ 減半後數字 | 低成本，不需新 widget |
| 與 hero traits 互動 | parry/skip 不影響 boss 技能（只作用於 trap） | 保持 trait 語義一致 |

## Boss Skills Schema (`src/data/boss.json`)

```json
{
  "attackCd": 2,
  "skills": [
    {
      "id": "shockwave",
      "name": "震盪波",
      "cd": 8,
      "type": "aoe_damage",
      "damageMultiplier": 0.6
    },
    {
      "id": "dark_shield",
      "name": "暗影護盾",
      "cd": 12,
      "type": "buff_self",
      "duration": 5,
      "damageReduction": 0.5
    }
  ]
}
```

Boss HP/ATK 來自 `MetaState.getBossStats()`（已有 bossLevel 縮放），boss.json 不重複定義。
`MetaState.getBossStats().skillCd` 已存在但未用——可做為全域 CD 縮放係數（未來 bossLevel 影響技能頻率），本 proposal 暫不使用。

## Implementation

### Affected Files

| File | Change | Lines |
|------|--------|-------|
| `src/data/boss.json` | **NEW** — skills + attackCd 定義 | ~20 |
| `src/models/DataManager.js` | registerPreload + initialize 加載 boss.json | ~5 |
| `src/scenes/BootScene.js` | 無需改（DataManager.registerPreload 已在 preload 呼叫） | 0 |
| `src/models/BattleManager.js` | 新 `_tickBossAction(dt)` 合併技能+普攻；`_tickBossFight` 加 shield 減傷 | ~60 |
| `src/models/GameState.js` | constructor 初始化 `bossSkills` 從 DataManager | ~5 |
| `src/substates/BattleUI.js` | 監聽 `bossSkill` 事件，顯示技能名 popup | ~25 |
| `src/utils/constants.js` | 移除 hardcoded boss attackCd（改從 boss.json） | ~3 |

預估改動：~120 行（中型）

### Steps

1. 建立 `src/data/boss.json`（只有 attackCd + skills）
2. `DataManager` 加 registerPreload + initialize + getter for boss config
3. `GameState` constructor 從 DataManager 讀取 bossSkills，存入 `this.bossSkills`
4. `BattleManager._bossContext` 初始化時加入：
   - `skillTimers: { shockwave: cd*0.5*1000, dark_shield: cd*0.5*1000 }` (50% 起始延遲)
   - `shieldActive: false`, `shieldTimer: 0`
5. 新增 `_tickBossAction(dt)` 取代 `_tickBossSharedAttack`：
   - 先檢查 shockwave CD → 觸發 → emit `bossSkill` → return
   - 再檢查 dark_shield CD（若 shieldActive 則 skip）→ 觸發 → emit `bossSkill` → return
   - 更新 shieldTimer（若 active，timer 倒數到 0 時 deactivate）
   - 最後 fall through 到普攻邏輯（原 _tickBossSharedAttack 內容）
6. `_tickBossFight` 兩個扣血點（hero normal attack + hero skill）加 shield 減傷：
   - `if (this._bossContext?.shieldActive) dmg = Math.round(dmg * (1 - reduction))`
7. `BattleUI` 監聽 `bossSkill` 事件，顯示技能名 popup（紅色大字）+ camera shake
8. bossHit popup 在 shieldActive 時加「(護盾)」標記

### Risk

- **P2**: Shockwave 可能瞬間團滅低 HP 英雄隊 → 0.6 倍率限制，且 shockwave 發動的 tick 不會同時普攻
- **P2**: shield duration 內英雄持續扣血但效率減半，體感可能不明顯 → 5 秒已夠長，配合 popup 提示

### Verification

- [ ] Shockwave 每 8 秒觸發，所有 fighting 英雄扣血，emit `bossSkill` 事件
- [ ] Dark Shield 每 12 秒觸發，持續 5 秒，期間英雄普攻+技能傷害 * 0.5
- [ ] Shield 結束後傷害恢復正常
- [ ] Shield active 時不重複施放
- [ ] 首次技能延遲（CD 從 50% 開始），不會開場秒放
- [ ] Boss 死亡時技能 timer 停止（bossHp <= 0 check）
- [ ] 每 tick 至多一個 boss action（技能或普攻，不會同時觸發）
- [ ] BattleUI 顯示技能名 popup + shake
- [ ] bossHit popup 在 shield 期間標記「(護盾)」
- [ ] DataManager 正確載入 boss.json
- [ ] ESLint 通過、build 成功
