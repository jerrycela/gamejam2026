# A1 Battle Core — 戰鬥邏輯引擎設計

## 概要

純 JS 戰鬥邏輯層，不依賴 Phaser。由 GameScene.update() 驅動，透過 EventEmitter 發事件給 A2 UI 層消費。

## 設計決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| 時間模型 | 即時制 tick | Spec 原文設計，支援 A2 速度控制 |
| 多英雄 | 全並行，各自獨立 tick | Spec 要求 staggered wave，串行之後要重寫 |
| 驅動來源 | Scene update 被動驅動 | BattleManager 不持有 Phaser 引用，純邏輯 |
| 怪物死亡 | Cell 空了，後續英雄直通 | 戰鬥結束後全體 HP 重置復活 |

## 架構

```
GameScene.update(delta)
  -> battleManager.update(delta * speedMultiplier)
    -> 每個 HeroInstance 推進移動/戰鬥 tick
    -> CellCombatResolver 處理逐格戰鬥
    -> 事件透過 EventEmitter 發出
```

## 新檔案

### 1. HeroInstance (`src/models/HeroInstance.js`)

英雄實例，一場戰鬥中的一個英雄。

```js
{
  instanceId: 'hero_0',
  typeId: 'apprentice_sword',
  name: '見習劍士',
  hp: 200,
  maxHp: 200,
  atk: 30,
  def: 10,
  attackCd: 1.5,        // 秒
  skill: { ... },       // from hero def
  currentCellId: null,   // 目前所在 cell
  targetCellId: null,    // 下一個要去的 cell
  state: 'waiting' | 'moving' | 'fighting' | 'dead' | 'captured',
  moveTimer: 0,          // 移動計時 (累積到 400ms 就到達下個 cell)
  attackTimer: 0,        // 攻擊 CD 計時
  skillTimer: 0,
}
```

**Pathfinding**: 到達有多個 connections 的 cell 時，選離 heart 最近的下游 cell (greedy shortest-path)。等距時選 cell index 最小的 (deterministic)。

距離計算：BFS 從 heart 反向算每個 cell 到 heart 的 hop count，存為 `_distToHeart` map。英雄選 `connections` 中 `_distToHeart` 最小的。

### 2. BattleManager (`src/models/BattleManager.js`)

一場戰鬥的完整生命週期管理。繼承 EventEmitter。

```js
class BattleManager extends EventEmitter {
  constructor(gameState, dataManager)
  start(eventType)           // 'normalBattle' | 'eliteBattle' | 'bossBattle'
  update(dt)                 // dt 已乘過 speed multiplier (ms)
  isActive()
  getHeroes()
  getSpeedMultiplier()
  setSpeedMultiplier(x)
}
```

#### start(eventType) 流程

1. 根據 eventType + glamour 生成英雄列表 (HeroInstance[])
2. 設定 wave schedule: 英雄間隔 800ms staggered 進場
3. 記錄所有怪物初始狀態 (戰後復原用)
4. BFS 計算 `_distToHeart` map
5. 設 `_active = true`

#### update(dt) 主迴圈

每幀遍歷所有存活英雄:

```
for each hero (state !== 'dead' && state !== 'captured'):
  if state === 'waiting':
    waveTimer -= dt
    if waveTimer <= 0 -> state = 'moving', place at portal

  if state === 'moving':
    moveTimer += dt
    if moveTimer >= 400ms:
      arrive at targetCell
      -> trigger trap (immediate damage)
      -> if cell has alive monster -> state = 'fighting'
      -> else -> pick next cell, continue moving
      -> if no next cell (heart cell) -> fight boss

  if state === 'fighting':
    hero.attackTimer += dt
    monster combat timer += dt
    if hero timer >= hero.attackCd -> hero attacks monster
    if monster timer >= monster.attackCd -> monster attacks hero
    -> hero hp <= 0 -> heroDefeated(hero)
    -> monster hp <= 0 -> cellBreached(cell), hero continues

if all heroes dead/captured -> battleWon()
if boss hp <= 0 -> battleLost()
```

#### Events emitted

| Event | Payload | 用途 |
|-------|---------|------|
| `heroSpawn` | { hero } | UI 顯示英雄 |
| `heroMove` | { hero, fromCellId, toCellId } | UI 移動動畫 |
| `heroArrive` | { hero, cellId } | UI 到達 |
| `trapTrigger` | { hero, cellId, damage } | UI 陷阱特效 |
| `combatStart` | { hero, cellId, monsterId } | UI 戰鬥開始 |
| `attack` | { attacker, target, damage, isCrit } | UI damage popup |
| `heroDefeated` | { hero, cellId, captured, goldReward } | UI 擊殺特效 |
| `monsterDefeated` | { cellId, monsterId } | UI 怪物倒下 |
| `bossHit` | { hero, damage } | UI boss HP 更新 |
| `battleEnd` | { result: 'win'/'lose', kills, gold } | UI 結算 |

### CellCombatResolver (BattleManager private methods)

不獨立成 class，作為 BattleManager 的 private methods:

- `_resolveTrap(hero, cell)` -- 陷阱傷害: `trapDef.damage * trapLevel`
- `_resolveAttack(attacker, defender)` -- 基礎傷害公式: `max(1, atk - def * 0.5)`
- `_checkSynergyBonus(monster, cell)` -- 怪物 preferredRoom === cell.room.typeId -> apply atkMultiplier
- `_heroDefeated(hero)` -- 事件鏈: kill++, gold reward, torture advance, 20% capture roll
- `_monsterDefeated(cell)` -- cell.monster._battleDead = true，英雄繼續前進
- `_fightBoss(hero)` -- 英雄 vs boss (gameState.bossHp/bossAtk)
- `_resolveSkill(unit, target)` -- 技能傷害: skill.damage (單體或 AoE)，CD 到才施放

**技能施放規則** (A1 MVP):
- 怪物和英雄都有 skillTimer，CD 到了自動施放（AI 控制）
- 技能 type='single' 打當前對手，type='aoe' 打同 cell 所有敵人
- Boss 主動技能留給 A2（玩家手動觸發），A1 Boss 只有普攻

## Hero 生成邏輯

```js
_generateHeroes(eventType) {
  const counts = {
    normalBattle: [1, 3],
    eliteBattle: [2, 4],
    bossBattle: [3, 5],
  };
  const [min, max] = counts[eventType];
  const count = randInt(min, max);

  // Pool selection
  const pool = eventType === 'normalBattle'
    ? ['apprentice_sword', 'light_archer']
    : allHeroTypes;  // all 5 hero types

  const heroes = [];
  for (let i = 0; i < count; i++) {
    const typeId = randomFromPool(pool);
    heroes.push(new HeroInstance(typeId, i, dataManager));
  }

  // Boss battle: guarantee at least 1 paladin
  if (eventType === 'bossBattle' && !heroes.some(h => h.typeId === 'paladin')) {
    heroes[0] = new HeroInstance('paladin', 0, dataManager);
  }

  // Glamour scaling: higher glamour -> stronger heroes
  const glamourMult = 1 + gameState.glamour / 500;
  heroes.forEach(h => {
    h.maxHp = Math.round(h.maxHp * glamourMult);
    h.hp = h.maxHp;
    h.atk = Math.round(h.atk * glamourMult);
  });

  return heroes;
}
```

## 戰後復原

```js
_restoreMonsters() {
  for (const cell of gameState.dungeonGrid) {
    if (!cell.monster) continue;
    if (cell.monster._battleDead) {
      delete cell.monster._battleDead;
    }
    const def = dataManager.getMonster(cell.monster.typeId);
    cell.monster.currentHp = def ? def.baseHp : 100;
  }
}
```

## 修改檔案

### GameState.js 新增

```js
advanceTortureProgress() {
  for (const slot of this.tortureSlots) {
    if (!slot.unlocked || !slot.prisoner) continue;
    slot.progress += 1;
    // Conversion check handled by caller after return
  }
}

addPrisoner(heroTypeId, heroName) {
  this.prisoners.push({ heroTypeId, heroName, capturedDay: this.day });
}
```

### GameScene.js 修改

```js
// create() 新增:
this.battleManager = new BattleManager(this.gameState, this.dataManager);

// 新增 update method:
update(time, delta) {
  if (this.battleManager && this.battleManager.isActive()) {
    this.battleManager.update(delta);
  }
}
```

### FlipEventHandler.js 修改

將現有 battle stub 替換為:
```js
// Battle events -> start real battle
this.scene.battleManager.start(card.eventType);
this.scene.battleManager.once('battleEnd', (result) => {
  this.scene.hideBattleOverlay();
  callback();
});
this.scene.showBattleOverlay(card.eventType);
```

## Affected Files 總覽

```
new:      src/models/HeroInstance.js
new:      src/models/BattleManager.js
modified: src/models/GameState.js (advanceTortureProgress, addPrisoner)
modified: src/scenes/GameScene.js (battleManager init, update loop)
modified: src/substates/FlipEventHandler.js (battle stub -> battleManager.start)
```

## 不含 (留給 A2 Battle UI)

- 英雄 sprite 移動動畫
- HP bar, damage popup
- Boss 主動技能按鈕 + CD
- 速度控制 UI [x1] [x2] [Skip]
- 戰鬥結算畫面

## 驗證方式

1. FlipMatrix 翻到戰鬥卡 -> BattleManager.start() 觸發
2. Console log 可見英雄生成、移動、戰鬥、擊殺事件鏈
3. 戰鬥結束後 -> battleEnd event 帶 result
4. 怪物 HP 全部重置
5. Kill count 和 gold 正確累加
6. Torture slots progress 推進
7. 20% 機率捕獲英雄加入 prisoners
8. Boss 戰 HP 扣血正確
