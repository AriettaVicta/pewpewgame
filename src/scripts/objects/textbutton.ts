const TextBuffer = 7;
const StrokeWidth = 5;

const RectColorOver = 0x0000FF;
const RectColorDown = 0x00FF00;
const RectColorDefault = 0xFF0000;
const RectColorDisabled = 0x828282;
const TextColor = '#FFFFFF';
const TextColorDisabled = '#828282';

export default class TextButton extends Phaser.GameObjects.Container {
  text;
  textGameObj : Phaser.GameObjects.Text;
  shape : Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  clickCallback;
  enabled : boolean;
  params;
  
  constructor(scene, x, y, text, clickCallback, circle, params) {
    super(scene, x, y)

    var self = this;

    this.clickCallback = clickCallback;
    this.params = params;
    this.enabled = true;
    this.text = text;
    this.textGameObj = scene.add.text(0, 0, text, { 
      color: TextColor,
      fontSize: '40px',
      fontStyle: 'bold',
    }).setOrigin(0,0);

    if (circle) {
      this.shape = scene.add.circle(0, 0, 50, 0, 0);
      this.shape.setStrokeStyle(StrokeWidth, RectColorDefault, 1.0);
      this.shape.setOrigin(0.5, 0.5);
      this.textGameObj.setStyle({
        fontSize: '60px',
      })
      this.textGameObj.setOrigin(0.5, 0.5);
      this.setInteractive(new Phaser.Geom.Circle(this.shape.x, this.shape.y, 
        60), Phaser.Geom.Circle.Contains);
    } else {
      this.shape = scene.add.rectangle(-TextBuffer, -TextBuffer * 3,
        this.textGameObj.displayWidth + TextBuffer* 2, this.textGameObj.displayHeight + TextBuffer * 6,
        0, 0.0);
      this.shape.setStrokeStyle(StrokeWidth, RectColorDefault, 1.0);
      this.shape.setOrigin(0, 0);

      this.setInteractive(new Phaser.Geom.Rectangle(this.shape.x, this.shape.y, 
        this.shape.width, this.shape.height), Phaser.Geom.Rectangle.Contains);
    }

    this.add(this.textGameObj);
    this.add(this.shape);

    this.on('pointerup', (pointer, localX, localY, event) => {
      if (self.enabled) {
        self.shape.setStrokeStyle(StrokeWidth, RectColorDefault);
        self.onClick();
      }
      event.stopPropogation();
    });
    this.on('pointerdown', (pointer, localX, localY, event) => {
      if (self.enabled) {
        self.shape.setStrokeStyle(StrokeWidth, RectColorDown);
      }
      event.stopPropogation();
    });
    this.on('pointerout', () => {
      if (self.enabled) {
        self.shape.setStrokeStyle(StrokeWidth, RectColorDefault);
      }
    });
    this.on('pointerover', (pointer) => {
      if (self.enabled) {
        var color = (pointer.isDown) ? RectColorDown : RectColorOver;
        self.shape.setStrokeStyle(StrokeWidth, color);
      }
    });

    scene.add.existing(this);
  }

  getDisplayHeight() {
    return this.shape.height;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.updateButtonColor();
  }

  updateButtonColor() {
    if (!this.enabled) {
      this.shape.setStrokeStyle(StrokeWidth, RectColorDisabled);
      this.textGameObj.setStyle({
        color: TextColorDisabled,
      });
    } else {
      this.shape.setStrokeStyle(StrokeWidth, RectColorDefault);
      this.textGameObj.setStyle({
        color: TextColor,
      });
    }
  }

  onClick() {
    if (this.clickCallback) {
      this.clickCallback(this.params);
    }
  }
}
