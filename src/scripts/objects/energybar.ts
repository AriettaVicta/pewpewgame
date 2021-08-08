const BarRectHeight = 25;
const BarRectWidth = 200;
const StrokeWidth = 5;

export default class EnergyBar extends Phaser.GameObjects.Container {

  filledRect : Phaser.GameObjects.Rectangle;
  emptyRect : Phaser.GameObjects.Rectangle;
  color;

  constructor(scene, x, y, color) {
    super(scene, x, y)

    this.color = color;
    this.filledRect = scene.add.rectangle(0, 0,
      BarRectWidth, BarRectHeight,
      this.color, 1.0);
    this.filledRect.setOrigin(0, 0);

    this.emptyRect = scene.add.rectangle(0, 0,
      BarRectWidth, BarRectHeight,
      0, 0);
    this.emptyRect.setStrokeStyle(StrokeWidth, this.color, 1.0);
    this.emptyRect.setOrigin(0, 0);

    this.add(this.filledRect);
    this.add(this.emptyRect);
    scene.add.existing(this)
  }

  updateFillPercent(percent) {
    if (percent > 1) percent = 1;
    this.filledRect.setScale(percent, 1);
  }
}
