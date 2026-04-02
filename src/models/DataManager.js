// DataManager.js
// Responsible for loading and querying all static JSON data via Phaser's asset cache.

export default class DataManager {
  constructor() {
    this.monsters = [];
    this.heroes = [];
    this.rooms = [];
    this.traps = [];
    this.drawCosts = [];
    this._loaded = false;
  }

  // Call in Phaser's preload() — registers JSON assets for loading
  registerPreload(scene) {
    scene.load.json('data_monsters', 'src/data/monsters.json');
    scene.load.json('data_heroes', 'src/data/heroes.json');
    scene.load.json('data_rooms', 'src/data/rooms.json');
    scene.load.json('data_traps', 'src/data/traps.json');
    scene.load.json('data_drawCosts', 'src/data/drawCosts.json');
    scene.load.json('data_unlockShop', 'src/data/unlockShop.json');
  }

  // Call in Phaser's create() — pulls loaded data out of cache into instance arrays
  initialize(scene) {
    this.monsters = scene.cache.json.get('data_monsters');
    this.heroes = scene.cache.json.get('data_heroes');
    this.rooms = scene.cache.json.get('data_rooms');
    this.traps = scene.cache.json.get('data_traps');
    this.drawCosts = scene.cache.json.get('data_drawCosts');
    this.unlockShop = scene.cache.json.get('data_unlockShop') || [];
    this._loaded = true;
    console.log('[DataManager] Loaded:', {
      monsters: this.monsters.length,
      heroes: this.heroes.length,
      rooms: this.rooms.length,
      traps: this.traps.length,
      drawCosts: this.drawCosts.length
    });
  }

  // --- Lookup helpers ---

  getMonster(id) {
    return this.monsters.find(m => m.id === id);
  }

  getHero(id) {
    return this.heroes.find(h => h.id === id);
  }

  getRoom(id) {
    return this.rooms.find(r => r.id === id);
  }

  getTrap(id) {
    return this.traps.find(t => t.id === id);
  }

  // drawIndex is clamped to the last entry so the cost never goes undefined
  getDrawCost(drawIndex) {
    return this.drawCosts[Math.min(drawIndex, this.drawCosts.length - 1)];
  }

  getUnlockShopItems() {
    return this.unlockShop;
  }

  lookupName(type, id) {
    const allArrays = { monsters: this.monsters, rooms: this.rooms, traps: this.traps };
    const arr = allArrays[type];
    if (!arr) return id;
    const found = arr.find(item => item.id === id);
    return found ? found.name : id;
  }
}
