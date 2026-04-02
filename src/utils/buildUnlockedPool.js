/**
 * Build a pool of items filtered by unlock status.
 * @param {Array} allItems - Full dataset from DataManager (monsters/rooms/traps)
 * @param {string} type - 'monsters' | 'rooms' | 'traps'
 * @param {object} metaState - MetaState instance with unlockedMonsters/unlockedRooms/unlockedTraps
 * @returns {Array} Items that are unlocked
 */
export function buildUnlockedPool(allItems, type, metaState) {
  if (!metaState) return allItems;
  const unlockMap = {
    monsters: metaState.unlockedMonsters,
    rooms: metaState.unlockedRooms,
    traps: metaState.unlockedTraps,
  };
  const unlockedIds = unlockMap[type] || [];
  const filtered = allItems.filter(item => unlockedIds.includes(item.id));
  return filtered.length > 0 ? filtered : allItems;
}
