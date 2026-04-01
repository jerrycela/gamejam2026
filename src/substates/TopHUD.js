import { TOP_HUD_HEIGHT } from '../utils/constants.js';

export default class TopHUD {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    const { width } = scene.scale;

    this.container = scene.add.container(0, 0);

    // Background
    const bg = scene.add.rectangle(width / 2, TOP_HUD_HEIGHT / 2, width, TOP_HUD_HEIGHT, 0x2d2d4e, 0.9);
    this.container.add(bg);

    // Day counter (left)
    this.dayText = scene.add.text(16, TOP_HUD_HEIGHT / 2, `Day ${gameState.day}`, {
      fontSize: '18px', color: '#ffffff', fontFamily: 'sans-serif', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    this.container.add(this.dayText);

    // Gold (center)
    this.goldText = scene.add.text(width / 2, TOP_HUD_HEIGHT / 2, `${gameState.gold} G`, {
      fontSize: '16px', color: '#f1c40f', fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.container.add(this.goldText);

    // Draw button (right)
    const drawCost = gameState.getDrawCost();
    const costLabel = drawCost === 0 ? '免費' : `${drawCost}G`;
    this.drawBtn = scene.add.text(width - 16, TOP_HUD_HEIGHT / 2, `抽卡 [${costLabel}]`, {
      fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif',
      backgroundColor: '#8e44ad', padding: { x: 8, y: 4 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.container.add(this.drawBtn);

    // Draw button events
    this.drawBtn.on('pointerdown', () => {
      if (this._onDrawCallback) this._onDrawCallback();
    });
    this.drawBtn.on('pointerover', () => this.drawBtn.setAlpha(0.8));
    this.drawBtn.on('pointerout', () => this.drawBtn.setAlpha(1));
  }

  onDraw(callback) {
    this._onDrawCallback = callback;
  }

  update() {
    this.dayText.setText(`Day ${this.gameState.day}`);
    this.goldText.setText(`${this.gameState.gold} G`);
    const drawCost = this.gameState.getDrawCost();
    const costLabel = drawCost === 0 ? '免費' : `${drawCost}G`;
    this.drawBtn.setText(`抽卡 [${costLabel}]`);
    // Disable if not enough gold
    const canAfford = this.gameState.gold >= drawCost;
    this.drawBtn.setAlpha(canAfford ? 1 : 0.4);
    this.drawBtn.setInteractive(canAfford ? { useHandCursor: true } : false);
  }

  getContainer() {
    return this.container;
  }
}
