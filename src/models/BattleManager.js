// BattleManager.js
// Pure-logic real-time auto-battle engine. Zero Phaser dependency except EventEmitter.

import Phaser from 'phaser';
import HeroInstance from './HeroInstance.js';
import { TORTURE_CONFIG, FINAL_BATTLE_CONFIG, MOVE_DURATION } from '../utils/constants.js';

export default class BattleManager extends Phaser.Events.EventEmitter {
  /**
   * @param {import('./GameState.js').default} gameState
   * @param {import('./DataManager.js').default} dataManager
   */
  constructor(gameState, dataManager) {
    super();
    this._gameState = gameState;
    this._dataManager = dataManager;
    this._active = false;
    this._speedMultiplier = 1;
    this._heroes = [];
    this._distToHeart = new Map();
    this._combatContexts = new Map();
    this._cellCombatOwner = new Map();
    this._bossContext = null;
    this._preKillCount = 0;
    this._preGold = 0;
    this._portalCellId = null;
  }

  // --- Public API ---

  isActive() { return this._active; }
  getHeroes() { return this._heroes; }
  setSpeedMultiplier(x) { this._speedMultiplier = x; }
  getSpeedMultiplier() { return this._speedMultiplier; }
  triggerBossSkill() { /* stub for A2 */ }

  /** Force-end the current battle (for debug / UI override). */
  forceEnd(result = 'defenseSuccess') {
    if (this._active) this._endBattle(result);
  }

  /**
   * Start a new battle.
   * @param {'normalBattle'|'eliteBattle'|'bossBattle'|'finalBattle'} eventType
   */
  start(eventType) {
    this._heroes = this._generateHeroes(eventType);
    this._computeDistToHeart();
    this._combatContexts = new Map();
    this._cellCombatOwner = new Map();
    this._bossContext = null;
    this._preKillCount = this._gameState.killCount;
    this._preGold = this._gameState.gold;
    this.lastResult = null;
    this._active = true;
    this.emit('battleStart', { eventType, heroCount: this._heroes.length });
  }

  /**
   * Main tick — called from GameScene.update(delta).
   * @param {number} dt - raw delta in ms
   */
  update(dt) {
    if (!this._active) return;

    dt *= this._speedMultiplier;

    for (const hero of this._heroes) {
      if (hero.state === 'dead' || hero.state === 'captured') continue;

      switch (hero.state) {
        case 'waiting':
          this._tickWaiting(hero, dt);
          break;
        case 'moving':
          this._tickMoving(hero, dt);
          break;
        case 'waitingForCombat':
          this._tickWaitingForCombat(hero);
          break;
        case 'fighting':
          this._tickFighting(hero, dt);
          break;
      }
    }

    // Boss shared attack tick (after all hero ticks)
    this._tickBossSharedAttack(dt);

    // Check boss breached
    if (this._gameState.bossHp <= 0) {
      this._endBattle('bossBreached');
      return;
    }

    // Check all heroes done
    if (this._heroes.every(h => h.state === 'dead' || h.state === 'captured')) {
      this._endBattle('defenseSuccess');
    }
  }

  // --- State ticks ---

  _tickWaiting(hero, dt) {
    hero.waveDelay -= dt;
    if (hero.waveDelay <= 0) {
      hero.state = 'moving';
      hero.currentCellId = this._portalCellId;
      this.emit('heroSpawn', { hero });
      this._assignNextMove(hero);
    }
  }

  _tickMoving(hero, dt) {
    hero.moveTimer += dt;
    if (hero.moveTimer < hero.effectiveMoveDuration) return;

    hero.moveTimer = 0;
    hero.currentCellId = hero.targetCellId;
    this.emit('heroArrive', { hero, cellId: hero.currentCellId });

    // --- Debuff tick (after heroArrive, before cell processing) ---
    for (const debuff of hero.debuffs) {
      debuff.cellsRemaining--;
      if (debuff.type === 'dot') {
        hero.hp -= debuff.tickDamage;
        this.emit('dotDamage', { hero, cellId: hero.currentCellId, damage: debuff.tickDamage });
        if (hero.hp <= 0) {
          // Remove expired debuffs before returning
          hero.debuffs = hero.debuffs.filter(d => d.cellsRemaining > 0);
          this._heroDefeated(hero, hero.currentCellId);
          return;
        }
      }
    }
    hero.debuffs = hero.debuffs.filter(d => d.cellsRemaining > 0);
    const activeSlow = hero.debuffs.find(d => d.type === 'slow');
    hero.effectiveMoveDuration = activeSlow
      ? MOVE_DURATION * activeSlow.moveDurationMult
      : MOVE_DURATION;
    // --- End debuff tick ---

    const cell = this._gameState.getCell(hero.currentCellId);
    if (!cell) return;

    // Heart cell -> fight boss
    if (cell.type === 'heart') {
      hero.state = 'fighting';
      if (!this._bossContext) {
        this._bossContext = { attackTimer: 0, targetQueue: [] };
      }
      this._bossContext.targetQueue.push(hero.instanceId);
      this._combatContexts.set(hero.instanceId, { heroId: hero.instanceId, cellId: cell.id, isBoss: true });
      this.emit('combatStart', { hero, cellId: cell.id, isBoss: true });
      return;
    }

    // Trap
    if (cell.trap) {
      const damage = this._resolveTrap(hero, cell);
      this.emit('trapTrigger', { hero, cellId: cell.id, damage });
      if (hero.hp <= 0) {
        this._heroDefeated(hero, cell.id);
        return;
      }
    }

    // Monster (with occupancy lock)
    if (cell.monster && !cell.monster._battleDead) {
      if (this._cellCombatOwner.has(cell.id)) {
        hero.state = 'waitingForCombat';
        hero.moveTimer = 0;
        return;
      }
      hero.state = 'fighting';
      this._cellCombatOwner.set(cell.id, hero.instanceId);
      this._combatContexts.set(hero.instanceId, {
        heroId: hero.instanceId,
        cellId: cell.id,
        monsterAttackTimer: 0,
        monsterSkillTimer: 0,
      });
      this.emit('combatStart', { hero, cellId: cell.id, monsterId: cell.monster.instanceId });
      return;
    }

    // Empty cell -> keep moving
    this._assignNextMove(hero);
  }

  _tickWaitingForCombat(hero) {
    const cell = this._gameState.getCell(hero.currentCellId);
    if (!cell) return;
    if (this._cellCombatOwner.has(cell.id)) return; // still occupied

    if (cell.monster && !cell.monster._battleDead) {
      // Monster still alive, previous hero died -> take over
      hero.state = 'fighting';
      this._cellCombatOwner.set(cell.id, hero.instanceId);
      this._combatContexts.set(hero.instanceId, {
        heroId: hero.instanceId,
        cellId: cell.id,
        monsterAttackTimer: 0,
        monsterSkillTimer: 0,
      });
      this.emit('combatStart', { hero, cellId: cell.id, monsterId: cell.monster.instanceId });
    } else {
      // Monster dead -> continue moving
      hero.state = 'moving';
      this._assignNextMove(hero);
    }
  }

  _tickFighting(hero, dt) {
    const ctx = this._combatContexts.get(hero.instanceId);
    if (!ctx) return;

    if (ctx.isBoss) {
      this._tickBossFight(hero, ctx, dt);
    } else {
      this._tickMonsterFight(hero, ctx, dt);
    }
  }

  // --- Monster combat ---

  _tickMonsterFight(hero, ctx, dt) {
    const cell = this._gameState.getCell(ctx.cellId);
    if (!cell || !cell.monster) return;
    const monster = cell.monster;
    const monsterDef = this._dataManager.getMonster(monster.typeId);
    if (!monsterDef) return;

    // Buff flags from roster (converted monsters get 1.15x)
    const buffFlags = this._getMonsterBuffFlags(monster.instanceId);

    // Synergy check
    const hasSynergy = cell.room && monsterDef.preferredRoom === cell.room.typeId;
    const synergyMult = hasSynergy ? monsterDef.synergyBonus.atkMultiplier : 1;

    // Hero attacks
    hero.attackTimer += dt;
    if (hero.attackTimer >= hero.attackCd * 1000) {
      hero.attackTimer = 0;
      const dmg = this._resolveAttack(hero.atk, monsterDef.baseDef);
      monster.currentHp -= dmg;
      this.emit('attack', { attackerType: 'hero', attackerId: hero.instanceId, targetType: 'monster', targetId: monster.instanceId, damage: dmg, cellId: ctx.cellId });
    }

    // Hero skill
    if (hero.skill) {
      hero.skillTimer += dt;
      if (hero.skillTimer >= hero.skill.cd * 1000) {
        hero.skillTimer = 0;
        const dmg = hero.skill.damage;
        monster.currentHp -= dmg;
        this.emit('attack', { attackerType: 'hero', attackerId: hero.instanceId, targetType: 'monster', targetId: monster.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId });
      }
    }

    // Check monster death immediately after hero damage (prevent dead monster retaliation)
    if (monster.currentHp <= 0) {
      monster._battleDead = true;
      this._combatContexts.delete(hero.instanceId);
      this._cellCombatOwner.delete(ctx.cellId);
      this.emit('monsterDefeated', { cellId: ctx.cellId, monsterId: monster.instanceId });
      hero.state = 'moving';
      hero.attackTimer = 0;
      hero.skillTimer = 0;
      this._assignNextMove(hero);
      return;
    }

    // Monster attacks
    ctx.monsterAttackTimer += dt;
    if (ctx.monsterAttackTimer >= monsterDef.attackCd * 1000) {
      ctx.monsterAttackTimer = 0;
      const monsterAtk = monsterDef.baseAtk * synergyMult * buffFlags.atkMult;
      const dmg = this._resolveAttack(monsterAtk, hero.def);
      hero.hp -= dmg;
      this.emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: hero.instanceId, damage: dmg, cellId: ctx.cellId });
    }

    // Monster skill (only if base skill has damage)
    if (monsterDef.skill && monsterDef.skill.damage) {
      ctx.monsterSkillTimer += dt;
      // Synergy-enhanced skill: spread base then override
      let skillDef = monsterDef.skill;
      if (synergyMult > 1 && monsterDef.synergyBonus && monsterDef.synergyBonus.enhancedSkill) {
        skillDef = { ...monsterDef.skill, ...monsterDef.synergyBonus.enhancedSkill };
      }
      if (ctx.monsterSkillTimer >= skillDef.cd * 1000) {
        ctx.monsterSkillTimer = 0;
        const dmg = skillDef.damage;
        hero.hp -= dmg;
        this.emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: hero.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId });
      }
    }

    // Resolution: hero dead
    if (hero.hp <= 0) {
      this._combatContexts.delete(hero.instanceId);
      this._cellCombatOwner.delete(ctx.cellId);
      this._heroDefeated(hero, ctx.cellId);
    }
  }

  // --- Boss combat ---

  _tickBossFight(hero, ctx, dt) {
    // Early check: hero may have been killed by boss shared attack last tick
    if (hero.hp <= 0) {
      this._combatContexts.delete(hero.instanceId);
      this._bossContext.targetQueue = this._bossContext.targetQueue.filter(id => id !== hero.instanceId);
      this._heroDefeated(hero, ctx.cellId);
      return;
    }

    // Hero attacks boss
    hero.attackTimer += dt;
    if (hero.attackTimer >= hero.attackCd * 1000) {
      hero.attackTimer = 0;
      const dmg = this._resolveAttack(hero.atk, 0); // boss has no def in MVP
      this._gameState.bossHp -= dmg;
      this.emit('bossHit', { hero, damage: dmg });
    }

    // Hero skill vs boss
    if (hero.skill && hero.skill.damage) {
      hero.skillTimer += dt;
      if (hero.skillTimer >= hero.skill.cd * 1000) {
        hero.skillTimer = 0;
        this._gameState.bossHp -= hero.skill.damage;
        this.emit('bossHit', { hero, damage: hero.skill.damage, isSkill: true });
      }
    }

  }

  /**
   * Boss shared attack — one timer, FIFO targeting. Called once per tick after all hero fighting ticks.
   */
  _tickBossSharedAttack(dt) {
    if (!this._bossContext || this._bossContext.targetQueue.length === 0) return;
    if (this._gameState.bossHp <= 0) return;

    this._bossContext.attackTimer += dt;
    if (this._bossContext.attackTimer >= 2.0 * 1000) { // boss attackCd = 2s
      this._bossContext.attackTimer = 0;
      const targetHeroId = this._bossContext.targetQueue[0];
      const targetHero = this._heroes.find(h => h.instanceId === targetHeroId);
      if (targetHero && targetHero.state === 'fighting') {
        const dmg = this._resolveAttack(this._gameState.bossAtk, targetHero.def);
        targetHero.hp -= dmg;
        this.emit('attack', { attackerType: 'boss', targetType: 'hero', targetId: targetHeroId, damage: dmg });
      }
    }
  }

  // --- Hero defeated pipeline ---

  _heroDefeated(hero, cellId) {
    hero.state = 'dead';
    this._gameState.killCount += 1;

    // Gold reward
    const heroDef = this._dataManager.getHero(hero.typeId);
    const goldReward = (heroDef && heroDef.goldValue) || 50;
    this._gameState.gold += goldReward;

    // Advance torture progress
    const completed = this._gameState.advanceTortureProgress();
    for (const { slot, prisoner } of completed) {
      const monsterTypeId = TORTURE_CONFIG.conversionMap[prisoner.heroTypeId] || 'goblin';
      this._gameState.createConvertedMonster(monsterTypeId);
      slot.prisoner = null;
      slot.progress = 0;
      slot.target = 0;
      this.emit('tortureConversion', { heroTypeId: prisoner.heroTypeId, monsterTypeId });
    }

    // Capture roll: 20%
    const captured = Math.random() < 0.2;
    if (captured) {
      hero.state = 'captured';
      this._gameState.addPrisoner(hero.typeId, hero.name);
    }

    this.emit('heroDefeated', { hero, cellId, captured, goldReward });
  }

  // --- Battle end ---

  _endBattle(result) {
    this.lastResult = result;
    this._active = false;
    this._restoreMonsters();
    this._combatContexts.clear();
    this._cellCombatOwner.clear();
    this.emit('battleEnd', {
      result,
      kills: this._gameState.killCount - this._preKillCount,
      goldEarned: this._gameState.gold - this._preGold,
    });
  }

  // --- Helpers ---

  _resolveAttack(atk, def) {
    return Math.max(1, Math.round(atk - def * 0.5));
  }

  /**
   * Look up buffFlags for a monster instance from the roster.
   * @returns {{ hpMult: number, atkMult: number }}
   */
  _getMonsterBuffFlags(instanceId) {
    const rosterEntry = this._gameState.monsterRoster.find(m => m.instanceId === instanceId);
    if (rosterEntry && rosterEntry.buffFlags) {
      return { hpMult: rosterEntry.buffFlags.hpMult || 1, atkMult: rosterEntry.buffFlags.atkMult || 1 };
    }
    return { hpMult: 1, atkMult: 1 };
  }

  _resolveTrap(hero, cell) {
    if (!cell.trap) return 0;
    const trapDef = this._dataManager.getTrap(cell.trap.typeId);
    if (!trapDef) return 0;
    const level = cell.trap.level || 1;
    const levelEntry = trapDef.levels ? trapDef.levels.find(l => l.level === level) : null;
    const multiplier = levelEntry ? levelEntry.damageMultiplier : 1.0;
    const damage = Math.round(trapDef.baseDamage * multiplier);
    hero.hp -= damage;

    // Apply special effects based on effectType
    if (trapDef.effectType === 'ice') {
      this._applyDebuff(hero, {
        type: 'slow',
        moveDurationMult: 2,
        cellsRemaining: trapDef.slowTurns || 3,
      });
    } else if (trapDef.effectType === 'poison_dot') {
      this._applyDebuff(hero, {
        type: 'dot',
        tickDamage: 5,
        cellsRemaining: trapDef.dotTicks || 4,
      });
    }
    // fire_aoe: MVP — base damage to triggerer only, no additional debuff

    return damage;
  }

  /**
   * Apply a debuff to a hero using overwrite-if-larger-cellsRemaining rule.
   * Same type: keep the one with larger cellsRemaining. Different types coexist.
   * @param {HeroInstance} hero
   * @param {{ type: string, cellsRemaining: number, [key: string]: any }} debuff
   */
  _applyDebuff(hero, debuff) {
    const existing = hero.debuffs.find(d => d.type === debuff.type);
    if (existing) {
      if (debuff.cellsRemaining > existing.cellsRemaining) {
        Object.assign(existing, debuff);
      }
      // else keep existing (it has more time remaining)
    } else {
      hero.debuffs.push({ ...debuff });
    }
    // Immediately sync effectiveMoveDuration so slow takes effect on current movement
    if (debuff.type === 'slow') {
      const activeSlow = hero.debuffs.find(d => d.type === 'slow');
      if (activeSlow) {
        hero.effectiveMoveDuration = MOVE_DURATION * activeSlow.moveDurationMult;
      }
    }
  }

  _restoreMonsters() {
    for (const cell of this._gameState.dungeonGrid) {
      if (!cell.monster) continue;
      delete cell.monster._battleDead;
      const def = this._dataManager.getMonster(cell.monster.typeId);
      const baseHp = def ? def.baseHp : 100;
      const buffFlags = this._getMonsterBuffFlags(cell.monster.instanceId);
      cell.monster.currentHp = Math.round(baseHp * buffFlags.hpMult);
    }
  }

  /**
   * BFS from heart backwards to compute distance for hero pathfinding.
   */
  _computeDistToHeart() {
    this._distToHeart = new Map();
    const grid = this._gameState.dungeonGrid;

    // Find heart and portal
    const heartCell = grid.find(c => c.type === 'heart');
    const portalCell = grid.find(c => c.type === 'portal');
    this._portalCellId = portalCell ? portalCell.id : null;

    if (!heartCell) return;

    // BFS from heart
    const queue = [heartCell.id];
    this._distToHeart.set(heartCell.id, 0);

    while (queue.length > 0) {
      const currentId = queue.shift();
      const current = this._gameState.getCell(currentId);
      if (!current) continue;
      const dist = this._distToHeart.get(currentId);

      // Find all cells that connect TO this cell (reverse edges)
      for (const cell of grid) {
        if (this._distToHeart.has(cell.id)) continue;
        if (cell.connections && cell.connections.includes(currentId)) {
          this._distToHeart.set(cell.id, dist + 1);
          queue.push(cell.id);
        }
      }
    }
  }

  /**
   * Assign next move for a hero. If no valid next cell, treat hero as defeated.
   * @returns {boolean} true if hero has a valid next cell
   */
  _assignNextMove(hero) {
    hero.targetCellId = this._pickNextCell(hero.currentCellId);
    if (hero.targetCellId) {
      this.emit('heroMove', { hero, fromCellId: hero.currentCellId, toCellId: hero.targetCellId });
      return true;
    }
    this._heroDefeated(hero, hero.currentCellId);
    return false;
  }

  /**
   * Pick the next cell towards the heart (lowest distToHeart).
   */
  _pickNextCell(currentCellId) {
    const cell = this._gameState.getCell(currentCellId);
    if (!cell || !cell.connections || !cell.connections.length) return null;

    return cell.connections.slice()
      .sort((a, b) => {
        const da = this._distToHeart.get(a) ?? Infinity;
        const db = this._distToHeart.get(b) ?? Infinity;
        return (da - db) || a.localeCompare(b);
      })[0];
  }

  // --- Hero generation ---

  _generateHeroes(eventType) {
    // Final battle: legendary hero + scaled followers
    if (eventType === 'finalBattle') {
      return this._generateFinalBattleHeroes();
    }

    const countRange = { normalBattle: [1, 3], eliteBattle: [2, 4], bossBattle: [3, 5] };
    const [min, max] = countRange[eventType];
    const count = min + Math.floor(Math.random() * (max - min + 1));

    const normalPool = ['trainee_swordsman', 'light_archer'];
    const fullPool = ['trainee_swordsman', 'light_archer', 'priest', 'fire_mage', 'holy_knight'];
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

    // Glamour scaling: HP and ATK only
    const glamourMult = 1 + this._gameState.glamour / 500;
    for (const h of heroes) {
      h.maxHp = Math.round(h.maxHp * glamourMult);
      h.hp = h.maxHp;
      h.atk = Math.round(h.atk * glamourMult);
    }

    return heroes;
  }

  _generateFinalBattleHeroes() {
    const day = this._gameState.day;
    const configDay = Math.min(day, 7);
    const config = FINAL_BATTLE_CONFIG[configDay] ?? FINAL_BATTLE_CONFIG[3];

    const heroes = [];

    // 1. Legendary hero (no stat scaling — fixed stats from data)
    heroes.push(new HeroInstance('hero_of_legend', 0, this._dataManager));

    // 2. Followers: weighted random from boss pool, stats scaled
    const fullPool = ['trainee_swordsman', 'light_archer', 'priest', 'fire_mage', 'holy_knight'];
    for (let i = 0; i < config.followerCount; i++) {
      const weighted = fullPool.map(id => {
        const def = this._dataManager.getHero(id);
        return { id, weight: (def && def.spawnWeight) ? (def.spawnWeight.boss || 1) : 1 };
      }).filter(w => w.weight > 0);
      if (weighted.length === 0) {
        const fallbackId = fullPool[Math.floor(Math.random() * fullPool.length)];
        const hero = new HeroInstance(fallbackId, heroes.length, this._dataManager);
        hero.maxHp = Math.round(hero.maxHp * config.statMultiplier);
        hero.hp = hero.maxHp;
        hero.atk = Math.round(hero.atk * config.statMultiplier);
        heroes.push(hero);
        continue;
      }
      const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
      let roll = Math.random() * totalWeight;
      let typeId = weighted[0].id;
      for (const w of weighted) {
        roll -= w.weight;
        if (roll <= 0) { typeId = w.id; break; }
      }
      const hero = new HeroInstance(typeId, heroes.length, this._dataManager);
      // Apply stat multiplier
      hero.maxHp = Math.round(hero.maxHp * config.statMultiplier);
      hero.hp = hero.maxHp;
      hero.atk = Math.round(hero.atk * config.statMultiplier);
      heroes.push(hero);
    }

    // Glamour scaling — followers only; legendary hero has fixed stats
    const glamourMult = 1 + this._gameState.glamour / 500;
    for (let i = 1; i < heroes.length; i++) {
      heroes[i].maxHp = Math.round(heroes[i].maxHp * glamourMult);
      heroes[i].hp = heroes[i].maxHp;
      heroes[i].atk = Math.round(heroes[i].atk * glamourMult);
    }

    return heroes;
  }
}
