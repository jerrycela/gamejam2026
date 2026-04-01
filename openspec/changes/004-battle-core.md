---
id: "004"
title: "Battle Core — Real-time Auto-Battle Logic Engine"
status: approved
date: "2026-04-01"
specs_affected:
  - battle
  - core
risk: medium
revision: 4
review_history:
  - round: 1
    codex: "35% NO — 4 P1, 2 P2"
    gemini: "75% NO — 1 P1, 3 P2"
  - round: 2
    codex: "62% NO — 3 P1, 3 P2, 2 P3"
    gemini: "80% NO — 1 P1, 1 P2, 1 P3"
  - round: 3
    codex: "76% NO — 1 P1, 1 P2, 1 P3"
    gemini: "95% YES — 0 P1, 2 P2, 1 P3"
    exit: "R3 Codex P1 fixed (trap baseDamage + levels[].damageMultiplier). P2s addressed (boss timing, naming). Gemini YES 95%. P1=0 across both."
---

# Proposal 004: Battle Core

## Why

FlipMatrix 產出戰鬥事件但目前只有 stub overlay。沒有真實戰鬥邏輯，遊戲核心迴圈（翻牌 -> 放卡 -> 戰鬥 -> 結算）無法跑通。Battle Core 實作純邏輯層，讓戰鬥事件可以產生真實的結果（擊殺、金幣、囚犯、Boss 扣血），為後續 A2 Battle UI 和 Torture 奠定基礎。

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Time model | Real-time tick | Spec design; supports A2 speed control (x1/x2/Skip = multiplier on dt) |
| Multi-hero | Fully parallel, each hero ticks independently | Spec requires staggered waves; serial would need rewrite later |
| Driver | Passive, driven by GameScene.update(delta) | BattleManager has zero Phaser dependency; pure JS |
| Monster death | Cell becomes empty; later heroes pass through | All monsters HP-reset after battle ends |

## Data Schemas

### HeroInstance (battle-scoped, NOT persisted)

```js
{
  instanceId: 'hero_0',
  typeId: 'trainee_swordsman',
  name: '見習劍士',
  hp: 200,
  maxHp: 200,
  atk: 30,
  def: 10,
  attackCd: 1.5,         // seconds
  skill: { name, type, damage, cd },
  currentCellId: null,
  targetCellId: null,
  state: 'waiting' | 'moving' | 'fighting' | 'waitingForCombat' | 'dead' | 'captured',
  moveTimer: 0,           // accumulates to MOVE_DURATION (400ms)
  attackTimer: 0,
  skillTimer: 0,
}
```

### Combat context (per hero-vs-monster pair, internal to BattleManager)

```js
{
  heroId: 'hero_0',
  cellId: 'cell_05',
  monsterAttackTimer: 0,   // monster CD timer for this fight
  monsterSkillTimer: 0,
}
```

## What

### 1. HeroInstance (`src/models/HeroInstance.js`)

Light data class, constructed from hero definition in DataManager.

```js
export default class HeroInstance {
  constructor(typeId, index, dataManager) {
    const def = dataManager.getHero(typeId);
    this.instanceId = `hero_${index}`;
    this.typeId = typeId;
    this.name = def.name;
    this.maxHp = def.baseHp;
    this.hp = def.baseHp;
    this.atk = def.baseAtk;
    this.def = def.baseDef;
    this.attackCd = def.attackCd;
    this.skill = def.skill ? { ...def.skill } : null;
    this.currentCellId = null;
    this.targetCellId = null;
    this.state = 'waiting';
    this.moveTimer = 0;
    this.attackTimer = 0;
    this.skillTimer = 0;
    this.waveDelay = index * 800; // ms stagger
  }
}
```

### 2. BattleManager (`src/models/BattleManager.js`)

Extends a minimal EventEmitter (use `Phaser.Events.EventEmitter` or a 20-line custom implementation to keep zero-Phaser-dependency claim honest — decision: use Phaser.Events.EventEmitter since it's already in the bundle, import only the class).

**Constructor**: `constructor(gameState, dataManager)`

**Public API**:
- `start(eventType)` — generate heroes, compute distToHeart, set active
- `update(dt)` — main tick, called with raw delta (ms); internally multiplied by `_speedMultiplier`
- `isActive()` — boolean
- `getHeroes()` — current HeroInstance[]
- `setSpeedMultiplier(x)` / `getSpeedMultiplier()`
- `triggerBossSkill()` — stub for A2; A1 Boss only auto-attacks

#### start(eventType) procedure

1. `_generateHeroes(eventType)` — see Section 3
2. `_computeDistToHeart()` — BFS from heart backwards: `_distToHeart = Map<cellId, number>`. Portal has highest dist, heart = 0. Used by hero pathfinding.
4. `_combatContexts = new Map()` — empty, populated when fights begin
5. `_cellCombatOwner = new Map()` — tracks which hero is fighting in each cell (occupancy lock)
6. `_bossContext = null` — shared boss combat context (created when first hero reaches heart)
6. `_preKillCount = gameState.killCount` — snapshot for battle-end delta
7. `_preGold = gameState.gold` — snapshot for battle-end delta
8. `_active = true`
9. Emit `battleStart` with `{ eventType, heroCount: heroes.length }`

#### update(dt) main loop

```
dt *= _speedMultiplier

for each hero where state !== 'dead' && state !== 'captured':

  [waiting]
    hero.waveDelay -= dt
    if waveDelay <= 0:
      hero.state = 'moving'
      hero.currentCellId = portalCellId
      hero.targetCellId = _pickNextCell(portalCellId)
      emit('heroSpawn', { hero })

  [moving]
    hero.moveTimer += dt
    if moveTimer >= MOVE_DURATION (400ms):
      hero.moveTimer = 0
      hero.currentCellId = hero.targetCellId
      emit('heroArrive', { hero, cellId: hero.currentCellId })

      cell = getCell(hero.currentCellId)

      // Heart cell -> fight boss (shared boss context: boss has one attack timer, targets FIFO)
      if cell.type === 'heart':
        hero.state = 'fighting'
        if !_bossContext:
          _bossContext = { attackTimer: 0, targetQueue: [] }
        _bossContext.targetQueue.push(hero.instanceId)
        _combatContexts.set(hero.instanceId, { heroId: hero.instanceId, cellId: cell.id, isBoss: true })
        emit('combatStart', { hero, cellId: cell.id, isBoss: true })
        continue

      // Trap
      if cell.trap:
        damage = _resolveTrap(hero, cell)
        emit('trapTrigger', { hero, cellId: cell.id, damage })
        if hero.hp <= 0:
          _heroDefeated(hero, cell.id)
          continue

      // Monster (with occupancy lock: only one hero fights a monster at a time)
      if cell.monster && !cell.monster._battleDead:
        if _cellCombatOwner.has(cell.id):
          // Another hero is already fighting this monster -> wait
          hero.state = 'waitingForCombat'
          hero.moveTimer = 0
          continue
        hero.state = 'fighting'
        _cellCombatOwner.set(cell.id, hero.instanceId)
        _combatContexts.set(hero.instanceId, { heroId: hero.instanceId, cellId: cell.id, monsterAttackTimer: 0, monsterSkillTimer: 0 })
        emit('combatStart', { hero, cellId: cell.id, monsterId: cell.monster.instanceId })
        continue

      // Empty cell -> keep moving
      hero.targetCellId = _pickNextCell(hero.currentCellId)
      if hero.targetCellId:
        emit('heroMove', { hero, fromCellId: hero.currentCellId, toCellId: hero.targetCellId })
      // else: no connections and not heart — should not happen with valid grid

  [waitingForCombat]
    // Check if the cell's combat owner has finished (monster dead or hero dead)
    cell = getCell(hero.currentCellId)
    if !_cellCombatOwner.has(cell.id):
      // Monster was defeated or cell cleared -> hero can proceed
      if cell.monster && !cell.monster._battleDead:
        // Monster still alive, previous hero died -> this hero takes over
        hero.state = 'fighting'
        _cellCombatOwner.set(cell.id, hero.instanceId)
        _combatContexts.set(hero.instanceId, { heroId: hero.instanceId, cellId: cell.id, monsterAttackTimer: 0, monsterSkillTimer: 0 })
        emit('combatStart', { hero, cellId: cell.id, monsterId: cell.monster.instanceId })
      else:
        // Monster dead -> continue moving
        hero.state = 'moving'
        hero.targetCellId = _pickNextCell(hero.currentCellId)
        if hero.targetCellId:
          emit('heroMove', { hero, fromCellId: hero.currentCellId, toCellId: hero.targetCellId })

  [fighting]
    ctx = _combatContexts.get(hero.instanceId)

    if ctx.isBoss:
      _tickBossFight(hero, ctx, dt)
    else:
      _tickMonsterFight(hero, ctx, dt)

// Boss shared attack tick (after all hero ticks, before end-condition check)
// [boss attack block runs here — see _tickBossFight section]

// Early exit: if bossHp went <= 0 during hero ticks, skip boss attack
if gameState.bossHp <= 0:
  _endBattle('bossBreached')
  return

// End conditions (after boss tick)
if all heroes dead/captured:
  _endBattle('defenseSuccess')
```

#### _tickMonsterFight(hero, ctx, dt)

```
cell = getCell(ctx.cellId)
monster = cell.monster
monsterDef = dataManager.getMonster(monster.typeId)

// Synergy check
synergyMult = (cell.room && monsterDef.preferredRoom === cell.room.typeId) ? monsterDef.synergyBonus.atkMultiplier : 1

// Hero attacks
hero.attackTimer += dt
if hero.attackTimer >= hero.attackCd * 1000:
  hero.attackTimer = 0
  dmg = _resolveAttack(hero.atk, monsterDef.baseDef)
  monster.currentHp -= dmg
  emit('attack', { attackerType: 'hero', attackerId: hero.instanceId, targetType: 'monster', targetId: monster.instanceId, damage: dmg, cellId: ctx.cellId })

// Hero skill
if hero.skill:
  hero.skillTimer += dt
  if hero.skillTimer >= hero.skill.cd * 1000:
    hero.skillTimer = 0
    dmg = hero.skill.damage
    monster.currentHp -= dmg
    emit('attack', { attackerType: 'hero', attackerId: hero.instanceId, targetType: 'monster', targetId: monster.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId })

// Monster attacks
ctx.monsterAttackTimer += dt
if ctx.monsterAttackTimer >= monsterDef.attackCd * 1000:
  ctx.monsterAttackTimer = 0
  monsterAtk = monsterDef.baseAtk * synergyMult
  dmg = _resolveAttack(monsterAtk, hero.def)
  hero.hp -= dmg
  emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: hero.instanceId, damage: dmg, cellId: ctx.cellId })

// Monster skill (only if monster has a base skill with damage)
if monsterDef.skill && monsterDef.skill.damage:
  ctx.monsterSkillTimer += dt
  // Synergy-enhanced: spread base skill fields, then override with enhancedSkill fields
  skillDef = monsterDef.skill
  if synergyMult > 1 && monsterDef.synergyBonus && monsterDef.synergyBonus.enhancedSkill:
    skillDef = { ...monsterDef.skill, ...monsterDef.synergyBonus.enhancedSkill }
  if ctx.monsterSkillTimer >= skillDef.cd * 1000:
    ctx.monsterSkillTimer = 0
    dmg = skillDef.damage
    hero.hp -= dmg
    emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: hero.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId })

// Resolution
if monster.currentHp <= 0:
  monster._battleDead = true
  _combatContexts.delete(hero.instanceId)
  _cellCombatOwner.delete(ctx.cellId)  // Release occupancy lock
  emit('monsterDefeated', { cellId: ctx.cellId, monsterId: monster.instanceId })
  // Hero continues
  hero.state = 'moving'
  hero.targetCellId = _pickNextCell(hero.currentCellId)
  if hero.targetCellId:
    emit('heroMove', { hero, fromCellId: hero.currentCellId, toCellId: hero.targetCellId })

if hero.hp <= 0:
  _combatContexts.delete(hero.instanceId)
  _cellCombatOwner.delete(ctx.cellId)  // Release occupancy lock
  _heroDefeated(hero, ctx.cellId)
```

#### _tickBossFight(hero, ctx, dt)

```
// Hero attacks boss (each hero has own attack timer)
hero.attackTimer += dt
if hero.attackTimer >= hero.attackCd * 1000:
  hero.attackTimer = 0
  dmg = _resolveAttack(hero.atk, 0)  // boss has no def in MVP
  gameState.bossHp -= dmg
  emit('bossHit', { hero, damage: dmg })

// Hero skill vs boss (only if skill has damage)
if hero.skill && hero.skill.damage:
  hero.skillTimer += dt
  if hero.skillTimer >= hero.skill.cd * 1000:
    hero.skillTimer = 0
    gameState.bossHp -= hero.skill.damage
    emit('bossHit', { hero, damage: hero.skill.damage, isSkill: true })

if hero.hp <= 0:
  _combatContexts.delete(hero.instanceId)
  _bossContext.targetQueue = _bossContext.targetQueue.filter(id => id !== hero.instanceId)
  _heroDefeated(hero, ctx.cellId)
```

**Boss attack (shared timer, called once per tick, not per hero)**:
Boss attack is ticked separately in the main update loop, AFTER all hero fighting ticks:
```
if _bossContext && _bossContext.targetQueue.length > 0:
  _bossContext.attackTimer += dt
  if _bossContext.attackTimer >= 2.0 * 1000:  // boss attackCd = 2s
    _bossContext.attackTimer = 0
    // Attack the first hero in queue (FIFO)
    targetHeroId = _bossContext.targetQueue[0]
    targetHero = heroes.find(h => h.instanceId === targetHeroId)
    if targetHero && targetHero.state === 'fighting':
      dmg = _resolveAttack(gameState.bossAtk, targetHero.def)
      targetHero.hp -= dmg
      emit('attack', { attackerType: 'boss', targetType: 'hero', targetId: targetHeroId, damage: dmg })
```

#### _heroDefeated(hero, cellId)

Event pipeline (strict order per spec):

```
1. hero.state = 'dead'
2. gameState.killCount += 1
3. Gold reward: goldReward = heroDef.goldValue || 50
   gameState.gold += goldReward
4. const completed = gameState.advanceTortureProgress()
   // Process completed torture conversions immediately
   for (const { slot, prisoner } of completed):
     const conversionMap = { trainee_swordsman:'goblin', light_archer:'bat_succubus', priest:'frost_witch', fire_mage:'rage_demon', holy_knight:'skeleton_knight' }
     const monsterTypeId = conversionMap[prisoner.heroTypeId] || 'goblin'
     gameState.createConvertedMonster(monsterTypeId)
     slot.prisoner = null; slot.progress = 0; slot.target = 0
     emit('tortureConversion', { heroTypeId: prisoner.heroTypeId, monsterTypeId })
5. Capture roll: Math.random() < 0.2
   if captured:
     hero.state = 'captured'
     gameState.addPrisoner(hero.typeId, hero.name)
6. emit('heroDefeated', { hero, cellId, captured, goldReward })
```

#### _endBattle(result)

```
_active = false
_restoreMonsters()  // HP reset, remove _battleDead flags
_combatContexts.clear()
emit('battleEnd', { result, kills: gameState.killCount - _preKillCount, goldEarned: gameState.gold - _preGold })
```

#### _pickNextCell(currentCellId)

```
cell = gameState.getCell(currentCellId)
if !cell.connections.length: return null
// Pick connection with lowest distToHeart; tie-break by lowest cell index
// slice() to avoid mutating the original connections array
return cell.connections.slice()
  .sort((a, b) => {
    const da = _distToHeart.get(a) ?? Infinity;  // fallback for disconnected cells
    const db = _distToHeart.get(b) ?? Infinity;
    return (da - db) || a.localeCompare(b);
  })[0]
```

### 3. Hero Generation

```js
_generateHeroes(eventType) {
  const countRange = { normalBattle: [1,3], eliteBattle: [2,4], bossBattle: [3,5] };
  const [min, max] = countRange[eventType];
  const count = min + Math.floor(Math.random() * (max - min + 1));

  // Hero IDs match src/data/heroes.json
  const normalPool = ['trainee_swordsman', 'light_archer'];
  const fullPool = ['trainee_swordsman', 'light_archer', 'priest', 'fire_mage', 'holy_knight'];

  // Weighted random selection using spawnWeight from hero defs
  const weightKey = { normalBattle: 'normal', eliteBattle: 'elite', bossBattle: 'boss' }[eventType];
  const pool = eventType === 'normalBattle' ? normalPool : fullPool;

  const heroes = [];
  for (let i = 0; i < count; i++) {
    const weighted = pool.map(id => {
      const def = this._dataManager.getHero(id);
      return { id, weight: (def && def.spawnWeight) ? (def.spawnWeight[weightKey] || 1) : 1 };
    }).filter(w => w.weight > 0);
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    let typeId = weighted[0].id;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) { typeId = w.id; break; }
    }
    heroes.push(new HeroInstance(typeId, i, this._dataManager));
  }

  // Boss battle guarantee: at least 1 holy_knight
  if (eventType === 'bossBattle' && !heroes.some(h => h.typeId === 'holy_knight')) {
    heroes[0] = new HeroInstance('holy_knight', 0, this._dataManager);
  }

  // Glamour scaling: HP and ATK only. DEF intentionally NOT scaled —
  // higher glamour means more dangerous heroes (glass cannon feel at low glamour,
  // tanky + hard-hitting at high glamour is a separate concern for post-MVP tuning).
  const glamourMult = 1 + this._gameState.glamour / 500;
  for (const h of heroes) {
    h.maxHp = Math.round(h.maxHp * glamourMult);
    h.hp = h.maxHp;
    h.atk = Math.round(h.atk * glamourMult);
  }

  return heroes;
}
```

### 4. Damage Formula

```js
_resolveAttack(atk, def) {
  return Math.max(1, Math.round(atk - def * 0.5));
}
```

### 5. Trap Resolution

```js
_resolveTrap(hero, cell) {
  if (!cell.trap) return 0;
  const trapDef = this._dataManager.getTrap(cell.trap.typeId);
  if (!trapDef) return 0;
  // Lookup level entry from trapDef.levels[]; fallback to multiplier 1.0
  const level = cell.trap.level || 1;
  const levelEntry = trapDef.levels ? trapDef.levels.find(l => l.level === level) : null;
  const multiplier = levelEntry ? levelEntry.damageMultiplier : 1.0;
  const damage = Math.round(trapDef.baseDamage * multiplier);
  hero.hp -= damage;
  return damage;
}
```

### 6. Skill Resolution

Both heroes and monsters auto-cast skills when their skillTimer reaches skill.cd. MVP rules:

**Skill normalization** (handles non-damage skills in heroes.json):
- `type: 'single'` with `damage` field — damage applied to current combat target
- `type: 'aoe'` with `damage` field — damage applied to current target (A1 single-target only; AoE matters in A2)
- `type: 'heal'` — A1 skips (healAmount ignored; priest just auto-attacks)
- `type: 'buff'` — A1 skips (defMultiplier/duration ignored; holy_knight just auto-attacks)
- If skill has no `damage` field or `damage` is falsy → skill auto-cast is skipped, only normal attacks

**Monster enhancedSkill normalization**:
- enhancedSkill in monsters.json may lack `cd` and `type` fields
- If `enhancedSkill.cd` is undefined → inherit from base `skill.cd`
- If `enhancedSkill.type` is undefined → inherit from base `skill.type`
- This ensures `_tickMonsterFight` never reads undefined

Boss active skill is a stub (`triggerBossSkill()` placeholder); Boss only auto-attacks in A1

### 7. Post-Battle Monster Restore

```js
_restoreMonsters() {
  for (const cell of this._gameState.dungeonGrid) {
    if (!cell.monster) continue;
    delete cell.monster._battleDead;
    const def = this._dataManager.getMonster(cell.monster.typeId);
    cell.monster.currentHp = def ? def.baseHp : 100;
  }
}
```

Restore to **full HP** (baseHp) per spec: "Monsters killed in battle are NOT permanently lost — they return to roster between battles with full HP."

### 8. GameState Modifications

```js
// New methods:

advanceTortureProgress() {
  const completed = [];
  for (const slot of this.tortureSlots) {
    if (!slot.unlocked || !slot.prisoner) continue;
    slot.progress += 1;
    if (slot.progress >= slot.target) {
      completed.push({ slot, prisoner: slot.prisoner });
    }
  }
  return completed; // caller handles conversion
}

addPrisoner(heroTypeId, heroName) {
  this.prisoners.push({ heroTypeId, heroName, capturedDay: this.day });
}
```

### 9. GameScene Modifications

```js
// Import
import BattleManager from '../models/BattleManager.js';

// In create():
this.battleManager = new BattleManager(this.gameState, this.dataManager);

// New update() method (Phaser auto-calls):
update(time, delta) {
  if (this.battleManager && this.battleManager.isActive()) {
    this.battleManager.update(delta);
  }
}
```

### 10. FlipEventHandler Modifications

Replace the current battle stub with real BattleManager integration. **Must preserve the existing resolution pipeline** (resolveCard, returnToPreviousSubstate, _checkDayEnd):

```js
_handleBattle(flipCard, unlockCallback) {
  this._showToast('戰鬥開始！', 1000, () => {
    this.gameScene.switchSubstateForced('dungeonMap');
    this.gameScene.showBattleOverlay(flipCard.eventType);

    // Start real battle
    this.gameScene.battleManager.start(flipCard.eventType);

    this.gameScene.battleManager.once('battleEnd', (result) => {
      this.gameScene.hideBattleOverlay();
      this.gameScene.returnToPreviousSubstate();
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      this.gameScene.topHUD.update();
      this._checkDayEnd(unlockCallback);
    });

    // Wire the existing "結束戰鬥" button as a force-end (for stub/debug)
    this.gameScene._onBattleEnd = () => {
      if (this.gameScene.battleManager.isActive()) {
        this.gameScene.battleManager._endBattle('defenseSuccess');
      }
    };
  });
}
```

## Affected Files

```
new:      src/models/HeroInstance.js
new:      src/models/BattleManager.js
modified: src/models/GameState.js (advanceTortureProgress, addPrisoner, fix setCellMonster HP field: hp -> baseHp)
modified: src/scenes/GameScene.js (battleManager init, update loop)
modified: src/substates/FlipEventHandler.js (battle stub -> battleManager.start)
```

## Not Included (A2 Battle UI)

- Hero sprite movement animation on dungeon map
- HP bars, damage popup text
- Boss active skill button + cooldown UI
- Speed control UI [x1] [x2] [Skip]
- Battle end summary screen
- Battle-specific DungeonMap overlay (dim non-active cells, highlight combat cell)

## Verification

1. `npm run dev` -> FlipMatrix -> flip a battle card -> console shows heroSpawn, heroMove, heroArrive events
2. Heroes traverse grid cells toward heart (verify cellId sequence in console)
3. Trap triggers damage on arrival (trapTrigger event with damage value)
4. Monster combat: attack events with correct damage calculations
5. Synergy bonus applied when monster.preferredRoom matches cell.room.typeId
6. Hero defeated -> killCount++, gold += reward, torture progress advances, 20% capture
7. Monster defeated -> _battleDead flag set, subsequent heroes skip
8. Boss fight triggers when hero reaches heart cell
9. Battle ends: 'defenseSuccess' when all heroes dead/captured, 'bossBreached' when bossHp <= 0
10. Post-battle: all monster HP restored to full (baseHp), _battleDead cleared
11. Multiple heroes in parallel: staggered spawn (800ms apart), independent pathfinding

## Risk

Medium —
- Real-time tick accumulation may cause floating-point drift over long battles; mitigate with Math.round on damage
- Multiple heroes fighting same monster uses occupancy lock — hero arrives at a cell where another hero is already fighting → enters `waitingForCombat` state (separate from `moving`). When combat owner finishes (monster dead or hero dead), waiting hero checks if monster still alive and takes over or moves on.
- Glamour scaling formula (1 + glamour/500) is untested for balance; may need tuning
- _battleDead flag on cell.monster is a mutation of shared state; safe because BattleManager owns the battle lifecycle and restores on end
- Boss has no def stat in MVP; hero attacks always do full damage to boss
