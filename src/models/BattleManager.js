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
    this._battleCount = 0;
  }

  // --- Public API ---

  isActive() { return this._active; }
  getHeroes() { return this._heroes; }
  setSpeedMultiplier(x) { this._speedMultiplier = x; }
  getSpeedMultiplier() { return this._speedMultiplier; }
  /** Get all heroes' pre-computed routes (for forecast display). */
  getHeroRoutes() { return this._heroes.map(h => h.route).filter(Boolean); }
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
    this._battleCount++;
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

    // Priest auto-shield passive (before boss action, after all hero ticks)
    for (const hero of this._heroes) {
      if (hero.state !== 'fighting' || hero.hp <= 0) continue;
      if (hero.typeId !== 'priest') continue;

      hero.traitState.shieldTimer = (hero.traitState.shieldTimer || 0) + dt;
      if (hero.traitState.shieldTimer >= 3000) {
        hero.traitState.shieldTimer = 0;
        const allies = this._heroes.filter(h => h.state === 'fighting' && h.hp > 0);
        if (allies.length > 0) {
          const target = allies.reduce((lowest, h) => h.hp < lowest.hp ? h : lowest);
          target.shield = 15;
          this.emit('heroShield', { hero, target, amount: 15 });
        }
      }
    }

    // Check boss breached (BEFORE boss action to prevent dead-boss attacks)
    if (this._gameState.bossHp <= 0) {
      this._endBattle('bossBreached');
      return;
    }

    // Boss action tick — skills + shared attack + summon tick (after all hero ticks)
    this._tickBossAction(dt);

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
      // Assign pre-computed route if not already set
      if (!hero.route) {
        const heroIndex = hero.spawnIndex ?? this._heroes.indexOf(hero);
        hero.route = this._computeHeroRoute(heroIndex);
        hero.routeIndex = 0;
      }
      this.emit('heroSpawn', { hero });
      this._gameState.recordHeroSeen(hero.typeId);
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
        this._applyDamageToHero(hero, debuff.tickDamage);
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

    // Gold steal trait (thief) — steal on every non-heart cell arrival
    if (hero.trait && hero.trait.id === 'gold_steal' && cell.type !== 'heart') {
      const stealAmt = Math.min(hero.trait.amount, this._gameState.gold);
      if (stealAmt > 0) {
        this._gameState.gold -= stealAmt;
        hero.stolenGold += stealAmt;
        this.emit('goldSteal', { hero, cellId: hero.currentCellId, amount: stealAmt });
      }
    }

    // Heart cell -> fight boss
    if (cell.type === 'heart') {
      hero.state = 'fighting';
      if (!this._bossContext) {
        const bossConfig = this._dataManager.getBossConfig();
        const skillTimers = {};
        for (const skill of bossConfig.skills) {
          skillTimers[skill.id] = skill.cd * 0.5 * 1000; // 50% initial delay
        }
        const shieldSkill = bossConfig.skills.find(s => s.id === 'dark_shield');
        const phase1 = bossConfig.phases ? bossConfig.phases[0] : null;
        this._bossContext = {
          attackTimer: 0,
          targetQueue: [],
          skillTimers,
          shieldActive: false,
          shieldTimer: 0,
          attackCd: bossConfig.attackCd,
          shieldReduction: shieldSkill ? shieldSkill.damageReduction : 0,
          // Phase 2 fields
          currentPhase: 1,
          enabledSkillIds: phase1 ? phase1.enabledSkillIds : bossConfig.skills.map(s => s.id),
          atkMultiplier: 1.0,
          cdMultiplier: 1.0,
          summons: [],
        };
      }
      this._bossContext.targetQueue.push(hero.instanceId);
      this._combatContexts.set(hero.instanceId, { heroId: hero.instanceId, cellId: cell.id, isBoss: true });
      this.emit('combatStart', { hero, cellId: cell.id, isBoss: true });
      return;
    }

    // Trap
    if (cell.trap) {
      const result = this._resolveTrap(hero, cell);
      if (result.status === 'parried') {
        this.emit('trapParry', { hero, cellId: cell.id });
      } else if (result.status === 'skipped') {
        this.emit('trapSkip', { hero, cellId: cell.id });
      } else {
        this.emit('trapTrigger', { hero, cellId: cell.id, damage: result.damage });
      }
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

    // Room buff (tag-based, separate from synergy)
    const roomBuff = this._getRoomBuff(cell, monsterDef);

    // Synergy check
    const hasSynergy = cell.room && monsterDef.preferredRoom === cell.room.typeId;
    const synergyMult = hasSynergy ? monsterDef.synergyBonus.atkMultiplier : 1;

    // Hero attacks
    hero.attackTimer += dt;
    if (hero.attackTimer >= hero.attackCd * 1000) {
      hero.attackTimer = 0;
      const effectiveDef = Math.round(monsterDef.baseDef * roomBuff.defMult);
      let dmg = this._resolveAttack(hero.atk, effectiveDef);
      // Combat trait bonus (anti_undead, anti_flying, etc.)
      const combatBonus = hero.combatTrait && monsterDef.type && monsterDef.type.includes(hero.combatTrait.targetType);
      if (combatBonus) {
        dmg = Math.round(dmg * hero.combatTrait.multiplier);
      }
      monster.currentHp -= dmg;
      this.emit('attack', { attackerType: 'hero', attackerId: hero.instanceId, targetType: 'monster', targetId: monster.instanceId, damage: dmg, cellId: ctx.cellId, holyBonus: combatBonus || false });
    }

    // Hero skill
    if (hero.skill) {
      hero.skillTimer += dt;
      if (hero.skillTimer >= hero.skill.cd * 1000) {
        hero.skillTimer = 0;
        if (hero.skill.healAmount) {
          // Heal skill (priest): self-heal in monster fights
          const amount = Math.min(hero.skill.healAmount, hero.maxHp - hero.hp);
          if (amount > 0) {
            hero.hp += amount;
            this.emit('heroHeal', { hero, target: hero, amount, cellId: ctx.cellId });
          }
        } else if (hero.skill.damage) {
          let skillDmg = hero.skill.damage;
          // Combat trait bonus (anti_undead, anti_flying, etc.)
          const combatBonusSkill = hero.combatTrait && monsterDef.type && monsterDef.type.includes(hero.combatTrait.targetType);
          if (combatBonusSkill) {
            skillDmg = Math.round(skillDmg * hero.combatTrait.multiplier);
          }
          monster.currentHp -= skillDmg;
          this.emit('attack', { attackerType: 'hero', attackerId: hero.instanceId, targetType: 'monster', targetId: monster.instanceId, damage: skillDmg, isSkill: true, cellId: ctx.cellId, holyBonus: combatBonusSkill || false });

          // Check monster death after skill hit
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

          // Burn on skill trait
          if (hero.trait && hero.trait.id === 'burn_on_skill' && Math.random() < hero.trait.chance) {
            ctx.burnState = { damage: hero.trait.damage, ticksRemaining: hero.trait.ticks, timer: 0 };
          }
        }
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
    if (ctx.monsterAttackTimer >= monsterDef.attackCd * roomBuff.cdMult * 1000) {
      ctx.monsterAttackTimer = 0;
      const monsterAtk = Math.round(monsterDef.baseAtk * synergyMult * buffFlags.atkMult * roomBuff.atkMult);
      const dmg = this._resolveAttack(monsterAtk, hero.def);
      this._applyDamageToHero(hero, dmg);
      this.emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: hero.instanceId, damage: dmg, cellId: ctx.cellId });
      // Room buff: HP regen on attack
      if (roomBuff.hpRegen > 0 && monster.currentHp < (monster.maxHp || Infinity)) {
        const regen = Math.min(roomBuff.hpRegen, (monster.maxHp || Infinity) - monster.currentHp);
        if (regen > 0) {
          monster.currentHp += regen;
          this.emit('monsterRegen', { cellId: ctx.cellId, monsterId: monster.instanceId, amount: regen });
        }
      }
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
        const dmg = Math.round(skillDef.damage * roomBuff.skillMult);

        if (skillDef.type === 'aoe') {
          const targets = this._heroes.filter(h => h.state === 'fighting' && h.hp > 0);
          for (const target of targets) {
            this._applyDamageToHero(target, dmg);
            this.emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: target.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId });
          }
        } else {
          this._applyDamageToHero(hero, dmg);
          this.emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: hero.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId });
        }
      }
    }

    // Resolution: hero dead (check before burn tick to prevent dead hero continuing)
    if (hero.hp <= 0) {
      this._combatContexts.delete(hero.instanceId);
      this._cellCombatOwner.delete(ctx.cellId);
      this._heroDefeated(hero, ctx.cellId);
      return;
    }

    // Burn tick (independent 1.5s timer)
    if (ctx.burnState && ctx.burnState.ticksRemaining > 0) {
      ctx.burnState.timer += dt;
      if (ctx.burnState.timer >= 1500) {
        ctx.burnState.timer = 0;
        ctx.burnState.ticksRemaining--;
        monster.currentHp -= ctx.burnState.damage;
        this.emit('burnDamage', { hero, cellId: ctx.cellId, damage: ctx.burnState.damage });
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
      }
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
      let dmg = this._resolveAttack(hero.atk, 0); // boss has no def in MVP
      // Shield 減傷（cached reduction from _bossContext）
      if (this._bossContext?.shieldActive) {
        dmg = Math.round(dmg * (1 - this._bossContext.shieldReduction));
      }
      this._gameState.bossHp -= dmg;
      this.emit('bossHit', { hero, damage: dmg, shielded: this._bossContext?.shieldActive || false });
    }

    // Hero skill vs boss
    if (hero.skill) {
      hero.skillTimer += dt;
      if (hero.skillTimer >= hero.skill.cd * 1000) {
        hero.skillTimer = 0;
        if (hero.skill.healAmount) {
          // Heal skill (priest): heal lowest HP ally in boss fight
          const allies = this._heroes.filter(h => h.state === 'fighting' && h.hp > 0);
          if (allies.length > 0) {
            const target = allies.reduce((lowest, h) => h.hp < lowest.hp ? h : lowest);
            const amount = Math.min(hero.skill.healAmount, target.maxHp - target.hp);
            if (amount > 0) {
              target.hp += amount;
              this.emit('heroHeal', { hero, target, amount, cellId: ctx.cellId });
            }
          }
        } else if (hero.skill.damage) {
          let skillDmg = hero.skill.damage;
          // Shield 減傷（cached reduction from _bossContext）
          if (this._bossContext?.shieldActive) {
            skillDmg = Math.round(skillDmg * (1 - this._bossContext.shieldReduction));
          }
          this._gameState.bossHp -= skillDmg;
          this.emit('bossHit', { hero, damage: skillDmg, isSkill: true, shielded: this._bossContext?.shieldActive || false });
        }
      }
    }

  }

  _tickBossAction(dt) {
    if (!this._bossContext) return;
    if (this._gameState.bossHp <= 0) return;

    const ctx = this._bossContext;
    const bossConfig = this._dataManager.getBossConfig();

    // 0. Phase transition check
    if (bossConfig.phases && ctx.currentPhase === 1) {
      const phase2 = bossConfig.phases.find(p => p.id === 2);
      if (phase2 && this._gameState.bossHp / this._gameState.bossMaxHp <= phase2.hpThreshold) {
        ctx.currentPhase = 2;
        ctx.enabledSkillIds = phase2.enabledSkillIds;
        ctx.atkMultiplier = phase2.atkMultiplier;
        ctx.cdMultiplier = phase2.cdMultiplier;
        // Reset all timers to prevent immediate triggers from cdMultiplier shrink
        for (const skillId of Object.keys(ctx.skillTimers)) {
          ctx.skillTimers[skillId] = 0;
        }
        ctx.attackTimer = 0;
        // Init timer for newly enabled skills
        for (const skillId of phase2.enabledSkillIds) {
          if (!(skillId in ctx.skillTimers)) {
            ctx.skillTimers[skillId] = 0;
          }
        }
        this.emit('bossPhaseChange', { phase: 2 });
        // Skip this frame entirely; phase 2 starts next frame (no summon tick either)
        return;
      }
    }

    // 1. 更新護盾計時器（即使 targetQueue 為空也要推進）
    if (ctx.shieldActive) {
      ctx.shieldTimer -= dt;
      if (ctx.shieldTimer <= 0) {
        ctx.shieldActive = false;
        ctx.shieldTimer = 0;
        this.emit('bossSkillEnd', { skillId: 'dark_shield' });
      }
    }

    // 2. 推進 enabled 技能 CD
    const enabledSkills = bossConfig.skills.filter(s => ctx.enabledSkillIds.includes(s.id));
    for (const skill of enabledSkills) {
      ctx.skillTimers[skill.id] += dt;
    }

    // 無英雄在場時不執行技能/普攻（summon tick still runs below）
    if (ctx.targetQueue.length === 0) {
      this._tickSummons(dt);
      return;
    }

    // 3. 依 enabledSkillIds 順序檢查技能
    for (const skill of enabledSkills) {
      if (ctx.skillTimers[skill.id] >= skill.cd * ctx.cdMultiplier * 1000) {
        // Summon type: check maxActive cap; if full, don't consume CD, try next
        if (skill.type === 'summon') {
          if (ctx.summons.length >= (skill.maxActive || 1)) continue;
          ctx.skillTimers[skill.id] = 0;
          ctx.summons.push({
            atk: skill.summonAtk,
            attackTimer: 0,
            remainingTime: skill.summonDuration * 1000,
            attackCd: skill.summonAttackCd,
          });
          this.emit('bossSummon', { skillId: skill.id, skillName: skill.name });
          // Note: do NOT emit bossSkill for summon — bossSummon has its own UI handler
          return; // 每 tick 至多一個動作
        }

        if (skill.type === 'buff_self' && ctx.shieldActive) continue;

        ctx.skillTimers[skill.id] = 0;

        if (skill.type === 'aoe_damage') {
          const dmg = Math.round(this._gameState.bossAtk * ctx.atkMultiplier * skill.damageMultiplier);
          const hitHeroes = this._heroes.filter(h => h.state === 'fighting' && h.hp > 0);
          for (const hero of hitHeroes) {
            this._applyDamageToHero(hero, dmg);
            this.emit('attack', {
              attackerType: 'boss', targetType: 'hero',
              targetId: hero.instanceId, damage: dmg, isSkill: true,
            });
          }
          this.emit('bossSkill', { skillId: skill.id, skillName: skill.name });
        } else if (skill.type === 'buff_self') {
          ctx.shieldActive = true;
          ctx.shieldTimer = skill.duration * 1000;
          ctx.shieldReduction = skill.damageReduction;
          this.emit('bossSkill', { skillId: skill.id, skillName: skill.name });
        }
        return; // 每 tick 至多一個動作
      }
    }

    // 4. 技能未觸發 → 普攻
    ctx.attackTimer += dt;
    if (ctx.attackTimer >= ctx.attackCd * 1000) {
      ctx.attackTimer = 0;
      const targetHeroId = ctx.targetQueue[0];
      const targetHero = this._heroes.find(h => h.instanceId === targetHeroId);
      if (targetHero && targetHero.state === 'fighting') {
        const dmg = this._resolveAttack(this._gameState.bossAtk * ctx.atkMultiplier, targetHero.def);
        this._applyDamageToHero(targetHero, dmg);
        this.emit('attack', { attackerType: 'boss', targetType: 'hero', targetId: targetHeroId, damage: dmg });
      }
    }

    // 5. Summon tick — AFTER boss skills/attack, independent of targetQueue gate
    this._tickSummons(dt);
  }

  /**
   * Summon tick — timer-based side effects, independent of targetQueue gate.
   * Duration/timer always advance. Attacks random fighting hero.
   */
  _tickSummons(dt) {
    const ctx = this._bossContext;
    if (!ctx || ctx.summons.length === 0) return;

    for (let i = ctx.summons.length - 1; i >= 0; i--) {
      const summon = ctx.summons[i];
      summon.remainingTime -= dt;
      if (summon.remainingTime <= 0) {
        ctx.summons.splice(i, 1);
        continue;
      }
      summon.attackTimer += dt;
      if (summon.attackTimer >= summon.attackCd * 1000) {
        summon.attackTimer = 0;
        const candidates = this._heroes.filter(h => h.state === 'fighting' && h.hp > 0);
        if (candidates.length === 0) continue;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const dmg = this._resolveAttack(summon.atk, target.def);
        this._applyDamageToHero(target, dmg);
        this.emit('summonAttack', { targetId: target.instanceId, damage: dmg });
      }
    }
  }

  // --- Damage helper (shield absorption) ---

  _applyDamageToHero(hero, dmg) {
    if (hero.shield > 0) {
      if (dmg <= hero.shield) {
        hero.shield -= dmg;
        return;
      }
      dmg -= hero.shield;
      hero.shield = 0;
    }
    hero.hp -= dmg;
  }

  // --- Hero defeated pipeline ---

  _heroDefeated(hero, cellId) {
    hero.state = 'dead';
    this._gameState.killCount += 1;

    // Gold reward + return stolen gold
    const heroDef = this._dataManager.getHero(hero.typeId);
    const goldReward = (heroDef && heroDef.goldValue) || 50;
    const returnedGold = hero.stolenGold || 0;
    this._gameState.gold += goldReward + returnedGold;
    if (returnedGold > 0) {
      this.emit('goldReturn', { hero, cellId, amount: returnedGold });
    }

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

    // Only count as killed if not captured
    if (!captured) {
      this._gameState.recordHeroKilled(hero.typeId);
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
    this._bossContext = null;
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

  /**
   * Compute room buff for a monster based on cell's room and monster's type tags.
   * @returns {{ defMult: number, atkMult: number, cdMult: number, skillMult: number, hpRegen: number }}
   */
  _getRoomBuff(cell, monsterDef) {
    const noBuff = { defMult: 1, atkMult: 1, cdMult: 1, skillMult: 1, hpRegen: 0 };
    if (!cell.room) return noBuff;
    const roomDef = this._dataManager.getRoom(cell.room.typeId);
    if (!roomDef || !roomDef.buffEffect || !roomDef.buffTarget) return noBuff;
    // Check if any of the monster's type tags match the room's buffTarget
    if (!monsterDef.type || !monsterDef.type.includes(roomDef.buffTarget)) return noBuff;

    const level = cell.room.level || 1;
    const levelEntry = roomDef.levels && roomDef.levels.find(l => l.level === level);
    const lvMult = levelEntry ? levelEntry.multiplier : 1;
    const eff = roomDef.buffEffect;

    return {
      defMult: eff.def ? 1 + (eff.def - 1) * lvMult : 1,
      atkMult: eff.atk ? 1 + (eff.atk - 1) * lvMult : 1,
      cdMult: eff.attackCdMultiplier ? 1 - (1 - eff.attackCdMultiplier) * lvMult : 1,
      skillMult: eff.skillDamage ? 1 + (eff.skillDamage - 1) * lvMult : 1,
      hpRegen: eff.hpRegen ? Math.round(eff.hpRegen * lvMult) : 0,
    };
  }

  _resolveTrap(hero, cell) {
    if (!cell.trap) return { damage: 0, status: 'normal' };
    const trapDef = this._dataManager.getTrap(cell.trap.typeId);
    if (!trapDef) return { damage: 0, status: 'normal' };

    // Trait: trap_parry
    if (hero.trait && hero.trait.id === 'trap_parry') {
      if (Math.random() < hero.trait.chance) {
        return { damage: 0, status: 'parried' };
      }
    }
    // Trait: first_trap_skip
    if (hero.trait && hero.trait.id === 'first_trap_skip' && !hero.traitState.firstTrapUsed) {
      hero.traitState.firstTrapUsed = true;
      return { damage: 0, status: 'skipped' };
    }

    const level = cell.trap.level || 1;
    const levelEntry = trapDef.levels ? trapDef.levels.find(l => l.level === level) : null;
    const multiplier = levelEntry ? levelEntry.damageMultiplier : 1.0;
    const damage = Math.round(trapDef.baseDamage * multiplier);
    this._applyDamageToHero(hero, damage);

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

    return { damage, status: 'normal' };
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
      const maxHp = Math.round(baseHp * buffFlags.hpMult);
      cell.monster.maxHp = maxHp;
      cell.monster.currentHp = maxHp;
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
    hero.targetCellId = this._pickNextCell(hero);
    if (hero.targetCellId) {
      this.emit('heroMove', { hero, fromCellId: hero.currentCellId, toCellId: hero.targetCellId });
      return true;
    }
    this._heroDefeated(hero, hero.currentCellId);
    return false;
  }

  /**
   * Pick the next cell from the hero's pre-computed route.
   */
  _pickNextCell(hero) {
    if (hero.route && hero.routeIndex < hero.route.length - 1) {
      hero.routeIndex++;
      return hero.route[hero.routeIndex];
    }
    return null;
  }

  /**
   * Pre-compute a full route from portal to heart for a hero.
   * At fork nodes (cells with >1 connection), alternate based on hero index + battle count.
   * @param {number} heroIndex
   * @returns {string[]} Array of cellIds from portal to heart
   */
  _computeHeroRoute(heroIndex) {
    const grid = this._gameState.dungeonGrid;
    const portalCell = grid.find(c => c.type === 'portal');
    if (!portalCell) return [];

    const cellMap = new Map(grid.map(c => [c.id, c]));
    const route = [portalCell.id];
    let currentId = portalCell.id;

    const MAX_STEPS = 20;
    for (let step = 0; step < MAX_STEPS; step++) {
      const cell = cellMap.get(currentId);
      if (!cell || cell.type === 'heart') break;
      if (!cell.connections || cell.connections.length === 0) break;

      let nextId;
      if (cell.connections.length === 1) {
        nextId = cell.connections[0];
      } else {
        // Fork: alternate based on hero index + battle count for distribution
        const branchIndex = (heroIndex + this._battleCount) % cell.connections.length;
        nextId = cell.connections[branchIndex];
      }

      route.push(nextId);
      currentId = nextId;
    }

    return route;
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

    const normalPool = ['trainee_swordsman', 'light_archer', 'thief'];
    const fullPool = ['trainee_swordsman', 'light_archer', 'priest', 'fire_mage', 'holy_knight', 'thief'];
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
