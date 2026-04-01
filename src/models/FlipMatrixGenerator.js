import { EVENT_TYPES, MATRIX_ROWS, MATRIX_COLS, FINAL_BATTLE_INJECTION } from '../utils/constants.js';

export default class FlipMatrixGenerator {
  // Generate a 5x3 matrix of FlipCards with weighted random event types
  static generate(day = 1, finalBattleTriggered = false) {
    const cards = FlipMatrixGenerator._generateEventTypes(MATRIX_ROWS * MATRIX_COLS);
    const matrix = [];
    let idx = 0;
    for (let row = 0; row < MATRIX_ROWS; row++) {
      const rowArr = [];
      for (let col = 0; col < MATRIX_COLS; col++) {
        rowArr.push({
          row,
          col,
          eventType: cards[idx++],
          flipped: false,
          resolved: false,
        });
      }
      matrix.push(rowArr);
    }

    // Inject final battle card if conditions are met
    FlipMatrixGenerator._injectFinalBattle(matrix, day, finalBattleTriggered);

    return matrix;
  }

  // Inject a face-up finalBattle card into the matrix based on day probability
  static _injectFinalBattle(matrix, day, finalBattleTriggered) {
    const { minDay, baseProb, probPerDay, maxProb } = FINAL_BATTLE_INJECTION;
    if (day < minDay || finalBattleTriggered) return;

    const prob = Math.min(baseProb + (day - minDay) * probPerDay, maxProb);
    if (Math.random() >= prob) return;

    // Find replaceable cards (non-battle types preferred)
    const candidates = [];
    for (const row of matrix) {
      for (const card of row) {
        if (!['normalBattle', 'eliteBattle', 'bossBattle', 'finalBattle'].includes(card.eventType)) {
          candidates.push(card);
        }
      }
    }
    // Fallback: if all cards are battles, replace the last one
    const target = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : matrix[MATRIX_ROWS - 1][MATRIX_COLS - 1];

    target.eventType = 'finalBattle';
    target.flipped = true;    // face-up: player can see it
    target.resolved = false;  // not yet triggered
  }

  // Weighted random selection of event types
  // Boss rule: max 1 per day, excess converted to eliteBattle
  static _generateEventTypes(count) {
    const types = Object.keys(EVENT_TYPES);
    const weights = types.map(t => EVENT_TYPES[t].weight);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const result = [];
    let bossCount = 0;

    for (let i = 0; i < count; i++) {
      let roll = Math.random() * totalWeight;
      let picked = types[0];
      for (let j = 0; j < types.length; j++) {
        roll -= weights[j];
        if (roll <= 0) {
          picked = types[j];
          break;
        }
      }
      // Boss limit: max 1 per day
      if (picked === 'bossBattle') {
        bossCount++;
        if (bossCount > 1) {
          picked = 'eliteBattle';
        }
      }
      result.push(picked);
    }

    // Shuffle to avoid boss always being early
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }
}
