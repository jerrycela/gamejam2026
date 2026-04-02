// HeroInstance.js
// Battle-scoped hero data object. NOT persisted across battles.

import { MOVE_DURATION } from '../utils/constants.js';

export default class HeroInstance {
  /**
   * @param {string} typeId - Hero definition id (e.g. 'trainee_swordsman')
   * @param {number} index - Spawn index, used for instanceId and wave stagger
   * @param {import('./DataManager.js').default} dataManager
   */
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
    // Normalize skill: only keep damage-type skills for auto-cast
    this.skill = (def.skill && (def.skill.damage || def.skill.healAmount)) ? { ...def.skill } : null;
    this.currentCellId = null;
    this.targetCellId = null;
    this.state = 'waiting'; // waiting | moving | fighting | waitingForCombat | dead | captured
    this.moveTimer = 0;
    this.attackTimer = 0;
    this.skillTimer = 0;
    this.waveDelay = index * 800; // ms stagger between hero spawns
    this.debuffs = [];
    this.trait = def.trait || null;
    this.traitState = {};
    if (this.trait && this.trait.id === 'first_trap_skip') {
      this.traitState.firstTrapUsed = false;
    }
    this.effectiveMoveDuration = MOVE_DURATION;
  }
}
