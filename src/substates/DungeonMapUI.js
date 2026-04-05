import Phaser from 'phaser';
import { TOP_HUD_HEIGHT, TAB_BAR_HEIGHT, FONT_FAMILY } from '../utils/constants.js';
import SpriteHelper from '../utils/SpriteHelper.js';
import spriteManifest from '../data/spriteManifest.js';

// --- Layout constants ---
const MAP_WORLD_H  = 860;
const HAND_H       = 64;
const CELL_SIZE    = 80;
const CELL_HIT     = 80;
const PAN_THRESHOLD  = 8;
const INERTIA_DECAY  = 0.92;
const INERTIA_STOP   = 0.5;

// --- Monster / icon visual constants (P026 + 009 visual fix) ---
const MONSTER_SIZE      = 58;
const PEDESTAL_RX       = 25;
const PEDESTAL_RY       = 12;
const PEDESTAL_Y        = 8;
const PEDESTAL_COLOR    = 0x1a1a1a;
const PEDESTAL_ALPHA    = 0.5;
const ICON_SIZE         = 18;
const ICON_BG_SIZE      = 22;
const ICON_BG_RADIUS    = 6;
const ICON_BG_COLOR     = 0x000000;
const ICON_BG_ALPHA     = 0.7;

// --- Deploy / remove animation constants (P026) ---
const DEPLOY_DROP_Y     = -30;
const DEPLOY_DURATION   = 200;
const DEPLOY_BOUNCE     = 1.05;
const BUFF_DELAY        = 200;
const BUFF_PULSE_DUR    = 300;
const REMOVE_DURATION   = 150;
const REMOVE_SCALE      = 0.8;

export default class DungeonMapUI {
  /**
   * @param {Phaser.Scene} scene     - GameScene instance
   * @param {import('../models/GameState.js').default} gameState
   */
  constructor(scene, gameState) {
    this.scene     = scene;
    this.gameState = gameState;

    // Selection state for card / monster placement
    this.selectionState = { mode: 'none', handIndex: -1, monsterId: null };

    // Scroll state
    this._scrollY    = 0;
    this._velocityY  = 0;
    this._isPanning  = false;
    this._isHandTouch = false;
    this._startX     = 0;
    this._startY     = 0;
    this._lastPointerY   = 0;
    this._prevPointerY   = 0;
    this._prevPrevPointerY = 0;

    // Pulse tweens for valid placement cells
    this._pulseTweens = [];

    // Animation safety (009)
    this._isAnimating = false;
    this._activeAnimTweens = [];

    // Room buff indicator dots (shown during battle)
    this._buffIndicators = [];

    // Build containers
    this._buildContainers();
    this._buildScrollInput();
    this._buildHandInput();

    // Register update loop for inertia
    scene.events.on('update', this._onUpdate, this);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Returns the root container to be added to containers.dungeonMap by GameScene. */
  getContainer() {
    return this._rootContainer;
  }

  /** Return the map world container for adding battle visuals. */
  getMapWorldContainer() { return this._mapWorldContainer; }

  /** Get cell visual position by cellId (for rendering & hero movement). */
  getCellPosition(cellId) {
    const cell = this.gameState.getCell(cellId);
    if (!cell) return null;
    return cell.visualPos
      ? { x: cell.visualPos.x, y: cell.visualPos.y }
      : { x: cell.position.x, y: cell.position.y };
  }

  /** Get cell logical position by cellId (for hit-test). */
  getCellLogicalPosition(cellId) {
    const cell = this.gameState.getCell(cellId);
    return cell ? { x: cell.position.x, y: cell.position.y } : null;
  }

  /** Highlight a cell border with the given color. Pass null to clear. */
  setCellHighlight(cellId, color) {
    const cont = this._cellContainers.find(c => c.getData('cellId') === cellId);
    if (!cont) return;
    const highlightBorder = cont.getData('highlightBorder');
    if (!highlightBorder) return;
    const half = CELL_SIZE / 2;

    if (color !== null) {
      highlightBorder.clear();
      highlightBorder.setAlpha(1);
      highlightBorder.lineStyle(3, color, 1);
      highlightBorder.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, 8);
      highlightBorder.setVisible(true);
    } else {
      highlightBorder.setVisible(false);
      highlightBorder.setAlpha(1);
    }
  }

  /** Clear all battle-related cell highlights by rebuilding cells. */
  clearBattleHighlights() {
    this._rebuildCells();
  }

  /** Show colored dot overlays on cells where monster has active room buff. */
  showRoomBuffIndicators() {
    this.hideRoomBuffIndicators();
    const BUFF_COLORS = {
      dungeon: 0x6B8E9B, training: 0xC4956A, hatchery: 0x8BC49A,
      lab: 0x9B7BBF, treasury: 0xD4A844
    };
    const dataManager = this.scene.registry.get('dataManager');
    for (const cell of this.gameState.dungeonGrid) {
      if (!cell.room || !cell.monster || cell.type !== 'normal') continue;
      const roomDef = dataManager.getRoom(cell.room.typeId);
      if (!roomDef || !roomDef.buffTarget) continue;
      const monsterDef = dataManager.getMonster(cell.monster.typeId);
      if (!monsterDef || !monsterDef.type || !monsterDef.type.includes(roomDef.buffTarget)) continue;
      // Find cell visual position from cell data
      const vp = cell.visualPos ?? cell.position;
      const { x, y } = vp;
      const color = BUFF_COLORS[cell.room.typeId] || 0xFFFFFF;
      const dot = this.scene.add.circle(x + 20, y - 20, 5, color, 0.9);
      dot.setDepth(10);
      this._mapWorldContainer.add(dot);
      this._buffIndicators.push(dot);
    }
  }

  /** Remove room buff indicators. */
  hideRoomBuffIndicators() {
    for (const dot of this._buffIndicators) {
      if (dot && dot.scene) dot.destroy();
    }
    this._buffIndicators = [];
  }

  /**
   * Enable/disable battle mode. In battle mode:
   * - Hand area hidden, card taps disabled
   * - Cell tap opens no popup, no card/monster placement
   * - Scroll still works
   */
  setBattleMode(active) {
    this._battleMode = active;
    this._handAreaContainer.setVisible(!active);
    if (active) {
      this._hidePopup();
      this._clearSelection();
      if (this._handZone) this._handZone.disableInteractive();
      this._isHandTouch = false;
    } else {
      if (this._handZone) this._handZone.setInteractive();
    }
  }

  /**
   * Rebuild all cell visuals and hand area from current gameState.
   * Call this whenever gameState.dungeonGrid or gameState.hand changes.
   */
  refresh() {
    this._rebuildBackground();
    this._rebuildCells();
    this._rebuildHand();
    this._hidePopup();
  }

  /**
   * Stub API: enter monster placement mode for the given monster instanceId.
   * @param {string} instanceId
   */
  enterMonsterPlacement(instanceId) {
    if (this._isAnimating) return;
    this._clearSelection();
    this.selectionState = { mode: 'monster', handIndex: -1, monsterId: instanceId };
    this._highlightValidCells();
    this._rebuildHand(); // dim hand when in monster mode
  }

  /**
   * Clean up: remove update listener and destroy containers.
   */
  destroy() {
    this.scene.events.off('update', this._onUpdate, this);
    this._killAnimTweens();
    this._stopPulseTweens();
    // Remove scene-level input listeners
    if (this._handResetHandler) {
      this.scene.input.off('pointerup',        this._handResetHandler);
      this.scene.input.off('pointerupoutside', this._handResetHandler);
      this.scene.input.off('pointercancel',    this._handResetHandler);
    }
    if (this._mapBgImage) this._mapBgImage.destroy();
    if (this._pathSpriteContainer) this._pathSpriteContainer.destroy(true);
    if (this._cellLayerContainer) this._cellLayerContainer.destroy(true);
    if (this._pathOverlayContainer) this._pathOverlayContainer.destroy(true);
    if (this._rootContainer) this._rootContainer.destroy();
  }

  // ---------------------------------------------------------------------------
  // Container construction
  // ---------------------------------------------------------------------------

  _buildContainers() {
    const scene  = this.scene;
    const { width, height } = scene.scale;

    this._rootContainer = scene.add.container(0, 0);

    // mapWorldContainer sits at y = TOP_HUD_HEIGHT; scroll moves it up
    this._mapWorldContainer = scene.add.container(0, TOP_HUD_HEIGHT);
    this._rootContainer.add(this._mapWorldContainer);

    // Background image (created once, never rebuilt)
    this._mapBgImage = scene.add.image(0, 0, 'map_bg').setOrigin(0, 0);
    this._mapWorldContainer.add(this._mapBgImage);

    // Path base graphics (glow + main lines, redrawn on rebuild)
    this._pathGfx = scene.add.graphics();
    this._mapWorldContainer.add(this._pathGfx);

    // Path sprite container (chain link sprites, cleared + repopulated on rebuild)
    this._pathSpriteContainer = scene.add.container(0, 0);
    this._mapWorldContainer.add(this._pathSpriteContainer);

    // Cell layer container — holds all cell containers, ensures correct z-order
    this._cellLayerContainer = scene.add.container(0, 0);
    this._mapWorldContainer.add(this._cellLayerContainer);

    // cellContainers array — rebuilt on each refresh()
    this._cellContainers = [];

    // Path overlay container (arrows + diamonds — ABOVE cells)
    this._pathOverlayContainer = scene.add.container(0, 0);
    this._mapWorldContainer.add(this._pathOverlayContainer);

    // Forecast graphics (dashed route, dynamic per-wave)
    this._forecastGfx = scene.add.graphics();
    this._mapWorldContainer.add(this._forecastGfx);

    // Hand area — fixed position at bottom
    const handY = height - TAB_BAR_HEIGHT - HAND_H;
    this._handAreaContainer = scene.add.container(0, handY);
    this._buildHandBackground(width);
    this._rootContainer.add(this._handAreaContainer);

    // Popup container — hidden by default
    this._popupContainer = scene.add.container(0, 0);
    this._popupContainer.setVisible(false);
    this._rootContainer.add(this._popupContainer);
  }

  _buildHandBackground(width) {
    const bg = this.scene.add.rectangle(
      width / 2, HAND_H / 2,
      width, HAND_H,
      0x1a1a2e, 0.9
    );
    this._handAreaContainer.add(bg);
  }

  // ---------------------------------------------------------------------------
  // Background / path rendering (baked into RenderTexture)
  // ---------------------------------------------------------------------------

  _rebuildBackground() {
    this._pathGfx.clear();
    this._pathSpriteContainer.removeAll(true);
    this._pathOverlayContainer.removeAll(true);

    // 2. Path lines + chain sprites
    const grid = this.gameState.dungeonGrid;
    const cellMap = new Map(grid.map(c => [c.id, c]));
    const pathGfx = this._pathGfx;
    const scene = this.scene;

    for (const cell of grid) {
      for (const targetId of cell.connections) {
        const target = cellMap.get(targetId);
        if (!target) continue;

        const ax = cell.visualPos?.x ?? cell.position.x;
        const ay = cell.visualPos?.y ?? cell.position.y;
        const bx = target.visualPos?.x ?? target.position.x;
        const by = target.visualPos?.y ?? target.position.y;

        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Glow line (wide, translucent)
        pathGfx.lineStyle(10, 0xCD853F, 0.15);
        pathGfx.beginPath();
        pathGfx.moveTo(ax, ay);
        pathGfx.lineTo(bx, by);
        pathGfx.strokePath();

        // Main path line
        pathGfx.lineStyle(6, 0xCD853F, 0.7);
        pathGfx.beginPath();
        pathGfx.moveTo(ax, ay);
        pathGfx.lineTo(bx, by);
        pathGfx.strokePath();

        // Chain sprites along path (skip 28px margins at each end)
        const startOffset = 28;
        const endOffset = 28;
        const usableDist = dist - startOffset - endOffset;

        if (usableDist > 0) {
          const chainSpacing = 24;
          const chainCount = Math.floor(usableDist / chainSpacing);
          for (let s = 0; s < chainCount; s++) {
            const t = (startOffset + s * chainSpacing + chainSpacing / 2) / dist;
            const cx = ax + dx * t;
            const cy = ay + dy * t;
            const chain = scene.add.image(cx, cy, 'path_chain')
              .setOrigin(0.5, 0.5)
              .setRotation(angle);
            this._pathSpriteContainer.add(chain);
          }
        }

        // Arrow sprite at downstream end (28px before target center)
        const arrowT = Math.max(0, 1 - endOffset / dist);
        const arrowX = ax + dx * arrowT;
        const arrowY = ay + dy * arrowT;
        const arrow = scene.add.image(arrowX, arrowY, 'path_arrow')
          .setOrigin(0.5, 0.5)
          .setRotation(angle);
        this._pathOverlayContainer.add(arrow);
      }
    }

    // 3. Fork/Merge diamond markers (in overlay, above cells)
    for (const cell of grid) {
      if (cell.connections.length > 1 || this._getIncomingCount(cell.id, grid) > 1) {
        const cx = cell.visualPos?.x ?? cell.position.x;
        const cy = cell.visualPos?.y ?? cell.position.y;
        const diamond = scene.add.image(cx, cy, 'path_diamond')
          .setOrigin(0.5, 0.5);
        this._pathOverlayContainer.add(diamond);
      }
    }

  }

  /** Count incoming connections to a cell. */
  _getIncomingCount(cellId, grid) {
    let count = 0;
    for (const c of grid) {
      if (c.connections.includes(cellId)) count++;
    }
    return count;
  }

  /**
   * Draw the next wave's predicted route on the dynamic forecast layer.
   * @param {string[]} route - Array of cellIds the hero will traverse
   */
  drawForecastRoute(route) {
    this._forecastGfx.clear();
    if (!route || route.length < 2) return;

    this._forecastGfx.lineStyle(3, 0x4a9eff, 0.6);

    for (let i = 0; i < route.length - 1; i++) {
      const from = this.getCellPosition(route[i]);
      const to = this.getCellPosition(route[i + 1]);
      if (!from || !to) continue;

      // Dashed line effect
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dashLen = 8;
      const gapLen = 6;
      const steps = Math.floor(dist / (dashLen + gapLen));

      for (let s = 0; s < steps; s++) {
        const t0 = s * (dashLen + gapLen) / dist;
        const t1 = Math.min(1, (s * (dashLen + gapLen) + dashLen) / dist);
        this._forecastGfx.beginPath();
        this._forecastGfx.moveTo(from.x + dx * t0, from.y + dy * t0);
        this._forecastGfx.lineTo(from.x + dx * t1, from.y + dy * t1);
        this._forecastGfx.strokePath();
      }
    }
  }

  /** Clear the forecast overlay. */
  clearForecastRoute() {
    this._forecastGfx.clear();
  }

  // ---------------------------------------------------------------------------
  // Cell visuals
  // ---------------------------------------------------------------------------

  _rebuildCells() {
    // Kill active animation tweens before destroying containers (B3)
    this._killAnimTweens();
    // Remove previous cell containers
    for (const c of this._cellContainers) {
      this._cellLayerContainer.remove(c, true);
    }
    this._cellContainers = [];
    this._stopPulseTweens();

    for (const cell of this.gameState.dungeonGrid) {
      const cellCont = this._buildCellContainer(cell);
      this._cellLayerContainer.add(cellCont);
      this._cellContainers.push(cellCont);
    }
  }

  /** Get the sprite key for a cell's background tile. */
  _getCellSpriteKey(cell) {
    if (cell.type === 'portal') return 'cell_portal';
    if (cell.type === 'heart') return 'cell_heart';
    if (!cell.room) return 'cell_empty';
    const KNOWN = ['hatchery', 'lab', 'training', 'dungeon', 'treasury'];
    if (KNOWN.includes(cell.room.typeId)) return `cell_${cell.room.typeId}`;
    return 'cell_empty';
  }

  /** Get the icon sprite key for a room type, or null if unknown. */
  _getRoomIconKey(roomTypeId) {
    const KNOWN = ['hatchery', 'lab', 'training', 'dungeon', 'treasury'];
    return KNOWN.includes(roomTypeId) ? `icon_${roomTypeId}` : null;
  }

  /**
   * Build a single cell container and attach touch handler.
   * @param {object} cell - GridCell
   * @returns {Phaser.GameObjects.Container}
   */
  _buildCellContainer(cell) {
    const scene = this.scene;
    const vp = cell.visualPos ?? cell.position;
    const { x, y } = vp;
    const half = CELL_SIZE / 2;

    const cont = scene.add.container(x, y);

    // Base sprite (cell tile)
    const spriteKey = this._getCellSpriteKey(cell);
    const baseSprite = scene.add.image(0, 0, spriteKey).setOrigin(0.5);
    cont.add(baseSprite);

    // Default border (drawn per cell state)
    const defaultBorder = scene.add.graphics();
    this._drawDefaultBorder(cell, defaultBorder, half);
    cont.add(defaultBorder);

    // Highlight border (transient, initially hidden)
    const highlightBorder = scene.add.graphics();
    highlightBorder.setVisible(false);
    cont.add(highlightBorder);

    // Monster pedestal + sprite — centered, idle animation (009: visual primary)
    if (cell.monster) {
      const pedestal = scene.add.graphics();
      pedestal.fillStyle(PEDESTAL_COLOR, PEDESTAL_ALPHA);
      pedestal.fillEllipse(0, PEDESTAL_Y, PEDESTAL_RX * 2, PEDESTAL_RY * 2);
      cont.add(pedestal);
      cont.setData('pedestal', pedestal);

      const idleKey = `monster_${cell.monster.typeId}_idle`;
      let monSprite;
      if (scene.anims.exists(idleKey)) {
        monSprite = scene.add.sprite(0, 0, idleKey).setOrigin(0.5);
        monSprite.displayWidth = MONSTER_SIZE;
        monSprite.displayHeight = MONSTER_SIZE;
        const entry = spriteManifest.find(e => e.key === idleKey);
        const endFrame = entry?.animation?.end ?? 3;
        const startFrame = Phaser.Math.Between(entry?.animation?.start ?? 0, endFrame);
        monSprite.play({ key: idleKey, startFrame });
      } else {
        const staticKey = `monster_${cell.monster.typeId}`;
        monSprite = SpriteHelper.createSprite(scene, staticKey, 0, 0, MONSTER_SIZE);
      }
      cont.add(monSprite);
      cont.setData('monsterSprite', monSprite);
    }

    // Room icon + backing — left-bottom corner (009: with backing for contrast)
    if (cell.room) {
      const iconKey = this._getRoomIconKey(cell.room.typeId);
      if (iconKey) {
        const iconBg = scene.add.graphics();
        iconBg.fillStyle(ICON_BG_COLOR, ICON_BG_ALPHA);
        iconBg.fillRoundedRect(-38, 16, ICON_BG_SIZE, ICON_BG_SIZE, ICON_BG_RADIUS);
        cont.add(iconBg);
        const iconSprite = SpriteHelper.createSprite(scene, iconKey, -27, 27, ICON_SIZE);
        cont.add(iconSprite);
        cont.setData('roomIcon', iconSprite);
      }
    }

    // Trap icon + backing — top-right corner (009: with backing for contrast)
    if (cell.trap) {
      const trapBg = scene.add.graphics();
      trapBg.fillStyle(ICON_BG_COLOR, ICON_BG_ALPHA);
      trapBg.fillRoundedRect(16, -38, ICON_BG_SIZE, ICON_BG_SIZE, ICON_BG_RADIUS);
      cont.add(trapBg);
      const trapIcon = SpriteHelper.createSprite(scene, 'icon_trap', 27, -27, ICON_SIZE);
      cont.add(trapIcon);
    }

    // Store references
    cont.setData('cellId', cell.id);
    cont.setData('baseSprite', baseSprite);
    cont.setData('defaultBorder', defaultBorder);
    cont.setData('highlightBorder', highlightBorder);

    return cont;
  }

  /** Draw the default border for a cell based on its state. */
  _drawDefaultBorder(cell, border, half) {
    const r = 8;
    border.clear();

    if (cell.type === 'portal') {
      border.lineStyle(4, 0x00FFFF, 0.4);
      border.strokeRoundedRect(-half - 3, -half - 3, CELL_SIZE + 6, CELL_SIZE + 6, r + 2);
      border.lineStyle(3, 0x00FFFF, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else if (cell.type === 'heart') {
      border.lineStyle(4, 0x9B59B6, 0.4);
      border.strokeRoundedRect(-half - 3, -half - 3, CELL_SIZE + 6, CELL_SIZE + 6, r + 2);
      border.lineStyle(3, 0x9B59B6, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else if (!cell.room) {
      border.lineStyle(2, 0x8B4513, 0.4);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else if (cell.trap) {
      border.lineStyle(3, 0x8B0000, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else {
      border.lineStyle(3, 0x8B4513, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    }
  }

  /** Return the main label string for a cell. */
  _getCellLabel(cell) {
    if (cell.type === 'portal') return '入口';
    if (cell.type === 'heart')  return '地城之心';
    if (!cell.room)             return '?';
    const LABEL_MAP = {
      hatchery: '孵化室', lab: '實驗室', training: '訓練場',
      dungeon: '牢房', treasury: '寶庫',
    };
    return LABEL_MAP[cell.room.typeId] || cell.room.typeId;
  }

  // ---------------------------------------------------------------------------
  // Hand area
  // ---------------------------------------------------------------------------

  _rebuildHand() {
    const scene = this.scene;
    const { width } = scene.scale;

    // Clear previous children except background (index 0)
    while (this._handAreaContainer.list.length > 1) {
      const last = this._handAreaContainer.list[this._handAreaContainer.list.length - 1];
      this._handAreaContainer.remove(last, true);
    }

    const hand = this.gameState.hand;

    if (!hand || hand.length === 0) {
      const emptyText = scene.add.text(width / 2, HAND_H / 2, '翻牌取得卡牌', {
        fontSize: '14px', color: '#9999bb', fontFamily: FONT_FAMILY,
      }).setOrigin(0.5);
      this._handAreaContainer.add(emptyText);
      return;
    }

    const thumbSize = 48;
    const gap       = 8;
    const totalW    = hand.length * thumbSize + (hand.length - 1) * gap;
    const startX    = (width - totalW) / 2 + thumbSize / 2;

    hand.forEach((card, i) => {
      const x = startX + i * (thumbSize + gap);
      const y = HAND_H / 2;

      const isSelected = (this.selectionState.mode === 'card' && this.selectionState.handIndex === i);
      const thumbW = isSelected ? 56 : thumbSize;
      const thumbH = isSelected ? 56 : thumbSize;

      // Thumbnail border color
      const borderColor = (card.type === 'trap') ? 0xc0392b : 0x8B4513;
      const borderAlpha = isSelected ? 1 : 0.9;
      const borderW     = isSelected ? 3 : 2;

      const bg = scene.add.graphics();
      if (isSelected) {
        // Gold border for selected card
        bg.lineStyle(3, 0xf1c40f, 1);
      } else {
        bg.lineStyle(borderW, borderColor, borderAlpha);
      }
      bg.fillStyle(0x2d2d4e, 0.9);
      bg.fillRoundedRect(x - thumbW / 2, y - thumbH / 2, thumbW, thumbH, 6);
      bg.strokeRoundedRect(x - thumbW / 2, y - thumbH / 2, thumbW, thumbH, 6);

      const label = scene.add.text(x, y - 6, card.id[0] || '?', {
        fontSize: '16px', color: '#ffffff', fontFamily: FONT_FAMILY,
      }).setOrigin(0.5);

      // Star dots
      let starStr = '';
      for (let s = 0; s < (card.starRating || 1); s++) starStr += '★';
      const starText = scene.add.text(x, y + 12, starStr, {
        fontSize: '8px', color: '#f1c40f', fontFamily: FONT_FAMILY,
      }).setOrigin(0.5);

      // Dim non-selected cards during selection mode
      const alpha = (this.selectionState.mode === 'card' && !isSelected) ? 0.4 : 1;
      bg.setAlpha(alpha);
      label.setAlpha(alpha);
      starText.setAlpha(alpha);

      // Hit zone
      const hitZone = scene.add.rectangle(x, y, thumbSize + 4, thumbSize + 4, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', (pointer, lx, ly, event) => {
        event.stopPropagation();
        this._onCardTap(i);
      });

      this._handAreaContainer.add([bg, label, starText, hitZone]);
    });
  }

  // ---------------------------------------------------------------------------
  // Hand touch isolation
  // ---------------------------------------------------------------------------

  _buildHandInput() {
    const scene  = this.scene;
    const { width } = scene.scale;
    const handY  = this.scene.scale.height - TAB_BAR_HEIGHT - HAND_H;

    this._handZone = scene.add.zone(0, handY, width, HAND_H)
      .setOrigin(0, 0)
      .setInteractive();
    this._rootContainer.add(this._handZone);

    this._handZone.on('pointerdown', (_pointer, _lx, _ly, event) => {
      this._isHandTouch = true;
      event.stopPropagation();
    });

    // Scene-level reset for hand touch flag (stored refs for cleanup)
    this._handResetHandler = () => { this._isHandTouch = false; };
    scene.input.on('pointerup',        this._handResetHandler);
    scene.input.on('pointerupoutside', this._handResetHandler);
    scene.input.on('pointercancel',    this._handResetHandler);
  }

  // ---------------------------------------------------------------------------
  // Scroll / pan input
  // ---------------------------------------------------------------------------

  _buildScrollInput() {
    const scene = this.scene;

    // Transparent overlay covering the map viewport for scroll input
    const { width } = scene.scale;
    const viewportH = this._viewportH();
    this._mapZone = scene.add.zone(0, TOP_HUD_HEIGHT, width, viewportH)
      .setOrigin(0, 0)
      .setInteractive();
    this._rootContainer.add(this._mapZone);

    this._mapZone.on('pointerdown', (pointer) => {
      if (this._isHandTouch) return;
      this._startX = pointer.x;
      this._startY = pointer.y;
      this._isPanning = false;
      // Stop inertia
      this._velocityY = 0;
      this._prevPointerY     = pointer.y;
      this._prevPrevPointerY = pointer.y;
      this._lastPointerY     = pointer.y;
    });

    this._mapZone.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      if (this._isHandTouch) return;

      const dx = pointer.x - this._startX;
      const dy = pointer.y - this._startY;

      if (!this._isPanning && Math.sqrt(dx * dx + dy * dy) > PAN_THRESHOLD) {
        this._isPanning = true;
      }

      if (this._isPanning) {
        const delta = pointer.y - this._lastPointerY;
        this._scrollY = this._clampScroll(this._scrollY + delta);
        this._mapWorldContainer.y = TOP_HUD_HEIGHT + this._scrollY;

        this._prevPrevPointerY = this._prevPointerY;
        this._prevPointerY     = this._lastPointerY;
        this._lastPointerY     = pointer.y;
      }
    });

    this._mapZone.on('pointerup', (pointer) => {
      if (this._isHandTouch) return;

      if (this._isPanning) {
        // Compute inertia velocity from last 3 frames
        const v1 = pointer.y - this._prevPointerY;
        const v2 = this._prevPointerY - this._prevPrevPointerY;
        this._velocityY = (v1 + v2) / 2;
      } else {
        // It was a tap — hit-test cells at pointer position
        this._handleMapTap(pointer);
      }

      this._isPanning = false;
    });
  }

  /** Return available viewport height for the map. */
  _viewportH() {
    return this.scene.scale.height - TOP_HUD_HEIGHT - HAND_H - TAB_BAR_HEIGHT;
  }

  /** Clamp scrollY so the map world stays within the viewport. */
  _clampScroll(value) {
    const viewportH = this._viewportH();
    const minScroll = -(MAP_WORLD_H - viewportH);
    return Math.max(minScroll, Math.min(0, value));
  }

  /** Get current scroll Y position. */
  getScrollY() { return this._scrollY; }

  /** Scroll map to center a specific cell on screen. */
  scrollToCell(cellId, duration = 300) {
    const pos = this.getCellPosition(cellId);
    if (!pos) return;
    const viewportH = this._viewportH();
    const targetScrollY = this._clampScroll(-(pos.y - viewportH / 2));

    if (duration <= 0) {
      this._scrollY = targetScrollY;
      this._mapWorldContainer.y = TOP_HUD_HEIGHT + this._scrollY;
      return;
    }

    // Stop inertia
    this._velocityY = 0;

    // Tween scroll
    if (this._scrollTween && this._scrollTween.isPlaying()) this._scrollTween.stop();
    this._scrollTween = this.scene.tweens.add({
      targets: this,
      _scrollY: targetScrollY,
      duration,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this._mapWorldContainer.y = TOP_HUD_HEIGHT + this._scrollY;
      },
    });
  }

  /** Set scroll Y to a specific value, optionally with tween. */
  setScrollY(value, duration = 0) {
    const clamped = this._clampScroll(value);
    if (duration <= 0) {
      this._scrollY = clamped;
      this._mapWorldContainer.y = TOP_HUD_HEIGHT + this._scrollY;
      return;
    }
    this._velocityY = 0;
    if (this._scrollTween && this._scrollTween.isPlaying()) this._scrollTween.stop();
    this._scrollTween = this.scene.tweens.add({
      targets: this,
      _scrollY: clamped,
      duration,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this._mapWorldContainer.y = TOP_HUD_HEIGHT + this._scrollY;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Inertia update loop
  // ---------------------------------------------------------------------------

  _onUpdate() {
    if (Math.abs(this._velocityY) < INERTIA_STOP) {
      this._velocityY = 0;
      return;
    }
    this._scrollY = this._clampScroll(this._scrollY + this._velocityY);
    this._mapWorldContainer.y = TOP_HUD_HEIGHT + this._scrollY;
    this._velocityY *= INERTIA_DECAY;
  }

  // ---------------------------------------------------------------------------
  // Cell tap handling
  // ---------------------------------------------------------------------------

  /**
   * Called on pointerup when the gesture was a tap (not a pan).
   * Manually hit-tests pointer position against cell containers in map world space.
   */
  _handleMapTap(pointer) {
    if (this._battleMode || this._isAnimating) return;
    // Convert screen pointer to map world coordinates
    const worldX = pointer.x;
    const worldY = pointer.y - (TOP_HUD_HEIGHT + this._scrollY);

    // Find the cell closest to pointer within CELL_HIT radius
    let tappedCell = null;
    let minDist = CELL_HIT / 2;

    for (const cell of this.gameState.dungeonGrid) {
      const dx = worldX - cell.position.x;
      const dy = worldY - cell.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        tappedCell = cell;
      }
    }

    if (!tappedCell) {
      // Tap on empty space → cancel selection
      if (this.selectionState.mode !== 'none') {
        this._clearSelection();
      }
      return;
    }

    const mode = this.selectionState.mode;

    if (mode === 'card') {
      this._handleCardPlacement(tappedCell);
    } else if (mode === 'monster') {
      this._handleMonsterPlacement(tappedCell);
    } else {
      this._showCellPopup(tappedCell);
    }
  }

  // ---------------------------------------------------------------------------
  // Card tap (hand area)
  // ---------------------------------------------------------------------------

  _onCardTap(handIndex) {
    if (this._battleMode || this._isAnimating) return;
    if (this.selectionState.mode === 'card') {
      if (this.selectionState.handIndex === handIndex) {
        // Re-tap selected card → cancel
        this._clearSelection();
      } else {
        // Switch selection to different card
        this._clearSelection();
        this._enterCardSelection(handIndex);
      }
    } else {
      this._clearSelection();
      this._enterCardSelection(handIndex);
    }
  }

  _enterCardSelection(handIndex) {
    this.selectionState = { mode: 'card', handIndex, monsterId: null };
    this._rebuildHand();
    this._highlightValidCells();
  }

  // ---------------------------------------------------------------------------
  // Valid cell highlighting
  // ---------------------------------------------------------------------------

  _highlightValidCells() {
    this._stopPulseTweens();

    for (const cont of this._cellContainers) {
      const cellId = cont.getData('cellId');
      const cell   = this.gameState.getCell(cellId);
      if (!cell || cell.type !== 'normal') continue;

      const highlightBorder = cont.getData('highlightBorder');
      if (!highlightBorder) continue;

      // Draw green highlight border
      const half = CELL_SIZE / 2;
      highlightBorder.clear();
      highlightBorder.lineStyle(3, 0x00ff44, 1);
      highlightBorder.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, 8);
      highlightBorder.setVisible(true);

      const tween = this.scene.tweens.add({
        targets: highlightBorder,
        alpha: { from: 0.3, to: 0.8 },
        yoyo: true,
        repeat: -1,
        duration: 600,
      });
      this._pulseTweens.push(tween);
    }
  }

  _stopPulseTweens() {
    for (const tween of this._pulseTweens) {
      if (tween && tween.isPlaying && tween.isPlaying()) tween.stop();
    }
    this._pulseTweens = [];
  }

  // ---------------------------------------------------------------------------
  // Card placement logic
  // ---------------------------------------------------------------------------

  _handleCardPlacement(cell) {
    if (cell.type !== 'normal') {
      this._clearSelection();
      return;
    }

    const { handIndex } = this.selectionState;
    const card = this.gameState.hand[handIndex];
    if (!card) { this._clearSelection(); return; }

    const existingContent = (card.type === 'room') ? cell.room : cell.trap;

    if (!existingContent) {
      // Empty slot — place directly
      this._placeCard(cell, card, handIndex);
    } else if (existingContent.typeId === card.id) {
      // Same type & id — upgrade (level + 1)
      existingContent.level = (existingContent.level || 1) + 1;
      this._removeHandCard(handIndex);
      this._clearSelection();
      this._afterPlacement();
    } else {
      // Different content of same type — confirm replace
      this._showReplaceConfirm(cell, card, handIndex);
    }
  }

  /**
   * Place a card from hand onto a cell unconditionally.
   * @param {object} cell
   * @param {object} card
   * @param {number} handIndex
   */
  _placeCard(cell, card, handIndex) {
    if (card.type === 'room') {
      this.gameState.setCellRoom(cell.id, card.id, card.starRating || 1);
    } else if (card.type === 'trap') {
      this.gameState.setCellTrap(cell.id, card.id, card.starRating || 1);
    }
    this._removeHandCard(handIndex);
    this._clearSelection();
    this._afterPlacement();
  }

  _afterPlacement() {
    this.gameState.recalcGlamour();
    if (this.scene.topHUD) this.scene.topHUD.update();
    this.refresh();
  }

  _removeHandCard(index) {
    this.gameState.hand.splice(index, 1);
  }

  /** Show an inline confirm text "替換？" with [Yes][No] over the cell. */
  _showReplaceConfirm(cell, card, handIndex) {
    const scene  = this.scene;
    const vp = cell.visualPos ?? cell.position;
    const { x, y } = vp;

    // Build a small overlay inside mapWorldContainer so it scrolls with the map
    const overlay = scene.add.container(x, y - CELL_SIZE);

    const bg = scene.add.rectangle(0, 0, 120, 60, 0x000000, 0.8)
      .setStrokeStyle(1, 0xffffff);
    const label = scene.add.text(0, -16, '替換？', {
      fontSize: '14px', color: '#ffffff', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);

    const yesBtn = scene.add.text(-28, 10, '[是]', {
      fontSize: '13px', color: '#00ff88', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const noBtn = scene.add.text(28, 10, '[否]', {
      fontSize: '13px', color: '#ff4444', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    yesBtn.on('pointerdown', (_p, _lx, _ly, event) => {
      event.stopPropagation();
      this._mapWorldContainer.remove(overlay, true);
      this._placeCard(cell, card, handIndex);
    });

    noBtn.on('pointerdown', (_p, _lx, _ly, event) => {
      event.stopPropagation();
      this._mapWorldContainer.remove(overlay, true);
      this._clearSelection();
      this.refresh();
    });

    overlay.add([bg, label, yesBtn, noBtn]);
    this._mapWorldContainer.add(overlay);
  }

  // ---------------------------------------------------------------------------
  // Monster placement logic
  // ---------------------------------------------------------------------------

  _handleMonsterPlacement(cell) {
    if (cell.type !== 'normal') {
      this._clearSelection();
      return;
    }

    const { monsterId } = this.selectionState;
    const monster = this.gameState.monsterRoster.find(m => m.instanceId === monsterId);
    if (!monster) { this._clearSelection(); return; }

    if (!cell.monster) {
      // Empty monster slot — place with animation (P026)
      this.gameState.setCellMonster(cell.id, monsterId, monster.typeId);
      this._resetSelectionState();
      this._clearPlacementHighlights();
      const cellCont = this._cellContainers.find(c => c.getData('cellId') === cell.id);
      if (cellCont) {
        this._playDeployAnimation(cellCont, cell, monster.typeId, () => {
          this._rebuildHand();
        });
      } else {
        this._rebuildHand();
      }
    } else {
      // Cell already has a monster — confirm swap
      this._showMonsterSwapConfirm(cell, monsterId, monster.typeId);
    }
  }

  _showMonsterSwapConfirm(cell, monsterId, typeId) {
    const scene  = this.scene;
    const vp = cell.visualPos ?? cell.position;
    const { x, y } = vp;

    const overlay = scene.add.container(x, y - CELL_SIZE);

    const bg = scene.add.rectangle(0, 0, 120, 60, 0x000000, 0.8)
      .setStrokeStyle(1, 0xffffff);
    const label = scene.add.text(0, -16, '交換？', {
      fontSize: '14px', color: '#ffffff', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);

    const yesBtn = scene.add.text(-28, 10, '[是]', {
      fontSize: '13px', color: '#00ff88', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const noBtn = scene.add.text(28, 10, '[否]', {
      fontSize: '13px', color: '#ff4444', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    yesBtn.on('pointerdown', (_p, _lx, _ly, event) => {
      event.stopPropagation();
      this._mapWorldContainer.remove(overlay, true);

      // B1: commit state FIRST, then animate (state survives tween kill)
      this.gameState.setCellMonster(cell.id, monsterId, typeId);
      this._resetSelectionState();
      this._clearPlacementHighlights();

      const cellCont = this._cellContainers.find(c => c.getData('cellId') === cell.id);
      const oldMonsterSprite = cellCont ? cellCont.getData('monsterSprite') : null;
      const oldPedestal = cellCont ? cellCont.getData('pedestal') : null;

      this._playRemoveAnimation(oldMonsterSprite, () => {
        if (oldPedestal) oldPedestal.destroy();
        if (cellCont) {
          cellCont.setData('monsterSprite', null);
          cellCont.setData('pedestal', null);
          this._playDeployAnimation(cellCont, cell, typeId, () => {
            this._rebuildHand();
          });
        } else {
          this._isAnimating = false;
          this._rebuildCells();
          this._rebuildHand();
        }
      });
    });

    // B4: noBtn uses lightweight reset instead of full _clearSelection
    noBtn.on('pointerdown', (_p, _lx, _ly, event) => {
      event.stopPropagation();
      this._mapWorldContainer.remove(overlay, true);
      this._resetSelectionState();
      this._clearPlacementHighlights();
    });

    overlay.add([bg, label, yesBtn, noBtn]);
    this._mapWorldContainer.add(overlay);
  }

  // ---------------------------------------------------------------------------
  // Deploy / remove animations (P026)
  // ---------------------------------------------------------------------------

  _playDeployAnimation(cellCont, cell, monsterTypeId, onComplete) {
    const scene = this.scene;
    this._isAnimating = true;

    // Pedestal (009: ellipse shadow)
    const pedestal = scene.add.graphics();
    pedestal.fillStyle(PEDESTAL_COLOR, PEDESTAL_ALPHA);
    pedestal.fillEllipse(0, PEDESTAL_Y, PEDESTAL_RX * 2, PEDESTAL_RY * 2);
    pedestal.setAlpha(0);
    cellCont.add(pedestal);
    cellCont.setData('pedestal', pedestal);

    const idleKey = `monster_${monsterTypeId}_idle`;
    let monSprite;
    if (scene.anims.exists(idleKey)) {
      monSprite = scene.add.sprite(0, DEPLOY_DROP_Y, idleKey).setOrigin(0.5);
      monSprite.displayWidth = MONSTER_SIZE;
      monSprite.displayHeight = MONSTER_SIZE;
      monSprite.setAlpha(0);
    } else {
      const staticKey = `monster_${monsterTypeId}`;
      monSprite = SpriteHelper.createSprite(scene, staticKey, 0, DEPLOY_DROP_Y, MONSTER_SIZE);
      monSprite.setAlpha(0);
    }
    cellCont.add(monSprite);
    cellCont.setData('monsterSprite', monSprite);

    const dropTween = scene.tweens.add({
      targets: monSprite,
      y: 0,
      alpha: 1,
      duration: DEPLOY_DURATION,
      ease: 'Back.Out',
      onComplete: () => {
        if (!scene || !cellCont.scene) { this._isAnimating = false; return; }
        // Fade in pedestal
        const pedestalTween = scene.tweens.add({ targets: pedestal, alpha: 1, duration: 100 });
        this._activeAnimTweens.push(pedestalTween);
        if (scene.anims.exists(idleKey)) {
          const entry = spriteManifest.find(e => e.key === idleKey);
          const endFrame = entry?.animation?.end ?? 3;
          const startFrame = Phaser.Math.Between(entry?.animation?.start ?? 0, endFrame);
          monSprite.play({ key: idleKey, startFrame });
        }
        const bounceTween = scene.tweens.add({
          targets: cellCont,
          scaleX: DEPLOY_BOUNCE,
          scaleY: DEPLOY_BOUNCE,
          duration: 100,
          yoyo: true,
          ease: 'Sine.InOut',
        });
        this._activeAnimTweens.push(bounceTween);
        this._maybePlayBuffEffect(cellCont, cell, monsterTypeId);
        this._isAnimating = false;
        if (onComplete) onComplete();
      },
    });
    this._activeAnimTweens.push(dropTween);
  }

  _maybePlayBuffEffect(cellCont, cell, monsterTypeId) {
    if (!cell.room) return;
    const dataManager = this.scene.registry.get('dataManager');
    const monsterDef = dataManager.getMonster(monsterTypeId);
    const roomDef = dataManager.getRoom(cell.room.typeId);
    if (!monsterDef || !roomDef) return;
    if (!monsterDef.type || !monsterDef.type.includes(roomDef.buffTarget)) return;

    const scene = this.scene;
    const baseSprite = cellCont.getData('baseSprite');
    if (baseSprite) {
      const baseTween = scene.tweens.add({
        targets: baseSprite,
        alpha: 0.6,
        duration: BUFF_PULSE_DUR / 2,
        yoyo: true,
        delay: BUFF_DELAY,
        ease: 'Sine.InOut',
      });
      this._activeAnimTweens.push(baseTween);
    }
    const roomIcon = cellCont.getData('roomIcon');
    if (roomIcon) {
      const iconTween = scene.tweens.add({
        targets: roomIcon,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: BUFF_PULSE_DUR / 2,
        yoyo: true,
        delay: BUFF_DELAY,
        ease: 'Sine.InOut',
      });
      this._activeAnimTweens.push(iconTween);
    }
  }

  _playRemoveAnimation(sprite, onComplete) {
    if (!sprite) {
      if (onComplete) onComplete();
      return;
    }
    this._isAnimating = true;
    const tween = this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scaleX: REMOVE_SCALE,
      scaleY: REMOVE_SCALE,
      duration: REMOVE_DURATION,
      ease: 'Sine.In',
      onComplete: () => {
        if (sprite.scene) sprite.destroy();
        if (onComplete) onComplete();
      },
    });
    this._activeAnimTweens.push(tween);
  }

  /** Kill all tracked animation tweens and reset animation lock. */
  _killAnimTweens() {
    for (const t of this._activeAnimTweens) {
      if (t && t.isPlaying && t.isPlaying()) t.stop();
    }
    this._activeAnimTweens = [];
    this._isAnimating = false;
  }

  // ---------------------------------------------------------------------------
  // Selection clear
  // ---------------------------------------------------------------------------

  /** Reset selection state to sentinel (pure state, no visuals). */
  _resetSelectionState() {
    this.selectionState = { mode: 'none', handIndex: -1, monsterId: null };
  }

  /** Stop pulse tweens and hide all highlight borders (pure visual cleanup). */
  _clearPlacementHighlights() {
    this._stopPulseTweens();
    for (const cont of this._cellContainers) {
      const hb = cont.getData('highlightBorder');
      if (hb) {
        hb.setVisible(false);
        hb.setAlpha(1);
      }
    }
  }

  /** Full selection clear: reset state + clear highlights + rebuild everything. */
  _clearSelection() {
    this._resetSelectionState();
    this._clearPlacementHighlights();
    this._rebuildCells();
    this._rebuildHand();
  }

  // ---------------------------------------------------------------------------
  // Cell detail popup
  // ---------------------------------------------------------------------------

  _showCellPopup(cell) {
    this._hidePopup();

    const scene  = this.scene;
    const { width, height } = scene.scale;

    const popupW = 280;
    const popupH = 200;
    const popupX = (width - popupW) / 2;
    const popupY = (height - popupH) / 2;

    // Dim overlay
    const overlay = scene.add.rectangle(
      width / 2, height / 2,
      width, height,
      0x000000, 0.5
    ).setInteractive();  // absorbs taps outside popup

    // Panel
    const panel = scene.add.graphics();
    panel.fillStyle(0x1e1e3f, 0.97);
    panel.fillRoundedRect(popupX, popupY, popupW, popupH, 12);
    panel.lineStyle(2, 0x8888cc, 1);
    panel.strokeRoundedRect(popupX, popupY, popupW, popupH, 12);

    const cx = popupX + popupW / 2;

    // Title
    const titleText = scene.add.text(cx, popupY + 20, `Cell: ${cell.id}`, {
      fontSize: '14px', color: '#ccccff', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const lines = this._getCellPopupLines(cell);
    const contentTexts = lines.map((line, i) =>
      scene.add.text(popupX + 16, popupY + 46 + i * 22, line, {
        fontSize: '13px', color: '#dddddd', fontFamily: FONT_FAMILY,
      })
    );

    // Close button
    const closeBtn = scene.add.text(cx, popupY + popupH - 22, '[ 關閉 ]', {
      fontSize: '14px', color: '#aaaaff', fontFamily: FONT_FAMILY,
      backgroundColor: '#2a2a5a', padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this._hidePopup());
    overlay.on('pointerdown', () => this._hidePopup());

    this._popupContainer.add([overlay, panel, titleText, ...contentTexts, closeBtn]);
    this._popupContainer.setVisible(true);
  }

  /** Return an array of display lines for the popup body. */
  _getCellPopupLines(cell) {
    if (cell.type === 'portal') return ['類型：入口'];
    if (cell.type === 'heart')  return ['類型：魔王巢穴'];

    const lines = [];

    if (cell.room) {
      lines.push(`房間：${cell.room.typeId}  Lv.${cell.room.level || 1}`);
    } else {
      lines.push('房間：空');
    }

    if (cell.trap) {
      lines.push(`陷阱：${cell.trap.typeId}  Lv.${cell.trap.level || 1}`);
    } else {
      lines.push('陷阱：無');
    }

    if (cell.monster) {
      lines.push(`怪物：${cell.monster.typeId}  HP ${cell.monster.currentHp}`);
    } else {
      lines.push('怪物：無怪物');
    }

    return lines;
  }

  _hidePopup() {
    this._popupContainer.setVisible(false);
    this._popupContainer.removeAll(true);
  }
}
