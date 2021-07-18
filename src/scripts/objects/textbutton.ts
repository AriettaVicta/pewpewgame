const TextBuffer = 5;
const StrokeWidth = 3;

const RectColorOver = 0x0000FF;
const RectColorDown = 0x00FF00;
const RectColorDefault = 0xFF0000;
const RectColorDisabled = 0x828282;
const TextColor = '#FFFFFF';
const TextColorDisabled = '#828282';

export default class TextButton extends Phaser.GameObjects.Container {
  text;
  textGameObj : Phaser.GameObjects.Text;
  rect : Phaser.GameObjects.Rectangle;
  clickCallback;
  enabled : boolean;
  
  constructor(scene, x, y, text, clickCallback) {
    super(scene, x, y)

    var self = this;

    this.clickCallback = clickCallback;
    this.enabled = true;
    this.text = text;
    this.textGameObj = scene.add.text(0, 0, text, { 
      color: TextColor,
      fontSize: '30px',
      fontStyle: 'bold',
    }).setOrigin(0,0);

    this.rect = scene.add.rectangle(-TextBuffer, -TextBuffer,
      this.textGameObj.displayWidth + TextBuffer* 2, this.textGameObj.displayHeight + TextBuffer * 2,
      0, 0.0);
    this.rect.setStrokeStyle(StrokeWidth, RectColorDefault, 1.0);
    this.rect.setOrigin(0, 0);

    this.setInteractive(new Phaser.Geom.Rectangle(this.rect.x, this.rect.y, 
      this.rect.width, this.rect.height), Phaser.Geom.Rectangle.Contains);

    this.add(this.textGameObj);
    this.add(this.rect);

    this.on('pointerup', () => {
      if (self.enabled) {
        self.rect.setStrokeStyle(StrokeWidth, RectColorDefault);
        self.onClick();
      }
    });
    this.on('pointerdown', () => {
      if (self.enabled) {
        self.rect.setStrokeStyle(StrokeWidth, RectColorDown);
      }
    });
    this.on('pointerout', () => {
      if (self.enabled) {
        self.rect.setStrokeStyle(StrokeWidth, RectColorDefault);
      }
    });
    this.on('pointerover', (pointer) => {
      if (self.enabled) {
        var color = (pointer.isDown) ? RectColorDown : RectColorOver;
        self.rect.setStrokeStyle(StrokeWidth, color);
      }
    });

    scene.add.existing(this);
  }

  getDisplayHeight() {
    return this.rect.height;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.updateButtonColor();
  }

  updateButtonColor() {
    if (!this.enabled) {
      this.rect.setStrokeStyle(StrokeWidth, RectColorDisabled);
      this.textGameObj.setStyle({
        color: TextColorDisabled,
      });
    } else {
      this.rect.setStrokeStyle(StrokeWidth, RectColorDefault);
      this.textGameObj.setStyle({
        color: TextColor,
      });
    }
  }

  onClick() {
    this.clickCallback();
  }
}
