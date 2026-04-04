// GameState.js
// Holds all mutable state for a single dungeon run.
// Recreate this object at the start of every new run — do not reuse across runs.

import FlipMatrixGenerator from './FlipMatrixGenerator.js';
import GridTopologyGenerator from './GridTopologyGenerator.js';
import { TORTURE_CONFIG } from '../utils/constants.js';

export default class GameState {
  /**
   * @param {import('./MetaState.js').default} metaState
   * @param {import('./DataManager.js').default} dataManager
   */
  constructor(metaState, dataManager) {
    this._dataManager = dataManager;

    // --- Economy ---
    this.gold = 0;
    this.day = 1;
    this.glamour = 0;

    // --- Boss ---
    const bossStats = metaState.getBossStats();
    this.bossMaxHp = bossStats.maxHp;
    this.bossHp = bossStats.hp;
    this.bossAtk = bossStats.atk;

    // --- Hand / draw ---
    /** @type {object[]} Cards currently in the player's hand */
    this.hand = [];
    this.drawCount = 0; // number of draws made this run (used for escalating cost)

    // --- Combat stats ---
    this.killCount = 0; // total heroes slain this run

    // --- Final battle ---
    this.finalBattleTriggered = false;

    // --- Prisoners (captured heroes awaiting torture) ---
    /** @type {object[]} */
    this.prisoners = [];

    // --- Bestiary (per-run encounter tracking) ---
    /** @type {Object<string, {seen: number, killed: number}>} */
    this.heroEncounters = {};

    // --- Monster roster ---
    // One MonsterInstance per unlocked monster type at run start
    /** @type {MonsterInstance[]} */
    this.monsterRoster = metaState.unlockedMonsters.map((typeId, index) =>
      this.createMonsterInstance(typeId, 'initial', index)
    );

    // --- Dungeon map (populated later by the map generator) ---
    /** @type {object[]} Array of cell objects; structure defined by MapGenerator */
    const gridResult = GridTopologyGenerator.generate();
    this.dungeonGrid = gridResult.cells;
    this.mapSeed = gridResult.mapSeed; // for jitter reproducibility

    // --- Flip matrix (populated later during map setup) ---
    /** @type {any[]} */
    this.initFlipMatrix();

    // --- Torture chamber ---
    // 2 slots unlocked from the start; 2 more purchasable for gold
    this.tortureSlots = [
      { unlocked: true,  prisoner: null, progress: 0, target: 0 },
      { unlocked: true,  prisoner: null, progress: 0, target: 0 },
      { unlocked: false, cost: 500 },
      { unlocked: false, cost: 1000 }
    ];
  }

  // --- Monster management ---

  /**
   * Build a new MonsterInstance object.
   * @param {string} typeId
   * @param {'initial'|'converted'} source
   * @param {number} [index] - roster position used for instanceId generation
   * @returns {MonsterInstance}
   */
  createMonsterInstance(typeId, source = 'initial', index) {
    // Use current roster length as fallback index when not provided
    const idx = (index !== undefined) ? index : this.monsterRoster.length;
    return {
      instanceId: `m_${idx}`,
      typeId,
      source,
      buffFlags: {
        converted: false,
        hpMult: 1.0,
        atkMult: 1.0
      },
      placedCellId: null // null means the monster is in the reserve (not placed on the map)
    };
  }

  /**
   * Create a converted monster instance (e.g. from hero torture) and add it to the roster.
   * @param {string} typeId
   * @returns {MonsterInstance}
   */
  createConvertedMonster(typeId) {
    const instance = this.createMonsterInstance(typeId, 'converted');
    instance.buffFlags = { converted: true, hpMult: 1.15, atkMult: 1.15 };
    this.monsterRoster.push(instance);
    return instance;
  }

  /**
   * Return all monsters that have not yet been placed on the dungeon grid.
   * @returns {MonsterInstance[]}
   */
  getAvailableMonsters() {
    return this.monsterRoster.filter(m => m.placedCellId === null);
  }

  /**
   * Assign a monster to a dungeon cell.
   * @param {string} instanceId
   * @param {string} cellId
   */
  placeMonster(instanceId, cellId) {
    const monster = this.monsterRoster.find(m => m.instanceId === instanceId);
    if (!monster) {
      console.warn('[GameState] placeMonster: instanceId not found:', instanceId);
      return;
    }
    if (monster.placedCellId !== null && monster.placedCellId !== cellId) {
      console.warn('[GameState] placeMonster: monster already placed at', monster.placedCellId, '— remove first');
      return;
    }
    monster.placedCellId = cellId;
  }

  /**
   * Return a placed monster to the reserve (unplace without removing from roster).
   * @param {string} instanceId
   */
  removeMonster(instanceId) {
    const monster = this.monsterRoster.find(m => m.instanceId === instanceId);
    if (!monster) {
      console.warn('[GameState] removeMonster: instanceId not found:', instanceId);
      return;
    }
    monster.placedCellId = null;
  }

  // --- Cell management ---

  getCell(cellId) {
    return this.dungeonGrid.find(c => c.id === cellId);
  }

  setCellRoom(cellId, typeId, level) {
    const cell = this.getCell(cellId);
    if (!cell || cell.type !== 'normal') return;
    cell.room = { typeId, level };
  }

  setCellTrap(cellId, typeId, level) {
    const cell = this.getCell(cellId);
    if (!cell || cell.type !== 'normal') return;
    cell.trap = { typeId, level };
  }

  setCellMonster(cellId, instanceId, typeId) {
    // Atomic operation: if monster is already placed elsewhere, remove first
    const monster = this.monsterRoster.find(m => m.instanceId === instanceId);
    if (!monster) {
      console.warn('[GameState] setCellMonster: instanceId not found:', instanceId);
      return;
    }
    if (monster.placedCellId && monster.placedCellId !== cellId) {
      const oldCell = this.getCell(monster.placedCellId);
      if (oldCell) oldCell.monster = null;
      this.removeMonster(instanceId);
    }
    const cell = this.getCell(cellId);
    if (!cell || cell.type !== 'normal') return;
    // Remove existing monster on target cell (if different from the one being placed)
    if (cell.monster && cell.monster.instanceId !== instanceId) {
      this.removeMonster(cell.monster.instanceId);
    }
    const monsterDef = this._dataManager.getMonster(typeId);
    const baseHp = monsterDef ? monsterDef.baseHp : 100;
    const hpMult = (monster.buffFlags && monster.buffFlags.hpMult) || 1;
    cell.monster = { instanceId, typeId, currentHp: Math.round(baseHp * hpMult), maxHp: Math.round(baseHp * hpMult) };
    this.placeMonster(instanceId, cellId);
  }

  removeCellMonster(cellId) {
    const cell = this.getCell(cellId);
    if (!cell || !cell.monster) return;
    const { instanceId } = cell.monster;
    cell.monster = null;
    this.removeMonster(instanceId);
  }

  // --- Draw cost ---

  /**
   * Gold cost to draw the next card, based on how many draws have been made.
   * @returns {number}
   */
  getDrawCost() {
    return this._dataManager.getDrawCost(this.drawCount);
  }

  // --- Glamour ---

  /**
   * Recalculate total glamour by summing glamourValue * level for every room-bearing cell.
   * Expects dungeonGrid cells to have the shape: { room?: { typeId, level } }
   * @returns {number} the updated glamour total
   */
  recalcGlamour() {
    let total = 0;
    for (const cell of this.dungeonGrid) {
      if (!cell.room) continue;
      const roomDef = this._dataManager.getRoom(cell.room.typeId);
      if (!roomDef) continue;
      total += (roomDef.glamourValue ?? 0) * (cell.room.level ?? 1);
    }
    this.glamour = total;
    return total;
  }

  // --- Flip Matrix ---

  initFlipMatrix() {
    this.flipMatrix = FlipMatrixGenerator.generate(this.day, this.finalBattleTriggered);
  }

  flipCard(row, col) {
    const card = this.flipMatrix[row]?.[col];
    if (!card || card.flipped) return null;
    card.flipped = true;
    return card;
  }

  resolveCard(row, col) {
    const card = this.flipMatrix[row]?.[col];
    if (card) card.resolved = true;
  }

  isMatrixComplete() {
    for (const row of this.flipMatrix) {
      for (const card of row) {
        if (!card.resolved) return false;
      }
    }
    return true;
  }

  // --- Battle support ---

  /**
   * Advance torture progress by 1 for all occupied slots.
   * @returns {{ slot: object, prisoner: object }[]} completed conversions
   */
  advanceTortureProgress() {
    const completed = [];
    for (const slot of this.tortureSlots) {
      if (!slot.unlocked || !slot.prisoner) continue;
      slot.progress += 1;
      if (slot.progress >= slot.target) {
        completed.push({ slot, prisoner: slot.prisoner });
      }
    }
    return completed;
  }

  /**
   * Add a captured hero to the prisoner list.
   * @param {string} heroTypeId
   * @param {string} heroName
   */
  addPrisoner(heroTypeId, heroName) {
    this.prisoners.push({ heroTypeId, heroName, capturedDay: this.day });
  }

  unlockTortureSlot(slotIndex) {
    const slot = this.tortureSlots[slotIndex];
    if (!slot || slot.unlocked || this.gold < slot.cost) return false;
    this.gold -= slot.cost;
    this.tortureSlots[slotIndex] = { unlocked: true, prisoner: null, progress: 0, target: 0 };
    return true;
  }

  assignPrisoner(slotIndex, prisoner) {
    const slot = this.tortureSlots[slotIndex];
    if (!slot || !slot.unlocked || slot.prisoner) return false;
    const idx = this.prisoners.indexOf(prisoner);
    if (idx === -1) return false;
    slot.prisoner = prisoner;
    slot.target = TORTURE_CONFIG.targets[prisoner.heroTypeId] || 3;
    slot.progress = 0;
    this.prisoners.splice(idx, 1);
    return true;
  }

  extractPrisoner(prisoner) {
    const idx = this.prisoners.indexOf(prisoner);
    if (idx === -1) return 0;
    const gold = TORTURE_CONFIG.extractGold[prisoner.heroTypeId] || 50;
    this.gold += gold;
    this.prisoners.splice(idx, 1);
    return gold;
  }

  advanceDay() {
    this.day++;
    this.initFlipMatrix();
    console.log('[GameState] Advanced to day', this.day);
  }

  recordHeroSeen(typeId) {
    if (!this.heroEncounters[typeId]) this.heroEncounters[typeId] = { seen: 0, killed: 0 };
    this.heroEncounters[typeId].seen += 1;
  }

  recordHeroKilled(typeId) {
    if (!this.heroEncounters[typeId]) this.heroEncounters[typeId] = { seen: 0, killed: 0 };
    this.heroEncounters[typeId].killed += 1;
  }
}

/**
 * @typedef {object} MonsterInstance
 * @property {string} instanceId    - Unique id within this run (e.g. "m_0")
 * @property {string} typeId        - References a monster definition in DataManager
 * @property {'initial'|'converted'} source
 * @property {{ converted: boolean, hpMult: number, atkMult: number }} buffFlags
 * @property {string|null} placedCellId - Cell id on dungeonGrid, or null if in reserve
 */
