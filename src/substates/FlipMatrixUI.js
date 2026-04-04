import { EVENT_TYPES, CARD_WIDTH, CARD_HEIGHT, CARD_GAP, MATRIX_ROWS, MATRIX_COLS, TOP_HUD_HEIGHT } from '../utils/constants.js';

const EVENT_ICONS = {
  normalBattle: '\u2694\uFE0F',
  eliteBattle:  '\u2B50',
  bossBattle:   '\u265B',
  activity:     '\u2604\uFE0F',
  treasure:     '\u2728',
  shop:         '\u2696\uFE0F',
  finalBattle:  '\u2694\uFE0F',
};

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

        const card = this.gameState.flipMatrix[row][col];
        const isFaceUp = card.flipped && !card.resolved && card.eventType === 'finalBattle';
        const eventDef = EVENT_TYPES[card.eventType];

        // Card background
        const bgColor = isFaceUp ? eventDef.color : 0x2d2d4e;
        const strokeColor = isFaceUp ? 0xffffff : 0x555577;
        const strokeWidth = isFaceUp ? 2 : 1;
        const bg = this.scene.add.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, bgColor)
          .setStrokeStyle(strokeWidth, strokeColor)
          .setInteractive({ useHandCursor: true });

        // Label
        const labelText = isFaceUp ? eventDef.label : '?';
        const labelStyle = isFaceUp
          ? { fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif' }
          : { fontSize: '28px', color: '#7777aa', fontFamily: 'serif' };
        const labelY = isFaceUp ? y + 10 : y;
        const label = this.scene.add.text(x, labelY, labelText, labelStyle).setOrigin(0.5);

        bg.on('pointerdown', () => this._handleTap(row, col));

        this.container.add([bg, label]);

        if (isFaceUp) {
          const icon = this.scene.add.text(x, y - 15, EVENT_ICONS[card.eventType] || '', {
            fontSize: '24px',
          }).setOrigin(0.5);
          this.container.add(icon);
        }

        rowArr.push({ bg, label, x, y });
      }
      this.cardObjects.push(rowArr);
    }
  }

  _handleTap(row, col) {
    if (this._isProcessing) return;

    const matrixCard = this.gameState.flipMatrix[row][col];

    // Special case: face-up finalBattle card (not yet resolved)
    // Don't resolveCard here — FlipEventHandler._endRun handles run termination
    if (matrixCard.flipped && !matrixCard.resolved && matrixCard.eventType === 'finalBattle') {
      this._isProcessing = true;
      if (this._onFlipCallback) {
        this._onFlipCallback(matrixCard, () => {
          this._isProcessing = false;
        });
      } else {
        this._isProcessing = false;
      }
      return;
    }

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
        obj.label.setY(obj.y + 10);
        obj.bg.disableInteractive();

        // Add event icon
        const iconText = EVENT_ICONS[card.eventType] || '';
        const icon = this.scene.add.text(obj.x, obj.y - 15, iconText, {
          fontSize: '24px',
        }).setOrigin(0.5);
        icon.scaleX = 0; // Start scaled to 0 for flip animation
        this.container.add(icon);

        // Phase 2: scaleX 0->1 (150ms)
        this.scene.tweens.add({
          targets: [obj.bg, obj.label, icon],
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
