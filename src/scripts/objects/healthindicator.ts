export default class HealthIndicator extends Phaser.GameObjects.Text {
  constructor(scene, x, y) {
    super(scene, x, y, '', { color: 'white', fontSize: '28px' })
    scene.add.existing(this)
    this.setOrigin(0)
  }

  public update(newHealthValue) {
    this.setText('Health: ' + newHealthValue);
  }
}
