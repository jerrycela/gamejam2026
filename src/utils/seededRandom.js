// src/utils/seededRandom.js
// Mulberry32 PRNG — deterministic random from integer seed

/**
 * Create a seeded PRNG function.
 * @param {number} seed - Integer seed
 * @returns {function(): number} Returns [0, 1) on each call
 */
export function createRng(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string into an integer seed.
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Get a deterministic random value for a specific cell property.
 * @param {number} mapSeed
 * @param {string} cellId
 * @param {string} axis - 'x' or 'y'
 * @returns {number} [0, 1)
 */
export function seededCellRandom(mapSeed, cellId, axis) {
  const seed = hashString(`${mapSeed}_${cellId}_${axis}`);
  const rng = createRng(seed);
  return rng();
}
