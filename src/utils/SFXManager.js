// Singleton audio manager — holds Phaser game.sound reference.

const DEDUP_MS = 50;

class SFXManager {
  constructor() {
    this._sound = null;
    this._muted = false;
    this._lastPlay = {};

    try {
      this._muted = localStorage.getItem('sfx_muted') === 'true';
    } catch (_e) {
      this._muted = false;
    }
  }

  init(game) {
    this._sound = game.sound;
    this._sound.mute = this._muted;
  }

  play(name) {
    if (!this._sound || this._muted) return;
    const now = Date.now();
    if (now - (this._lastPlay[name] || 0) < DEDUP_MS) return;
    this._lastPlay[name] = now;
    try {
      this._sound.play(name);
    } catch (_e) { /* ignore missing audio keys */ }
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this._sound) this._sound.mute = this._muted;
    try {
      localStorage.setItem('sfx_muted', String(this._muted));
    } catch (_e) { /* localStorage unavailable */ }
    return this._muted;
  }

  get muted() {
    return this._muted;
  }
}

export default new SFXManager();
