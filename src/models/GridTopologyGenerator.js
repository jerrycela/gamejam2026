// GridTopologyGenerator.js
// Generates a dungeon grid topology for a single run.
// Returns an array of GridCell objects with directed connections flowing portal → heart.

export default class GridTopologyGenerator {
  /**
   * Generate a fresh dungeon grid.
   * @returns {GridCell[]}
   */
  static generate() {
    const MAX_ATTEMPTS = 10;
    let result = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const grid = GridTopologyGenerator._buildGrid();
      if (GridTopologyGenerator._bfsReachable(grid)) {
        return grid;
      }
      result = grid;
    }

    // Return last attempt if BFS never passed
    console.warn('[GridTopologyGenerator] BFS validation failed after', MAX_ATTEMPTS, 'attempts — returning last attempt');
    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  static _buildGrid() {
    const cells = [];
    let idCounter = 0;

    const makeId = () => {
      const id = `cell_${String(idCounter).padStart(2, '0')}`;
      idCounter++;
      return id;
    };

    const makeCell = (type, x, y) => ({
      id: makeId(),
      type,
      position: { x, y },
      connections: [],
      room: null,
      trap: null,
      monster: null
    });

    // --- Row 0: portal ---
    const portalCell = makeCell('portal', 187, 60);
    cells.push(portalCell);
    const rows = [[portalCell]];

    // --- Rows 1-4: normal cells ---
    const ROW_Y = [260, 460, 660, 860];
    const middleRows = [];

    for (const y of ROW_Y) {
      const count = GridTopologyGenerator._randInt(2, 3);
      const rowCells = GridTopologyGenerator._makeRowCells(makeCell, count, y);
      middleRows.push(rowCells);
      cells.push(...rowCells);
      rows.push(rowCells);
    }

    // Guarantee total 9-12 normal cells; at least one row has 3 nodes.
    GridTopologyGenerator._enforceNodeCount(middleRows, cells, makeCell, ROW_Y);

    // --- Row 5: heart ---
    const heartCell = makeCell('heart', 187, 1060);
    cells.push(heartCell);
    rows.push([heartCell]);

    // --- Connections ---
    GridTopologyGenerator._buildConnections(rows);

    return cells;
  }

  /**
   * Create cells for a single middle row.
   * @param {Function} makeCell
   * @param {number} count - 2 or 3
   * @param {number} y
   * @returns {GridCell[]}
   */
  static _makeRowCells(makeCell, count, y) {
    const positions = count === 2
      ? [125, 250]
      : [93, 187, 281];

    return positions.map(baseX => {
      const jitter = GridTopologyGenerator._randJitter(30);
      return makeCell('normal', baseX + jitter, y);
    });
  }

  /**
   * Ensure the four middle rows have 9-12 nodes total with at least one 3-node row.
   * Mutates middleRows and cells in-place as needed.
   */
  static _enforceNodeCount(middleRows, cells, makeCell, rowY) {
    const total = () => middleRows.reduce((sum, r) => sum + r.length, 0);

    // Expand 2-node rows until total >= 9
    while (total() < 9) {
      // Pick a random 2-node row
      const candidates = middleRows.map((r, i) => i).filter(i => middleRows[i].length === 2);
      if (candidates.length === 0) break; // all rows already at 3
      const idx = candidates[GridTopologyGenerator._randInt(0, candidates.length - 1)];
      const y = rowY[idx];
      const newCell = makeCell('normal', 281 + GridTopologyGenerator._randJitter(30), y);
      middleRows[idx].push(newCell);
      cells.push(newCell);
    }

    // Guarantee at least one row has 3 nodes (may already be satisfied above)
    const hasThreeNode = middleRows.some(r => r.length === 3);
    if (!hasThreeNode) {
      const idx = GridTopologyGenerator._randInt(0, 3);
      const y = rowY[idx];
      const newCell = makeCell('normal', 281 + GridTopologyGenerator._randJitter(30), y);
      middleRows[idx].push(newCell);
      cells.push(newCell);
    }
  }

  /**
   * Build directed connections: each node in row N → 1-2 nodes in row N+1.
   * Then ensure every node in row N+1 has at least one incoming edge.
   * @param {GridCell[][]} rows
   */
  static _buildConnections(rows) {
    for (let n = 0; n < rows.length - 1; n++) {
      const current = rows[n];
      const next = rows[n + 1];

      // Each node in current row connects to 1-2 random nodes in next row
      for (const cell of current) {
        const maxOut = Math.min(2, next.length);
        const outCount = GridTopologyGenerator._randInt(1, maxOut);
        const targets = GridTopologyGenerator._sampleWithoutReplacement(next, outCount);
        for (const target of targets) {
          if (!cell.connections.includes(target.id)) {
            cell.connections.push(target.id);
          }
        }
      }

      // Ensure every node in next row has at least one incoming edge
      const reachable = new Set(current.flatMap(c => c.connections));
      for (const target of next) {
        if (!reachable.has(target.id)) {
          const source = current[GridTopologyGenerator._randInt(0, current.length - 1)];
          if (!source.connections.includes(target.id)) {
            source.connections.push(target.id);
          }
        }
      }
    }
  }

  /**
   * BFS from the portal cell to verify the heart cell is reachable.
   * @param {GridCell[]} cells
   * @returns {boolean}
   */
  static _bfsReachable(cells) {
    const portalCell = cells.find(c => c.type === 'portal');
    const heartCell = cells.find(c => c.type === 'heart');
    if (!portalCell || !heartCell) return false;

    const cellMap = new Map(cells.map(c => [c.id, c]));
    const visited = new Set();
    const queue = [portalCell.id];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === heartCell.id) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const cell = cellMap.get(currentId);
      if (!cell) continue;
      for (const nextId of cell.connections) {
        if (!visited.has(nextId)) {
          queue.push(nextId);
        }
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /** Random integer in [min, max] inclusive. */
  static _randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Random jitter in [-range, +range] (integer). */
  static _randJitter(range) {
    return Math.floor(Math.random() * (range * 2 + 1)) - range;
  }

  /**
   * Sample `count` unique items from `arr` without replacement.
   * @param {GridCell[]} arr
   * @param {number} count
   * @returns {GridCell[]}
   */
  static _sampleWithoutReplacement(arr, count) {
    const copy = arr.slice();
    const result = [];
    const n = Math.min(count, copy.length);
    for (let i = 0; i < n; i++) {
      const idx = GridTopologyGenerator._randInt(0, copy.length - 1);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }
}

/**
 * @typedef {object} GridCell
 * @property {string} id                 - Unique id, e.g. 'cell_00'
 * @property {'normal'|'portal'|'heart'} type
 * @property {{ x: number, y: number }} position  - Logical map-world coordinates
 * @property {string[]} connections      - Directed edges (downstream, toward heart)
 * @property {object|null} room
 * @property {object|null} trap
 * @property {object|null} monster
 */
