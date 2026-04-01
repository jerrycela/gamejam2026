import { rollStarRating } from '../utils/constants.js';

export default class CardPickUI {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.container = null; // Will be set externally (the existing cardPick container)
    this._onCompleteCallback = null;
  }

  // Set the container reference (GameScene's containers.cardPick)
  setContainer(container) {
    this.container = container;
  }

  // Open the card pick modal
  open(request, onComplete) {
    if (!this.container) return;
    this._onCompleteCallback = onComplete;

    // Clear previous content
    this.container.removeAll(true);

    const { width, height } = this.scene.scale;

    // Semi-transparent overlay
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.container.add(overlay);

    // Title
    const titleText = request.source === 'paidDraw' ? '抽卡' : '獎勵';
    const title = this.scene.add.text(width / 2, height / 4, titleText, {
      fontSize: '28px', color: '#f1c40f', fontFamily: 'serif'
    }).setOrigin(0.5);
    this.container.add(title);

    // Generate 3 options if not provided
    const options = request.options || this._generateOptions();

    // Display 3 cards
    const cardW = 100;
    const cardH = 150;
    const gap = 16;
    const totalW = cardW * 3 + gap * 2;
    const startX = (width - totalW) / 2 + cardW / 2;
    const centerY = height / 2;

    options.forEach((option, i) => {
      const x = startX + i * (cardW + gap);

      const cardBg = this.scene.add.rectangle(x, centerY, cardW, cardH, 0x34495e)
        .setStrokeStyle(2, 0xf1c40f)
        .setInteractive({ useHandCursor: true });

      const typeName = option.type === 'room' ? '房間' : '陷阱';
      // Look up display name from DataManager
      const dataManager = this.scene.registry.get('dataManager');
      let displayName = option.id;
      if (option.type === 'room') {
        const def = dataManager.getRoom(option.id);
        if (def) displayName = def.name;
      } else {
        const def = dataManager.getTrap(option.id);
        if (def) displayName = def.name;
      }

      const nameText = this.scene.add.text(x, centerY - 30, displayName, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif'
      }).setOrigin(0.5);

      const typeText = this.scene.add.text(x, centerY, typeName, {
        fontSize: '12px', color: '#bbbbbb', fontFamily: 'monospace'
      }).setOrigin(0.5);

      const starText = this.scene.add.text(x, centerY + 30, '★'.repeat(option.starRating), {
        fontSize: '16px', color: '#f1c40f', fontFamily: 'serif'
      }).setOrigin(0.5);

      cardBg.on('pointerdown', () => {
        this.gameState.hand.push(option);
        console.log('[CardPickUI] Selected:', option);
        this._close();
      });

      cardBg.on('pointerover', () => cardBg.setStrokeStyle(3, 0xffffff));
      cardBg.on('pointerout', () => cardBg.setStrokeStyle(2, 0xf1c40f));

      this.container.add([cardBg, nameText, typeText, starText]);
    });

    // Skip button
    const skipBtn = this.scene.add.text(width - 20, height / 4, '跳過', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'sans-serif',
      backgroundColor: '#333333', padding: { x: 12, y: 6 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    skipBtn.on('pointerdown', () => {
      console.log('[CardPickUI] Skipped');
      this._close();
    });

    this.container.add(skipBtn);

    // Show container
    this.container.setVisible(true);
    this.container.setDepth(2000);
  }

  _close() {
    this.container.setVisible(false);
    this.container.removeAll(true);
    if (this._onCompleteCallback) {
      this._onCompleteCallback();
      this._onCompleteCallback = null;
    }
  }

  _generateOptions() {
    const dataManager = this.scene.registry.get('dataManager');
    const pool = [
      ...dataManager.rooms.map(r => ({ type: 'room', id: r.id })),
      ...dataManager.traps.map(t => ({ type: 'trap', id: t.id })),
    ];
    // Fisher-Yates shuffle to avoid duplicate picks
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3).map(pick => ({ ...pick, starRating: rollStarRating() }));
  }
}
