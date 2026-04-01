import { EVENT_TYPES, CARD_WIDTH, CARD_HEIGHT, CARD_GAP, MATRIX_ROWS, MATRIX_COLS, TOP_HUD_HEIGHT } from '../utils/constants.js';

export default class FlipMatrixUI {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this._isProcessing = false;
    this._onFlipCallback = null;
    this.cardObjects = []; // 2D array of { bg, label, ... }

    this.container = scene.add.container(0, 0);
    this._buildMatrix();
  }

  onFlip(callback) {
    this._onFlipCallback = callback;
  }

  _buildMatrix() {
    const { width } = this.scene.scale;
    const totalW = CARD_WIDTH * MATRIX_COLS + CARD_GAP * (MATRIX_COLS - 1);
    const startX = (width - totalW) / 2 + CARD_WIDTH / 2;
    const startY = TOP_HUD_HEIGHT + 20 + CARD_HEIGHT / 2;

    this.cardObjects = [];

    for (let row = 0; row < MATRIX_ROWS; row++) {
      const rowArr = [];
      for (let col = 0; col < MATRIX_COLS; col++) {
        const x = startX + col * (CARD_WIDTH + CARD_GAP);
        const y = startY + row * (CARD_HEIGHT + CARD_GAP);

        // Card background
        const bg = this.scene.add.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0x2d2d4e)
          .setStrokeStyle(1, 0x555577)
          .setInteractive({ useHandCursor: true });

        // Face-down label
        const label = this.scene.add.text(x, y, '?', {
          fontSize: '28px', color: '#555577', fontFamily: 'serif'
        }).setOrigin(0.5);

        bg.on('pointerdown', () => this._handleTap(row, col));

        this.container.add([bg, label]);
        rowArr.push({ bg, label, x, y });
      }
      this.cardObjects.push(rowArr);
    }
  }

  _handleTap(row, col) {
    if (this._isProcessing) return;

    const card = this.gameState.flipCard(row, col);
    if (!card) return; // already flipped

    this._isProcessing = true;
    this._playFlipAnimation(row, col, card);
  }

  _playFlipAnimation(row, col, card) {
    const obj = this.cardObjects[row][col];
    const eventDef = EVENT_TYPES[card.eventType];

    // Phase 1: scaleX 1->0 (150ms)
    this.scene.tweens.add({
      targets: [obj.bg, obj.label],
      scaleX: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Change visuals to face-up
        obj.bg.setFillStyle(eventDef.color);
        obj.bg.setStrokeStyle(2, 0xffffff);
        obj.label.setText(eventDef.label);
        obj.label.setStyle({ fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif' });
        obj.bg.disableInteractive();

        // Phase 2: scaleX 0->1 (150ms)
        this.scene.tweens.add({
          targets: [obj.bg, obj.label],
          scaleX: 1,
          duration: 150,
          ease: 'Quad.easeOut',
          onComplete: () => {
            // Notify event handler
            if (this._onFlipCallback) {
              this._onFlipCallback(card, () => {
                // Unlock callback — called when event is fully resolved
                this._isProcessing = false;
              });
            } else {
              this._isProcessing = false;
            }
          }
        });
      }
    });

    // Slight y float during flip
    this.scene.tweens.add({
      targets: [obj.bg, obj.label],
      y: obj.y - 4,
      duration: 150,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
  }

  // Rebuild matrix visuals for a new day
  rebuild() {
    this.container.removeAll(true);
    this._buildMatrix();
  }

  getContainer() {
    return this.container;
  }
}
