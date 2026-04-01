// Central constants shared across modules

export const EVENT_TYPES = {
  normalBattle: { weight: 30, label: '普通戰鬥', color: 0xc0392b },
  eliteBattle:  { weight: 15, label: '精英戰鬥', color: 0xe67e22 },
  bossBattle:   { weight: 5,  label: '地宮 Boss', color: 0x8e44ad },
  activity:     { weight: 25, label: '事件',      color: 0x27ae60 },
  treasure:     { weight: 15, label: '寶藏',      color: 0xf1c40f },
  shop:         { weight: 10, label: '商店',      color: 0x2980b9 },
};

// Star rating weights for CardPick random generation
export const STAR_WEIGHTS = [
  { star: 1, weight: 70 },
  { star: 2, weight: 25 },
  { star: 3, weight: 5 },
];

// Shared star rating roll using STAR_WEIGHTS
export function rollStarRating() {
  const totalWeight = STAR_WEIGHTS.reduce((a, b) => a + b.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const { star, weight } of STAR_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return star;
  }
  return 1;
}

// Card dimensions
export const CARD_WIDTH = 90;
export const CARD_HEIGHT = 120;
export const CARD_GAP = 10;
export const MATRIX_ROWS = 5;
export const MATRIX_COLS = 3;

// UI dimensions
export const TOP_HUD_HEIGHT = 48;
export const TAB_BAR_HEIGHT = 56;

// Torture chamber configuration (single source of truth)
export const TORTURE_CONFIG = {
  targets: { trainee_swordsman: 3, light_archer: 4, priest: 5, fire_mage: 5, holy_knight: 6 },
  extractGold: { trainee_swordsman: 50, light_archer: 75, priest: 100, fire_mage: 100, holy_knight: 125 },
  conversionMap: { trainee_swordsman: 'goblin', light_archer: 'bat_succubus', priest: 'frost_witch', fire_mage: 'rage_demon', holy_knight: 'skeleton_knight' },
};
