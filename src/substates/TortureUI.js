import Phaser from 'phaser';
import { TAB_BAR_HEIGHT, TORTURE_CONFIG } from '../utils/constants.js';
import sfx from '../utils/SFXManager.js';

const SLOT_RADIUS = 45;
const SLOT_GAP = 120;
const CHIP_RADIUS = 22;
const CHIP_GAP = 70;
const VISIBLE_CHIPS = 6;

const HERO_COLORS = {
  trainee_swordsman: 0x3498db,
  light_archer:      0x2ecc71,
  priest:            0xf39c12,
  fire_mage:         0xe74c3c,
  holy_knight:       0x9b59b6,
};

const HERO_LABELS = {
  trainee_swordsman: '劍',
  light_archer:      '弓',
  priest:            '神',
  fire_mage:         '火',
  holy_knight:       '聖',
};

export default class TortureUI {
  constructor(scene, gameState) {
    this._scene = scene;
    this._gameState = gameState;
    this._rootContainer = scene.add.container(0, 0);
    this._selectedPrisoner = null;
    this._stagingOffset = 0;
    this._pendingConversions = [];
    this._activeTimers = [];
  }

  getContainer() { return this._rootContainer; }

  rebuild() {
    this._rootContainer.removeAll(true);

    // Cancel pending toast timers from previous onShown()
    for (const timer of this._activeTimers) timer.remove();
    this._activeTimers = [];

    // Selective clear of _selectedPrisoner
    if (this._selectedPrisoner) {
      const inPrisoners = this._gameState.prisoners.includes(this._selectedPrisoner);
      const inSlots = this._gameState.tortureSlots.some(s => s.prisoner === this._selectedPrisoner);
      if (!inPrisoners && !inSlots) this._selectedPrisoner = null;
    }

    // Clamp staging offset
    const maxOffset = Math.max(0, this._gameState.prisoners.length - VISIBLE_CHIPS);
    this._stagingOffset = Math.max(0, Math.min(this._stagingOffset, maxOffset));

    const { width, height } = this._scene.scale;
    this._buildTitle(width);
    this._buildSlots(width, height);
    this._buildPrisonerStaging(width, height);
  }

  onShown() {
    if (this._pendingConversions.length === 0) return;
    const scene = this._scene;
    const { width } = scene.scale;

    this._pendingConversions.forEach((data, i) => {
      const timer = scene.time.delayedCall(i * 500, () => {
        const monsterLabel = data.monsterTypeId || '???';
        const toast = scene.add.text(width / 2, 130, `${monsterLabel} 轉化完成！`, {
          fontSize: '16px', color: '#f1c40f', fontFamily: 'serif', fontStyle: 'bold',
          backgroundColor: '#2d2d5e', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setDepth(2000);
        this._rootContainer.add(toast);

        scene.tweens.add({
          targets: toast,
          alpha: 0,
          y: toast.y - 30,
          duration: 1500,
          delay: 500,
          onComplete: () => { toast.destroy(); },
        });
      });
      this._activeTimers.push(timer);
    });
    this._pendingConversions = [];
  }

  onConversion(data) {
    this._pendingConversions.push(data);
  }

  onBattleEnd() {
    this.rebuild();
  }

  _buildTitle(width) {
    const title = this._scene.add.text(width / 2, 80, '刑求室', {
      fontSize: '26px', color: '#f1c40f', fontFamily: 'serif', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._rootContainer.add(title);
  }

  _buildSlots(width, height) {
    const centerX = width / 2;
    const centerY = height / 2 - 40;
    const slots = this._gameState.tortureSlots;

    const positions = [
      { x: centerX - SLOT_GAP / 2, y: centerY - SLOT_GAP / 2 },
      { x: centerX + SLOT_GAP / 2, y: centerY - SLOT_GAP / 2 },
      { x: centerX - SLOT_GAP / 2, y: centerY + SLOT_GAP / 2 },
      { x: centerX + SLOT_GAP / 2, y: centerY + SLOT_GAP / 2 },
    ];

    for (let i = 0; i < 4; i++) {
      const slot = slots[i];
      const pos = positions[i];
      const slotCont = this._scene.add.container(pos.x, pos.y);
      slotCont.setData('slotIndex', i);

      if (!slot.unlocked) {
        // Locked slot
        const circle = this._scene.add.arc(0, 0, SLOT_RADIUS, 0, 360, false, 0x333333, 0.8);
        const lockText = this._scene.add.text(0, -8, '🔒', {
          fontSize: '20px',
        }).setOrigin(0.5);
        const costText = this._scene.add.text(0, 16, `解鎖 ${slot.cost}G`, {
          fontSize: '13px', color: '#cccccc', fontFamily: 'monospace',
        }).setOrigin(0.5);

        const hitZone = this._scene.add.zone(0, 0, SLOT_RADIUS * 2, SLOT_RADIUS * 2).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => this._onSlotUnlock(i));

        slotCont.add([circle, lockText, costText, hitZone]);
      } else if (!slot.prisoner) {
        // Empty unlocked slot
        const border = this._scene.add.graphics();
        border.lineStyle(2, 0x666666, 0.6);
        border.strokeCircle(0, 0, SLOT_RADIUS);
        const emptyText = this._scene.add.text(0, 0, '空', {
          fontSize: '18px', color: '#9999bb', fontFamily: 'monospace',
        }).setOrigin(0.5);

        const hitZone = this._scene.add.zone(0, 0, SLOT_RADIUS * 2, SLOT_RADIUS * 2).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => this._onSlotTap(i));

        // Store border ref for failure flash
        slotCont.setData('border', border);
        slotCont.add([border, emptyText, hitZone]);
      } else {
        // Occupied slot
        const prisoner = slot.prisoner;
        const color = HERO_COLORS[prisoner.heroTypeId] || 0xffffff;
        const label = HERO_LABELS[prisoner.heroTypeId] || '?';

        const circle = this._scene.add.arc(0, 0, SLOT_RADIUS, 0, 360, false, 0x222244, 0.9);
        const letterText = this._scene.add.text(0, -6, label, {
          fontSize: '22px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        const progressText = this._scene.add.text(0, 20, `${slot.progress}/${slot.target}`, {
          fontSize: '13px', color: '#cccccc', fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Progress arc ring
        this._drawSlotProgress(slotCont, slot, color);

        slotCont.add([circle, letterText, progressText]);
      }

      this._rootContainer.add(slotCont);
    }
  }

  _drawSlotProgress(container, slot, color) {
    if (!slot.target || slot.target === 0) return;
    const progress = slot.progress / slot.target;
    const endAngle = -90 + progress * 360;
    const graphics = this._scene.add.graphics();
    graphics.lineStyle(4, color, 0.9);
    graphics.beginPath();
    graphics.arc(0, 0, SLOT_RADIUS + 4, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(endAngle), false);
    graphics.strokePath();
    container.add(graphics);
  }

  _buildPrisonerStaging(width, height) {
    const prisoners = this._gameState.prisoners;
    const stagingY = height - TAB_BAR_HEIGHT - 90;

    // Label
    const label = this._scene.add.text(width / 2, stagingY - 35, `俘虜 (${prisoners.length})`, {
      fontSize: '14px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this._rootContainer.add(label);

    if (prisoners.length === 0) {
      const emptyText = this._scene.add.text(width / 2, stagingY + 10, '尚無俘虜', {
        fontSize: '13px', color: '#9999bb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this._rootContainer.add(emptyText);
      return;
    }

    // Calculate visible range
    const visibleStart = this._stagingOffset;
    const visibleEnd = Math.min(visibleStart + VISIBLE_CHIPS, prisoners.length);
    const visibleCount = visibleEnd - visibleStart;

    // Center the chips
    const totalWidth = visibleCount * CHIP_GAP;
    const startX = (width - totalWidth) / 2 + CHIP_GAP / 2;

    // Left arrow
    if (this._stagingOffset > 0) {
      const leftArrow = this._scene.add.text(startX - CHIP_GAP / 2 - 10, stagingY, '<', {
        fontSize: '20px', color: '#aaaaff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      leftArrow.on('pointerdown', () => this._onStagingScroll(-1));
      this._rootContainer.add(leftArrow);
    }

    // Right arrow
    if (visibleEnd < prisoners.length) {
      const rightX = startX + (visibleCount - 1) * CHIP_GAP + CHIP_GAP / 2 + 10;
      const rightArrow = this._scene.add.text(rightX, stagingY, '>', {
        fontSize: '20px', color: '#aaaaff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      rightArrow.on('pointerdown', () => this._onStagingScroll(1));
      this._rootContainer.add(rightArrow);
    }

    // Prisoner chips
    for (let i = 0; i < visibleCount; i++) {
      const prisoner = prisoners[visibleStart + i];
      const chipX = startX + i * CHIP_GAP;
      const color = HERO_COLORS[prisoner.heroTypeId] || 0xffffff;
      const chipLabel = HERO_LABELS[prisoner.heroTypeId] || '?';
      const isSelected = this._selectedPrisoner === prisoner;

      // Chip circle (interactive for selection)
      const chipCircle = this._scene.add.arc(chipX, stagingY, CHIP_RADIUS, 0, 360, false, color, isSelected ? 1.0 : 0.6);
      chipCircle.setInteractive({ useHandCursor: true });
      chipCircle.on('pointerdown', () => this._onPrisonerTap(prisoner));

      // Selection border
      if (isSelected) {
        const selBorder = this._scene.add.graphics();
        selBorder.lineStyle(3, 0xf1c40f, 1);
        selBorder.strokeCircle(chipX, stagingY, CHIP_RADIUS + 3);
        this._rootContainer.add(selBorder);
      }

      // Letter
      const letterText = this._scene.add.text(chipX, stagingY - 2, chipLabel, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);

      // Extract button (separate interactive, stopPropagation)
      const extractBtn = this._scene.add.text(chipX, stagingY + CHIP_RADIUS + 14, '榨取', {
        fontSize: '11px', color: '#ff6666', fontFamily: 'monospace',
        backgroundColor: '#441111', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      extractBtn.on('pointerdown', (_pointer, _lx, _ly, event) => {
        event.stopPropagation();
        this._onExtract(prisoner);
      });

      this._rootContainer.add([chipCircle, letterText, extractBtn]);
    }
  }

  _onStagingScroll(delta) {
    const maxOffset = Math.max(0, this._gameState.prisoners.length - VISIBLE_CHIPS);
    this._stagingOffset = Math.max(0, Math.min(this._stagingOffset + delta, maxOffset));
    this.rebuild();
  }

  _onSlotUnlock(slotIndex) {
    const slot = this._gameState.tortureSlots[slotIndex];
    if (!slot || slot.unlocked) return;
    if (this._gameState.gold < slot.cost) return;
    this._gameState.unlockTortureSlot(slotIndex);
    this._scene.topHUD.update();
    this.rebuild();
  }

  _onPrisonerTap(prisoner) {
    if (this._selectedPrisoner === prisoner) {
      this._selectedPrisoner = null;
    } else {
      this._selectedPrisoner = prisoner;
    }
    this.rebuild();
  }

  _onSlotTap(slotIndex) {
    const slot = this._gameState.tortureSlots[slotIndex];
    if (!slot || !slot.unlocked || slot.prisoner) return;
    if (!this._selectedPrisoner) return;

    const success = this._gameState.assignPrisoner(slotIndex, this._selectedPrisoner);
    if (!success) {
      this._flashSlotError(slotIndex);
      this._selectedPrisoner = null;
      return;
    }
    this._selectedPrisoner = null;
    this.rebuild();
  }

  _flashSlotError(slotIndex) {
    const slotCont = this._rootContainer.list.find(
      (child) => child.type === 'Container' && child.getData('slotIndex') === slotIndex,
    );
    if (!slotCont) return;
    const border = slotCont.getData('border');
    if (!border) return;
    border.clear();
    border.lineStyle(3, 0xff3333, 1);
    border.strokeCircle(0, 0, SLOT_RADIUS);
    this._scene.time.delayedCall(400, () => {
      border.clear();
      border.lineStyle(2, 0x666666, 0.6);
      border.strokeCircle(0, 0, SLOT_RADIUS);
    });
  }

  _onExtract(prisoner) {
    this._gameState.extractPrisoner(prisoner);
    sfx.play('torture_convert');
    if (this._selectedPrisoner === prisoner) this._selectedPrisoner = null;
    this._scene.topHUD.update();
    this.rebuild();
  }
}
