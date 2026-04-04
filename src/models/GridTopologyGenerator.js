// GridTopologyGenerator.js
// Template-based dungeon grid topology for tower defense gameplay.
// Generates a single main path with optional split-merge branches.

import { seededCellRandom } from '../utils/seededRandom.js';

// Column X positions
const COL_X = { left: 82, center: 187, right: 292 };

// Row Y positions
const ROW_Y = [80, 220, 360, 500, 640, 780];

// --- Template Definitions ---
// connections: [sourceIndex, targetIndex] referencing flat cell array order
// colAssign: column for each cell in order ('left'|'center'|'right')

const TEMPLATE_A = {
  name: 'A_linear',
  rows: [1, 1, 1, 1, 1, 1],  // cells per row
  colAssign: ['center', 'center', 'center', 'center', 'center', 'center'],
  connections: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  forkNodes: [],
  mergeNodes: [],
};

const TEMPLATE_B = {
  name: 'B_single_fork_1row',
  rows: [1, 1, 2, 1, 1, 1],  // row 2 has 2 cells (fork)
  colAssign: ['center', 'center', 'left', 'right', 'center', 'center', 'center'],
  // cells: 0=portal, 1=pre-fork, 2=branch-L, 3=branch-R, 4=merge, 5=post-merge, 6=heart
  connections: [[0,1],[1,2],[1,3],[2,4],[3,4],[4,5],[5,6]],
  forkNodes: [1],
  mergeNodes: [4],
};

const TEMPLATE_C = {
  name: 'C_single_fork_2row',
  rows: [1, 1, 2, 2, 1, 1],  // rows 2-3 each have 2 cells
  colAssign: ['center', 'center', 'left', 'right', 'left', 'right', 'center', 'center'],
  // cells: 0=portal, 1=fork, 2=branch-L1, 3=branch-R1, 4=branch-L2, 5=branch-R2, 6=merge, 7=heart
  connections: [[0,1],[1,2],[1,3],[2,4],[3,5],[4,6],[5,6],[6,7]],
  forkNodes: [1],
  mergeNodes: [6],
};

const TEMPLATE_D = {
  name: 'D_double_fork',
  rows: [1, 2, 1, 2, 1, 1],  // rows 1 and 3 have 2 cells
  colAssign: ['center', 'left', 'right', 'center', 'left', 'right', 'center', 'center'],
  // cells: 0=portal/fork1, 1=branch1-L, 2=branch1-R, 3=merge1/fork2, 4=branch2-L, 5=branch2-R, 6=merge2, 7=heart
  connections: [[0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[4,6],[5,6],[6,7]],
  forkNodes: [0, 3],
  mergeNodes: [3, 6],
};

const TEMPLATES = [
  { template: TEMPLATE_A, weight: 10 },
  { template: TEMPLATE_B, weight: 40 },
  { template: TEMPLATE_C, weight: 30 },
  { template: TEMPLATE_D, weight: 20 },
];

export default class GridTopologyGenerator {
  /**
   * Generate a dungeon grid from a weighted random template.
   * @param {number} [mapSeed] - Optional seed for deterministic generation
   * @returns {{ cells: GridCell[], mapSeed: number, templateName: string }}
   */
  static generate(mapSeed) {
    if (mapSeed === undefined) {
      mapSeed = Math.floor(Math.random() * 2147483647);
    }

    const template = GridTopologyGenerator._selectTemplate(mapSeed);
    const mirror = GridTopologyGenerator._shouldMirror(mapSeed);
    const cells = GridTopologyGenerator._buildCells(template, mirror, mapSeed);

    return { cells, mapSeed, templateName: template.name };
  }

  static _selectTemplate(seed) {
    const totalWeight = TEMPLATES.reduce((s, t) => s + t.weight, 0);
    // Use seed to pick template deterministically
    let roll = (((seed * 1103515245 + 12345) >>> 0) / 4294967296) * totalWeight;
    for (const { template, weight } of TEMPLATES) {
      roll -= weight;
      if (roll <= 0) return template;
    }
    return TEMPLATES[0].template;
  }

  static _shouldMirror(seed) {
    return (((seed * 214013 + 2531011) >>> 0) / 4294967296) < 0.5;
  }

  static _buildCells(template, mirror, mapSeed) {
    const cells = [];
    let cellIndex = 0;
    let rowIndex = 0;

    for (const rowCount of template.rows) {
      for (let c = 0; c < rowCount; c++) {
        const colKey = template.colAssign[cellIndex];
        let col = colKey;

        // Apply mirror: swap left/right
        if (mirror && col === 'left') col = 'right';
        else if (mirror && col === 'right') col = 'left';

        const type = (rowIndex === 0) ? 'portal'
                   : (rowIndex === template.rows.length - 1) ? 'heart'
                   : 'normal';

        const logicalPos = { x: COL_X[col], y: ROW_Y[rowIndex] };

        // Compute visual jitter
        const jx = seededCellRandom(mapSeed, `cell_${cellIndex}`, 'x') * 16 - 8;
        const jy = seededCellRandom(mapSeed, `cell_${cellIndex}`, 'y') * 8 - 4;
        const visualPos = {
          x: logicalPos.x + jx,
          y: logicalPos.y + jy,
        };

        cells.push({
          id: `cell_${String(cellIndex).padStart(2, '0')}`,
          type,
          position: logicalPos,      // logicalPos (backward compat — used by hit-test)
          visualPos,                  // for rendering & hero movement
          connections: [],
          room: null,
          trap: null,
          monster: null,
        });

        cellIndex++;
      }
      rowIndex++;
    }

    // Wire connections
    for (const [srcIdx, dstIdx] of template.connections) {
      if (cells[srcIdx] && cells[dstIdx]) {
        cells[srcIdx].connections.push(cells[dstIdx].id);
      }
    }

    return cells;
  }
}
