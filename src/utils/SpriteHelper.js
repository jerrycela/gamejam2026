export default class SpriteHelper {
  /**
   * Create a sprite image, or a gray circle fallback if the texture is missing.
   * @param {Phaser.Scene} scene
   * @param {string} key - texture key
   * @param {number} x
   * @param {number} y
   * @param {number} displaySize - width and height in pixels
   * @returns {Phaser.GameObjects.Image | Phaser.GameObjects.Arc}
   */
  static createSprite(scene, key, x, y, displaySize) {
    if (scene.textures.exists(key)) {
      const img = scene.add.image(x, y, key);
      img.displayWidth = displaySize;
      img.displayHeight = displaySize;
      return img;
    }

    // Fallback: gray circle with setTint/clearTint stubs (Arc lacks these Sprite methods)
    const fallback = scene.add.arc(x, y, displaySize / 2, 0, 360, false, 0x888888, 1);
    fallback.setTint = () => fallback;
    fallback.clearTint = () => fallback;
    return fallback;
  }
}
