import { TOP_HUD_HEIGHT, FONT_FAMILY } from '../utils/constants.js';
import SpriteHelper from '../utils/SpriteHelper.js';

const ROW_HEIGHT = 100;
const MAX_VISIBLE = 6;

const TYPE_COLORS = {
  melee: '#e74c3c',
  ranged: '#3498db',
  support: '#2ecc71',
  holy: '#f1c40f',
  fire: '#e67e22',
  tank: '#95a5a6',
  physical: '#cc99ff',
  balanced: '#cccccc',
  legendary: '#ff66ff',
};

export default class BestiaryUI {
  constructor(scene, metaState, gameState, dataManager) {
    this._scene = scene;
    this._metaState = metaState;
    this._gameState = gameState;
    this._dataManager = dataManager;
    this._rootContainer = scene.add.container(0, 0);
  }

  getContainer() { return this._rootContainer; }

  rebuild() {
    this._rootContainer.removeAll(true);

    const { width } = this._scene.scale;
    const allHeroes = this._dataManager.getAllHeroes();
    const metaBestiary = this._metaState.bestiary.heroes;
    const currentEncounters = this._gameState.heroEncounters;

    // Count discovered
    let discoveredCount = 0;
    for (const hero of allHeroes) {
      if (metaBestiary[hero.id] || currentEncounters[hero.id]) discoveredCount++;
    }

    this._buildTitle(width, discoveredCount, allHeroes.length);

    const startY = TOP_HUD_HEIGHT + 60;
    const visible = allHeroes.slice(0, MAX_VISIBLE);

    for (let i = 0; i < visible.length; i++) {
      const hero = visible[i];
      const meta = metaBestiary[hero.id];
      const current = currentEncounters[hero.id];
      const discovered = !!(meta || current);

      if (discovered) {
        const merged = {
          seen: (meta?.seen || 0) + (current?.seen || 0),
          killed: (meta?.killed || 0) + (current?.killed || 0),
        };
        this._buildDiscoveredRow(hero, merged, width, startY + i * ROW_HEIGHT);
      } else {
        this._buildLockedRow(width, startY + i * ROW_HEIGHT);
      }
    }

    if (allHeroes.length > MAX_VISIBLE) {
      const more = this._scene.add.text(width / 2, startY + MAX_VISIBLE * ROW_HEIGHT, `+${allHeroes.length - MAX_VISIBLE} ...`, {
        fontSize: '12px', color: '#aaaacc', fontFamily: FONT_FAMILY,
      }).setOrigin(0.5);
      this._rootContainer.add(more);
    }
  }

  _buildTitle(width, discovered, total) {
    const title = this._scene.add.text(width / 2, TOP_HUD_HEIGHT + 20, `英雄圖鑑 (${discovered}/${total})`, {
      fontSize: '22px', color: '#f1c40f', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._rootContainer.add(title);
  }

  _buildDiscoveredRow(hero, counts, width, y) {
    const rowBg = this._scene.add.rectangle(width / 2, y, width - 20, ROW_HEIGHT - 4, 0x1a1a2e, 0.8)
      .setStrokeStyle(1, 0x333355);

    // Hero sprite icon
    const spriteIcon = SpriteHelper.createSprite(this._scene, hero.spriteKey || `hero_${hero.id}`, 36, y, 32);

    // Name
    const nameText = this._scene.add.text(56, y - 28, hero.name, {
      fontSize: '16px', color: '#ffffff', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Type tags
    const typeTags = hero.type.map(t => t).join(' / ');
    const typeText = this._scene.add.text(56, y - 10, typeTags, {
      fontSize: '11px', color: TYPE_COLORS[hero.type[0]] || '#888888', fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5);

    // Stats
    const statsText = this._scene.add.text(56, y + 6, `HP ${hero.baseHp}  ATK ${hero.baseAtk}  DEF ${hero.baseDef}`, {
      fontSize: '12px', color: '#aaaaaa', fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5);

    // Skill name (thief hero has no skill property)
    const skillName = hero.skill?.name ?? '無';
    const skillText = this._scene.add.text(56, y + 22, `技 ${skillName}`, {
      fontSize: '11px', color: '#66aaff', fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5);

    // Encounter counts (right side)
    const countText = this._scene.add.text(width - 20, y - 10, `遭遇 ${counts.seen}`, {
      fontSize: '12px', color: '#cccccc', fontFamily: FONT_FAMILY,
    }).setOrigin(1, 0.5);

    const killText = this._scene.add.text(width - 20, y + 8, `擊殺 ${counts.killed}`, {
      fontSize: '12px', color: '#e74c3c', fontFamily: FONT_FAMILY,
    }).setOrigin(1, 0.5);

    this._rootContainer.add([rowBg, spriteIcon, nameText, typeText, statsText, skillText, countText, killText]);
  }

  _buildLockedRow(width, y) {
    const rowBg = this._scene.add.rectangle(width / 2, y, width - 20, ROW_HEIGHT - 4, 0x111122, 0.8)
      .setStrokeStyle(1, 0x222233);

    const lockIcon = this._scene.add.arc(36, y, 16, 0, 360, false, 0x222233, 1);

    const lockText = this._scene.add.text(width / 2, y - 8, '??? 未知英雄', {
      fontSize: '16px', color: '#9999cc', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0.5);

    const hintText = this._scene.add.text(width / 2, y + 14, '尚未遭遇', {
      fontSize: '12px', color: '#9999bb', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);

    this._rootContainer.add([rowBg, lockIcon, lockText, hintText]);
  }
}
