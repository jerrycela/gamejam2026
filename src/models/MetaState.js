// MetaState.js
// Manages persistent cross-run progress stored in localStorage.
// Key: 'dungeon_lord_meta'  |  Current schema version: 2

const STORAGE_KEY = 'dungeon_lord_meta';
const CURRENT_VERSION = 2;

/** Default seed used for a fresh save and as the source of missing fields during migration. */
const DEFAULT_META = {
  version: 2,
  bossLevel: 1,
  totalRuns: 0,
  metaGold: 0,
  unlockedMonsters: ['skeleton_knight', 'goblin'],
  unlockedRooms: ['dungeon', 'training'],
  unlockedTraps: ['arrow', 'boulder'],
  bestiary: {
    heroes: {},
    monsters: {}
  }
};

export default class MetaState {
  constructor() {
    // Active in-memory copy — call load() to populate from storage
    this.version = DEFAULT_META.version;
    this.bossLevel = DEFAULT_META.bossLevel;
    this.totalRuns = DEFAULT_META.totalRuns;
    this.metaGold = DEFAULT_META.metaGold;
    this.unlockedMonsters = [...DEFAULT_META.unlockedMonsters];
    this.unlockedRooms = [...DEFAULT_META.unlockedRooms];
    this.unlockedTraps = [...DEFAULT_META.unlockedTraps];
    this.bestiary = { heroes: {}, monsters: {} };
    this._runFinalized = false;
  }

  // --- Persistence ---

  /** Load from localStorage, applying migration if the saved version is older. */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // No save found — start from defaults (already set in constructor)
        return;
      }

      let saved;
      try {
        saved = JSON.parse(raw);
      } catch (e) {
        console.warn('[MetaState] Corrupt save data, resetting.', e);
        this.reset();
        return;
      }

      // Migration: fill in any keys present in DEFAULT_META but absent in the saved data.
      // We never delete existing keys so user progress is preserved.
      if (!saved.version || saved.version < CURRENT_VERSION) {
        saved = this._migrate(saved);
      }

      // Copy all fields from the (possibly migrated) save onto this instance
      Object.assign(this, saved);

      // Validate numeric fields regardless of version
      if (!Number.isFinite(this.metaGold)) this.metaGold = 0;
      this.metaGold = Math.max(0, this.metaGold);
      if (!Number.isFinite(this.bossLevel)) this.bossLevel = DEFAULT_META.bossLevel;
      if (!Number.isFinite(this.totalRuns)) this.totalRuns = DEFAULT_META.totalRuns;

      // Validate array fields — fall back to defaults if corrupted
      const arrayFields = ['unlockedMonsters', 'unlockedRooms', 'unlockedTraps'];
      for (const field of arrayFields) {
        if (!Array.isArray(saved[field])) {
          saved[field] = [...DEFAULT_META[field]];
        }
      }

      // Deep-copy arrays to avoid shared references with the parsed object
      this.unlockedMonsters = [...saved.unlockedMonsters];
      this.unlockedRooms = [...saved.unlockedRooms];
      this.unlockedTraps = [...saved.unlockedTraps];
      this.bestiary = {
        heroes: { ...(saved.bestiary?.heroes ?? {}) },
        monsters: { ...(saved.bestiary?.monsters ?? {}) }
      };

      console.log('[MetaState] Loaded — bossLevel:', this.bossLevel, 'totalRuns:', this.totalRuns);
    } catch (e) {
      console.warn('[MetaState] Failed to load save data, resetting.', e);
      this.reset();
    }
  }

  /** Persist current in-memory state to localStorage. */
  save() {
    const payload = {
      version: this.version,
      bossLevel: this.bossLevel,
      totalRuns: this.totalRuns,
      metaGold: this.metaGold,
      unlockedMonsters: [...this.unlockedMonsters],
      unlockedRooms: [...this.unlockedRooms],
      unlockedTraps: [...this.unlockedTraps],
      bestiary: {
        heroes: { ...this.bestiary.heroes },
        monsters: { ...this.bestiary.monsters }
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  /** Wipe localStorage and restore in-memory state to defaults. */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.version = DEFAULT_META.version;
    this.bossLevel = DEFAULT_META.bossLevel;
    this.totalRuns = DEFAULT_META.totalRuns;
    this.metaGold = DEFAULT_META.metaGold;
    this.unlockedMonsters = [...DEFAULT_META.unlockedMonsters];
    this.unlockedRooms = [...DEFAULT_META.unlockedRooms];
    this.unlockedTraps = [...DEFAULT_META.unlockedTraps];
    this.bestiary = { heroes: {}, monsters: {} };
    console.log('[MetaState] Reset to defaults.');
  }

  // --- Boss stats ---

  /**
   * Derive the boss's current stat block from bossLevel.
   * @returns {{ maxHp: number, hp: number, atk: number, skillCd: number }}
   */
  getBossStats() {
    const maxHp = 100 + (this.bossLevel - 1) * 20;
    const atk = 15 + (this.bossLevel - 1) * 5;
    const skillCd = Math.max(10 - this.bossLevel * 0.5, 5);
    return { maxHp, hp: maxHp, atk, skillCd };
  }

  // --- Run lifecycle ---

  /**
   * Call at the end of each run.
   * Increments totalRuns; increments bossLevel only on victory.
   * @param {boolean} victory
   */
  recordRunEnd(victory) {
    this.totalRuns += 1;
    if (victory) {
      this.bossLevel += 1;
    }
    this.save();
    console.log('[MetaState] Run ended. Victory:', victory, '| bossLevel:', this.bossLevel, '| totalRuns:', this.totalRuns);
  }

  beginRun() {
    this._runFinalized = false;
  }

  finalizeRun(gameState, victory) {
    if (this._runFinalized) return;
    this.recordRunEnd(victory);
    this.addMetaGold(gameState.gold);
    this._runFinalized = true;
  }

  // --- MetaGold ---

  addMetaGold(amount) {
    this.metaGold += amount;
    this.save();
  }

  spendMetaGold(amount) {
    if (this.metaGold < amount) return false;
    this.metaGold -= amount;
    this.save();
    return true;
  }

  purchaseUnlock(type, id, cost) {
    if (this.metaGold < cost) return false;
    const arrayMap = {
      monsters: 'unlockedMonsters',
      rooms: 'unlockedRooms',
      traps: 'unlockedTraps'
    };
    const key = arrayMap[type];
    if (!key || this[key].includes(id)) return false;
    this.metaGold -= cost;
    this[key].push(id);
    this.save();
    return true;
  }

  // --- Content unlocking ---

  /**
   * Add an id to one of the unlocked arrays (no duplicates).
   * @param {'monsters'|'rooms'|'traps'} type
   * @param {string} id
   */
  unlockContent(type, id) {
    const arrayMap = {
      monsters: 'unlockedMonsters',
      rooms: 'unlockedRooms',
      traps: 'unlockedTraps'
    };
    const key = arrayMap[type];
    if (!key) {
      console.warn('[MetaState] unlockContent: unknown type', type);
      return;
    }
    if (!this[key].includes(id)) {
      this[key].push(id);
      this.save();
      console.log('[MetaState] Unlocked', type, id);
    }
  }

  // --- Private helpers ---

  /**
   * Forward-migrate an older save by merging missing keys from DEFAULT_META.
   * @param {object} saved
   * @returns {object} migrated save object
   */
  _migrate(saved) {
    console.log('[MetaState] Migrating save from version', saved.version, '->', CURRENT_VERSION);
    const migrated = { ...saved };

    // Ensure every top-level key from the default exists
    for (const key of Object.keys(DEFAULT_META)) {
      if (!(key in migrated)) {
        migrated[key] = Array.isArray(DEFAULT_META[key])
          ? [...DEFAULT_META[key]]
          : DEFAULT_META[key];
      }
    }

    // v1 -> v2: add metaGold
    if (!saved.version || saved.version < 2) {
      if (!Number.isFinite(migrated.metaGold)) migrated.metaGold = 0;
      migrated.metaGold = Math.max(0, migrated.metaGold);
    }

    // Validate numeric fields
    if (!Number.isFinite(migrated.bossLevel)) migrated.bossLevel = DEFAULT_META.bossLevel;
    if (!Number.isFinite(migrated.totalRuns)) migrated.totalRuns = DEFAULT_META.totalRuns;
    if (!Number.isFinite(migrated.metaGold)) migrated.metaGold = 0;
    migrated.metaGold = Math.max(0, migrated.metaGold);

    // Ensure bestiary sub-keys exist
    if (!migrated.bestiary) migrated.bestiary = { heroes: {}, monsters: {} };
    if (!migrated.bestiary.heroes) migrated.bestiary.heroes = {};
    if (!migrated.bestiary.monsters) migrated.bestiary.monsters = {};

    migrated.version = CURRENT_VERSION;
    return migrated;
  }
}
