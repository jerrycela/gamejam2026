import { TOP_HUD_HEIGHT, FONT_FAMILY } from '../utils/constants.js';
import SpriteHelper from '../utils/SpriteHelper.js';

const ROW_HEIGHT_COMPACT = 72;
const ROW_HEIGHT_LARGE = 110;
const MAX_VISIBLE = 8;

const STATUS_COLORS = {
  deployed: { bg: 0x444466, text: '#9999bb', label: '已部署' },
  standby:  { bg: 0x224422, text: '#66cc66', label: '待命' },
};

export default class MonsterListUI {
  constructor(scene, gameState, dataManager) {
    this._scene = scene;
    this._gameState = gameState;
    this._dataManager = dataManager;
    this._rootContainer = scene.add.container(0, 0);
  }

  getContainer() { return this._rootContainer; }

  rebuild() {
    this._rootContainer.removeAll(true);

    const { width } = this._scene.scale;
    const roster = this._gameState.monsterRoster;

    this._buildTitle(width, roster.length);

    if (roster.length === 0) {
      const empty = this._scene.add.text(width / 2, 160, '尚無怪物', {
        fontSize: '14px', color: '#9999bb', fontFamily: FONT_FAMILY,
      }).setOrigin(0.5);
      this._rootContainer.add(empty);
      return;
    }

    const rowH = roster.length <= 4 ? ROW_HEIGHT_LARGE : ROW_HEIGHT_COMPACT;
    const startY = TOP_HUD_HEIGHT + 60;
    const visible = roster.slice(0, MAX_VISIBLE);

    for (let i = 0; i < visible.length; i++) {
      this._buildRow(visible[i], width, startY + i * rowH, rowH);
    }

    if (roster.length > MAX_VISIBLE) {
      const more = this._scene.add.text(width / 2, startY + MAX_VISIBLE * rowH, `+${roster.length - MAX_VISIBLE} ...`, {
        fontSize: '12px', color: '#aaaacc', fontFamily: FONT_FAMILY,
      }).setOrigin(0.5);
      this._rootContainer.add(more);
    }
  }

  _buildTitle(width, count) {
    const title = this._scene.add.text(width / 2, TOP_HUD_HEIGHT + 20, `怪物名冊 (${count})`, {
      fontSize: '22px', color: '#f1c40f', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._rootContainer.add(title);
  }

  _buildRow(instance, width, y, rowH = ROW_HEIGHT_COMPACT) {
    const monsterDef = this._dataManager.getMonster(instance.typeId);
    const name = monsterDef ? monsterDef.name : instance.typeId;
    const baseHp = monsterDef ? monsterDef.baseHp : 100;
    const baseAtk = monsterDef ? monsterDef.baseAtk : 10;
    const displayHp = Math.round(baseHp * (instance.buffFlags.hpMult || 1));
    const displayAtk = Math.round(baseAtk * (instance.buffFlags.atkMult || 1));
    const isDeployed = instance.placedCellId !== null;
    const status = isDeployed ? STATUS_COLORS.deployed : STATUS_COLORS.standby;

    const isLarge = rowH >= ROW_HEIGHT_LARGE;
    const spriteSize = isLarge ? 52 : 32;

    // Row background
    const rowBg = this._scene.add.rectangle(width / 2, y, width - 20, rowH - 4, 0x1a1a2e, 0.8)
      .setStrokeStyle(1, 0x333355);

    // Monster sprite icon (left side)
    const spriteX = isLarge ? 46 : 36;
    const spriteIcon = SpriteHelper.createSprite(this._scene, `monster_${instance.typeId}`, spriteX, y, spriteSize);

    // Monster name (left)
    const textX = isLarge ? 80 : 56;
    const nameOffset = isLarge ? -18 : -12;
    const statsOffset = isLarge ? 6 : 12;
    const nameText = this._scene.add.text(textX, y + nameOffset, name, {
      fontSize: isLarge ? '18px' : '16px', color: '#ffffff', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // HP / ATK (left, below name)
    const statsText = this._scene.add.text(textX, y + statsOffset, `HP ${displayHp}  ATK ${displayAtk}`, {
      fontSize: isLarge ? '14px' : '12px', color: '#aaaaaa', fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5);

    // Buff badge
    const elements = [rowBg, spriteIcon, nameText, statsText];

    if (instance.buffFlags && instance.buffFlags.converted) {
      const badge = this._scene.add.text(nameText.x + nameText.width + 8, y + nameOffset, '強化', {
        fontSize: '11px', color: '#f1c40f', fontFamily: FONT_FAMILY,
      }).setOrigin(0, 0.5);
      elements.push(badge);
    }

    // Status badge
    const statusBadge = this._scene.add.text(width - 120, y + nameOffset, status.label, {
      fontSize: '12px', color: status.text, fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);
    elements.push(statusBadge);

    // CellId display for deployed monsters
    if (isDeployed) {
      const cellLabel = this._scene.add.text(width - 120, y + 6, instance.placedCellId, {
        fontSize: '10px', color: '#9999bb', fontFamily: FONT_FAMILY,
      }).setOrigin(0.5);
      elements.push(cellLabel);
    }

    // Action button
    if (isDeployed) {
      const recallBtn = this._scene.add.text(width - 40, y, '收回', {
        fontSize: '13px', color: '#ff8888', fontFamily: FONT_FAMILY,
        backgroundColor: '#442222', padding: { x: 6, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      recallBtn.on('pointerdown', () => this._onRecall(instance));
      elements.push(recallBtn);
    } else {
      const placeBtn = this._scene.add.text(width - 40, y, '放置', {
        fontSize: '13px', color: '#88ff88', fontFamily: FONT_FAMILY,
        backgroundColor: '#224422', padding: { x: 6, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      placeBtn.on('pointerdown', () => this._onPlace(instance));
      elements.push(placeBtn);
    }

    this._rootContainer.add(elements);
  }

  _onPlace(instance) {
    this._scene.switchSubstate('dungeonMap');
    if (this._scene.currentSubstate !== 'dungeonMap') return;
    this._scene.dungeonMapUI.enterMonsterPlacement(instance.instanceId);
  }

  _onRecall(instance) {
    if (instance.placedCellId === null) return;
    this._gameState.removeCellMonster(instance.placedCellId);
    this.rebuild();
  }
}
